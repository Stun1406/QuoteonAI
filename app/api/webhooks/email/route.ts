import { NextRequest, NextResponse } from 'next/server'
import PostalMime from 'postal-mime'
import { computeTrustLevel } from '@/lib/compute-trust'
import { verifyWebhookSignature, generateCanonicalId } from '@/lib/verify-webhook'
import { logEmailFailure } from '@/lib/email-failure-log'
import { storeEmail } from '@/lib/email-store'
import { resolveThreadForInbound, insertInboundEmailMessage, findEmailMessageByCanonicalId } from '@/lib/db/tables/email-thread'
import { sql } from '@/lib/db/client'

// ── Diagnostic GET — verifies the webhook is reachable and shows config status ─
export async function GET() {
  const apiKeyConfigured  = !!(process.env.EMAIL_WORKER_API_KEY)
  const secretConfigured  = !!(process.env.WEBHOOK_SECRET)
  const authConfigured    = apiKeyConfigured || secretConfigured

  // Quick DB health check
  let dbOk = false
  let tableExists = false
  let recentFailureCount = 0
  let emailCount = 0
  try {
    await sql`SELECT 1`
    dbOk = true
    const tbls = await sql`
      SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_name IN ('email_threads','email_messages')
    ` as Array<{ n: string }>
    tableExists = Number(tbls[0]?.n ?? 0) === 2

    if (tableExists) {
      const cnt = await sql`SELECT COUNT(*) AS n FROM email_messages WHERE direction = 'inbound'` as Array<{ n: string }>
      emailCount = Number(cnt[0]?.n ?? 0)
    }

    const failTbl = await sql`
      SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = 'email_failures'
    ` as Array<{ n: string }>
    if (Number(failTbl[0]?.n ?? 0) > 0) {
      const fc = await sql`SELECT COUNT(*) AS n FROM email_failures WHERE created_at > NOW() - INTERVAL '24 hours'` as Array<{ n: string }>
      recentFailureCount = Number(fc[0]?.n ?? 0)
    }
  } catch { /* DB unreachable */ }

  return NextResponse.json({
    status: 'ok',
    auth: {
      configured: authConfigured,
      emailWorkerApiKey: apiKeyConfigured ? 'set' : 'NOT SET',
      webhookSecret: secretConfigured ? 'set' : 'NOT SET',
      note: authConfigured
        ? 'Cloudflare worker x-api-key must match EMAIL_WORKER_API_KEY or WEBHOOK_SECRET in Vercel env vars'
        : 'WARNING: No auth configured — webhook accepts any request',
    },
    database: {
      connected: dbOk,
      tablesExist: tableExists,
      inboundEmailCount: emailCount,
      recentFailures24h: recentFailureCount,
    },
    instructions: tableExists
      ? null
      : 'Run database migrations: pnpm db:migrate — email_threads / email_messages tables are missing',
  })
}

