/**
 * Cloudflare Email Worker — QuotionAI
 *
 * Deploy this in Cloudflare Dashboard → Email → Email Workers.
 * Set the following Environment Variables (Workers → Settings → Variables):
 *   EMAIL_WORKER_URL   = https://your-vercel-app.vercel.app/api/webhooks/email
 *   EMAIL_WORKER_API_KEY = (same value as set in Vercel env vars)
 *
 * The worker receives inbound emails via Cloudflare Email Routing
 * and forwards them to the webhook endpoint as multipart/form-data.
 */

export default {
  async email(message, env, ctx) {
    try {
      const webhookUrl = env.EMAIL_WORKER_URL
      const apiKey = env.EMAIL_WORKER_API_KEY

      if (!webhookUrl) {
        console.error('[CF Worker] EMAIL_WORKER_URL not set')
        message.setReject('Configuration error')
        return
      }

      // Read the full raw MIME email from the stream
      const rawBytes = await new Response(message.raw).arrayBuffer()
      const rawEmail = new TextDecoder().decode(rawBytes)

      // Extract headers
      const messageId = message.headers.get('message-id') ?? ''
      const subject = message.headers.get('subject') ?? '(no subject)'
      const inReplyTo = message.headers.get('in-reply-to') ?? ''
      const references = message.headers.get('references') ?? ''
      const timestamp = message.headers.get('date') ?? new Date().toISOString()

      // SPF and DKIM are available on the message object in Cloudflare
      const spf = message.headers.get('received-spf')?.toLowerCase().includes('pass') ? 'pass' : 'none'
      const dkim = message.headers.get('dkim-signature') ? 'pass' : 'none'

      // Build FormData payload
      const formData = new FormData()
      formData.append('message-id', messageId)
      formData.append('from', message.from)
      formData.append('to', message.to)
      formData.append('subject', subject)
      formData.append('timestamp', timestamp)
      formData.append('spf', spf)
      formData.append('dkim', dkim)
      if (inReplyTo) formData.append('in-reply-to', inReplyTo)
      if (references) formData.append('references', references)
      formData.append('raw', rawEmail)

      const headers = { 'x-api-key': apiKey }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '(unreadable)')
        console.error(`[CF Worker] Webhook returned ${res.status}: ${body}`)
        // Don't reject the email — Cloudflare will retry
        return
      }

      const result = await res.json().catch(() => ({}))
      console.log(`[CF Worker] Forwarded email: status=${result.status} id=${result.id}`)

    } catch (err) {
      console.error('[CF Worker] Error:', err?.message ?? err)
      // Do not reject — let Cloudflare handle retries
    }
  },
}
