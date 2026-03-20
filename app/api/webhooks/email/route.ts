import { NextRequest, NextResponse } from 'next/server'
import PostalMime from 'postal-mime'
import { computeTrustLevel } from '@/lib/compute-trust'
import { verifyWebhookSignature, generateCanonicalId } from '@/lib/verify-webhook'
import { logEmailFailure } from '@/lib/email-failure-log'
import { storeEmail } from '@/lib/email-store'
import { resolveThreadForInbound, insertInboundEmailMessage, findEmailMessageByCanonicalId } from '@/lib/db/tables/email-thread'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // Collect form fields for HMAC verification (excluding 'raw')
    const formFields: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (key !== 'raw' && typeof value === 'string') {
        formFields[key] = value
      }
    }

    // Verify auth: accept either API key or HMAC signature
    const apiKey = req.headers.get('x-api-key') ?? ''
    const expectedApiKey = process.env.EMAIL_WORKER_API_KEY ?? ''
    const signature = req.headers.get('x-webhook-signature') ?? ''
    const secret = process.env.WEBHOOK_SECRET ?? ''

    const apiKeyValid = expectedApiKey && apiKey === expectedApiKey
    const hmacValid = secret && verifyWebhookSignature(formFields, signature, secret)

    if (expectedApiKey || secret) {
      if (!apiKeyValid && !hmacValid) {
        await logEmailFailure({
          stage: 'webhook-auth',
          statusCode: 401,
          message: 'Invalid API key or webhook signature',
          context: { apiKey: apiKey ? '[present]' : '[missing]', signature: signature ? '[present]' : '[missing]' },
        })
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extract fields
    const rawEmail = formData.get('raw') as string | null
    const messageIdHeader = formData.get('message-id') as string | null
    const fromHeader = formData.get('from') as string | null
    const toHeader = formData.get('to') as string | null
    const subjectHeader = formData.get('subject') as string | null
    const timestampStr = formData.get('timestamp') as string | null
    const spf = formData.get('spf') as string | null
    const dkim = formData.get('dkim') as string | null
    const inReplyTo = formData.get('in-reply-to') as string | null
    const references = formData.get('references') as string | null

    if (!rawEmail) {
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

    // Generate canonical ID for deduplication
    const canonicalId = generateCanonicalId(messageId, from, subject, timestamp)

    // Check for duplicate
    const existing = await findEmailMessageByCanonicalId(canonicalId)
    if (existing) {
      return NextResponse.json({ status: 'duplicate', canonicalId })
    }

    // Compute trust
    const trustLevel = computeTrustLevel(spf, dkim)

    // Resolve or create email thread
    const emailThread = await resolveThreadForInbound({ from, to, subject })

    // Store in DB
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

    // Also store in in-memory store (dev fallback)
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