// ── Quote outcome detection ───────────────────────────────────────────────────
function detectQuoteOutcome(text: string): 'won' | 'lost' | null {
  const t = text.toLowerCase()
  if (/\b(accept|accepted|approve|approved|confirm|confirmed|proceed|yes please|go ahead|sounds good|looks good|perfect|please proceed|we accept|i accept|moving forward|let'?s go|we'?ll take it|happy to proceed)\b/.test(t)) return 'won'
  if (/\b(decline|declined|reject|rejected|pass|not interested|no thanks|won'?t work|can'?t proceed|cancel|cancelled|we'?ll pass|not moving forward|unfortunately|going with someone|going elsewhere|too expensive|too high)\b/.test(t)) return 'lost'
  return null
}

// Support both multipart/form-data (Cloudflare worker) and application/json
async function parsePayload(req: NextRequest): Promise<{
  formFields: Record<string, string>
  raw: string | null
  messageId: string | null
  from: string | null
  to: string | null
  subject: string | null
  timestamp: string | null
  spf: string | null
  dkim: string | null
  inReplyTo: string | null
  references: string | null
}> {
  const ct = req.headers.get('content-type') ?? ''

  if (ct.includes('application/json')) {
    const body = await req.json() as Record<string, string>
    const { raw, 'message-id': messageId, from, to, subject, timestamp,
            spf, dkim, 'in-reply-to': inReplyTo, references } = body
    const formFields: Record<string, string> = {}
    for (const [k, v] of Object.entries(body)) {
      if (k !== 'raw' && typeof v === 'string') formFields[k] = v
    }
    return { formFields, raw: raw ?? null, messageId: messageId ?? null,
             from: from ?? null, to: to ?? null, subject: subject ?? null,
             timestamp: timestamp ?? null, spf: spf ?? null, dkim: dkim ?? null,
             inReplyTo: inReplyTo ?? null, references: references ?? null }
  }

  // Default: multipart/form-data
  const formData = await req.formData()
  const formFields: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key !== 'raw' && typeof value === 'string') formFields[key] = value
  }
  return {
    formFields,
    raw: formData.get('raw') as string | null,
    messageId: formData.get('message-id') as string | null,
    from: formData.get('from') as string | null,
    to: formData.get('to') as string | null,
    subject: formData.get('subject') as string | null,
    timestamp: formData.get('timestamp') as string | null,
    spf: formData.get('spf') as string | null,
    dkim: formData.get('dkim') as string | null,
    inReplyTo: formData.get('in-reply-to') as string | null,
    references: formData.get('references') as string | null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await parsePayload(req)

    // Verify auth: accept API key, HMAC signature, or WEBHOOK_SECRET used directly as API key
    const apiKey = req.headers.get('x-api-key') ?? ''
    const expectedApiKey = process.env.EMAIL_WORKER_API_KEY ?? ''
    const signature = req.headers.get('x-webhook-signature') ?? ''
    const secret = process.env.WEBHOOK_SECRET ?? ''

    // Three valid auth paths:
    // 1. x-api-key matches EMAIL_WORKER_API_KEY
    // 2. x-api-key matches WEBHOOK_SECRET directly (simplest Cloudflare worker setup)
    // 3. x-webhook-signature is a valid HMAC-SHA256 of form fields using WEBHOOK_SECRET
    const apiKeyValid = expectedApiKey !== '' && apiKey === expectedApiKey
    const secretAsKeyValid = secret !== '' && apiKey === secret
    const hmacValid = secret !== '' && signature !== '' && verifyWebhookSignature(payload.formFields, signature, secret)
    const authConfigured = expectedApiKey !== '' || secret !== ''

    if (authConfigured) {
      if (!apiKeyValid && !secretAsKeyValid && !hmacValid) {
        console.warn('[webhook/email] Auth failed — apiKey present:', !!apiKey, '| sig present:', !!signature)
        await logEmailFailure({
          stage: 'webhook-auth',
          statusCode: 401,
          message: 'Invalid API key or webhook signature',
          context: { apiKey: apiKey ? '[present]' : '[missing]', signature: signature ? '[present]' : '[missing]' },
        }).catch(() => {})
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      console.warn('[webhook/email] No auth configured — accepting unauthenticated request. Set EMAIL_WORKER_API_KEY or WEBHOOK_SECRET in production.')
    }

    const { raw: rawEmail, messageId: messageIdHeader, from: fromHeader,
            to: toHeader, subject: subjectHeader, timestamp: timestampStr,
            spf, dkim, inReplyTo, references } = payload

    if (!rawEmail) {
      console.warn('[webhook/email] Missing raw email body')
      await logEmailFailure({
        stage: 'webhook-parse',
        statusCode: 400,
        message: 'Missing raw email',
        context: { fields: Object.keys(payload.formFields) },
      }).catch(() => {})
      return NextResponse.json({ error: 'Missing raw email' }, { status: 400 })
    }

    // Parse MIME email
    const parsed = await new PostalMime().parse(rawEmail)

    const from = parsed.from?.address ?? fromHeader ?? 'unknown@unknown.com'
    const to = parsed.to?.[0]?.address ?? toHeader ?? ''
    const subject = parsed.subject ?? subjectHeader ?? '(no subject)'
    const bodyText = parsed.text ?? ''
    const bodyHtml = parsed.html ?? undefined
    const messageId = parsed.messageId ?? messageIdHeader ?? null
    const timestamp = timestampStr ?? new Date().toISOString()

    console.log(`[webhook/email] Received from=${from} subject="${subject}" messageId=${messageId}`)

    // Deduplication
    const canonicalId = generateCanonicalId(messageId, from, subject, timestamp)
    const existing = await findEmailMessageByCanonicalId(canonicalId)
    if (existing) {
      console.log('[webhook/email] Duplicate, skipping:', canonicalId)
      return NextResponse.json({ status: 'duplicate', canonicalId })
    }

    // Trust level
    const trustLevel = computeTrustLevel(spf, dkim)

    // Resolve or create thread
    const emailThread = await resolveThreadForInbound({ from, to, subject })

    // Insert into DB
    const emailMsg = await insertInboundEmailMessage({
      threadId: emailThread.id,
      canonicalId,
      messageId: messageId ?? undefined,
      inReplyTo: inReplyTo ?? parsed.inReplyTo ?? undefined,
      referencesHeader: references ?? undefined,
      fromEmail: from,
      toEmail: to,
      subject,
      bodyText,
      bodyHtml,
      trustLevel,
      spf: spf ?? undefined,
      dkim: dkim ?? undefined,
      receivedAt: new Date(timestamp),
    })

    // In-memory fallback for dev
    storeEmail({
      id: emailMsg.id,
      canonicalId,
      from,
      to,
      subject,
      bodyText,
      bodyHtml,
      receivedAt: new Date(timestamp),
      trustLevel,
    })

    console.log(`[webhook/email] Stored email id=${emailMsg.id} thread=${emailThread.id}`)

    // Auto-detect quote acceptance/rejection from email chain replies
    try {
      const ptRows = await sql`SELECT process_thread_id FROM email_threads WHERE id = ${emailThread.id}` as Array<{ process_thread_id?: string }>
      const processThreadId = ptRows[0]?.process_thread_id
      if (processThreadId && bodyText) {
        const outboundRows = await sql`SELECT COUNT(*)::int AS count FROM email_messages WHERE thread_id = ${emailThread.id} AND direction = 'outbound'` as Array<{ count: number }>
        if ((outboundRows[0]?.count ?? 0) > 0) {
          const outcome = detectQuoteOutcome(bodyText)
          if (outcome) {
            await sql`UPDATE message_threads SET status = ${outcome}, closed_at = NOW(), updated_at = NOW() WHERE thread_id = ${processThreadId}`
            console.log(`[webhook/email] Auto-detected quote outcome: ${outcome} for thread ${processThreadId}`)
          }
        }
      }
    } catch (outcomeErr) {
      console.error('[webhook/email] Outcome detection failed (non-fatal):', outcomeErr)
    }

    return NextResponse.json({ status: 'created', id: emailMsg.id, canonicalId })

  } catch (err) {
    console.error('[webhook/email] Error:', err)
    await logEmailFailure({
      stage: 'webhook-processing',
      statusCode: 500,
      message: err instanceof Error ? err.message : 'Unknown error',
      context: {},
    }).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
