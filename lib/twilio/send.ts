export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? ''
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
  const from = process.env.TWILIO_WHATSAPP_FROM ?? ''

  if (!accountSid || !authToken || !from) {
    console.error('[twilio/send] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM')
    return
  }

  const toF = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  const fromF = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`

  const params = new URLSearchParams({ From: fromF, To: toF, Body: body })

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: params.toString(),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio error ${res.status}: ${text}`)
  }
}
