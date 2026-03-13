import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const from = process.env.FROM_EMAIL ?? 'quotes@fldistribution.com'

  const result = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id ?? 'unknown' }
}
