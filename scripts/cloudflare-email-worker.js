/**
 * Cloudflare Email Worker — QuoteonAI
 *
 * Deploy in Cloudflare Dashboard → Email → Email Workers.
 * Set these Environment Variables (Workers → Settings → Variables):
 *
 *   EMAIL_WORKER_URL     = https://your-vercel-app.vercel.app/api/webhooks/email
 *   EMAIL_WORKER_API_KEY = (must match EMAIL_WORKER_API_KEY or WEBHOOK_SECRET in Vercel)
 *
 * Both variables are REQUIRED. Without them the worker will reject inbound emails.
 */

export default {
  async email(message, env, ctx) {
    const webhookUrl = env.EMAIL_WORKER_URL
    const apiKey = env.EMAIL_WORKER_API_KEY

    // Hard-fail early so Cloudflare retries rather than silently dropping
    if (!webhookUrl) {
      console.error('[CF Worker] EMAIL_WORKER_URL is not set — rejecting email')
      message.setReject('Configuration error: EMAIL_WORKER_URL not set')
      return
    }
    if (!apiKey) {
      console.error('[CF Worker] EMAIL_WORKER_API_KEY is not set — rejecting email')
      message.setReject('Configuration error: EMAIL_WORKER_API_KEY not set')
      return
    }

    try {
      // Read the full raw MIME email from the ReadableStream (can only be consumed once)
      const rawBytes = await new Response(message.raw).arrayBuffer()
      const rawEmail = new TextDecoder('utf-8').decode(rawBytes)

      if (!rawEmail || rawEmail.length < 20) {
        console.error('[CF Worker] Raw email body is empty or too short — skipping')
        return
      }

      // Extract headers
      const messageId  = message.headers.get('message-id')  ?? ''
      const subject    = message.headers.get('subject')     ?? '(no subject)'
      const inReplyTo  = message.headers.get('in-reply-to') ?? ''
      const references = message.headers.get('references')  ?? ''
      const timestamp  = message.headers.get('date')        ?? new Date().toISOString()

      // SPF: Cloudflare exposes the verification result on the message object
      // Fall back to header inspection if the property isn't available
      let spf = 'none'
      if (typeof message.verificationResults?.spf === 'string') {
        spf = message.verificationResults.spf.toLowerCase().includes('pass') ? 'pass' : 'none'
      } else {
        const spfHeader = message.headers.get('received-spf') ?? ''
        spf = spfHeader.toLowerCase().includes('pass') ? 'pass' : 'none'
      }

      // DKIM: same approach
      let dkim = 'none'
      if (typeof message.verificationResults?.dkim === 'string') {
        dkim = message.verificationResults.dkim.toLowerCase().includes('pass') ? 'pass' : 'none'
      } else {
        // Presence of dkim-signature does NOT mean it passed; treat as unknown
        dkim = 'none'
      }

      // Build FormData payload
      const formData = new FormData()
      formData.append('message-id', messageId)
      formData.append('from',       message.from)
      formData.append('to',         message.to)
      formData.append('subject',    subject)
      formData.append('timestamp',  timestamp)
      formData.append('spf',        spf)
      formData.append('dkim',       dkim)
      if (inReplyTo)  formData.append('in-reply-to', inReplyTo)
      if (references) formData.append('references',  references)
      formData.append('raw', rawEmail)

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '(unreadable)')
        console.error(`[CF Worker] Webhook returned ${res.status}: ${body}`)
        // 401 = auth mismatch → check EMAIL_WORKER_API_KEY matches Vercel's WEBHOOK_SECRET
        if (res.status === 401) {
          console.error('[CF Worker] Auth failed — ensure EMAIL_WORKER_API_KEY in Cloudflare matches WEBHOOK_SECRET (or EMAIL_WORKER_API_KEY) in Vercel')
        }
        // Do not reject — let Cloudflare handle retries
        return
      }

      const result = await res.json().catch(() => ({}))
      console.log(`[CF Worker] Forwarded email: status=${result.status} id=${result.id} from=${message.from}`)

    } catch (err) {
      console.error('[CF Worker] Unexpected error:', err?.message ?? err)
      // Do not reject — let Cloudflare handle retries
    }
  },
}
