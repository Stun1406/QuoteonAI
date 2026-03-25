import { NextRequest, NextResponse } from 'next/server'
import PostalMime from 'postal-mime'
import { computeTrustLevel } from '@/lib/compute-trust'
import { verifyWebhookSignature, generateCanonicalId } from '@/lib/verify-webhook'
import { logEmailFailure } from '@/lib/email-failure-log'
import { storeEmail } from '@/lib/email-store'
import { resolveThreadForInbound, insertInboundEmailMessage, findEmailMessageByCanonicalId } from '@/lib/db/tables/email-thread'

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

    // Verify auth: accept either API key or HMAC signature
    const apiKey = req.headers.get('x-api-key') ?? ''
    const expectedApiKey = process.env.EMAIL_WORKER_API_KEY ?? ''
    const signature = req.headers.get('x-webhook-signature') ?? ''
    const secret = process.env.WEBHOOK_SECRET ?? ''

    const apiKeyValid = expectedApiKey !== '' && apiKey === expectedApiKey
    const hmacValid = secret !== '' && verifyWebhookSignature(payload.formFields, signature, secret)

    if (expectedApiKey || secret) {
      if (!apiKeyValid && !hmacValid) {
        console.warn('[webhook/email] Auth failed — apiKey present:', !!apiKey, '| sig present:', !!signature)
        await logEmailFailure({
          stage: 'webhook-auth',
          statusCode: 401,
          message: 'Invalid API key or webhook signature',
          context: { apiKey: apiKey ? '[present]' : '[missing]', signature: signature ? '[present]' : '[missing]' },
        }).catch(() => {})
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
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
