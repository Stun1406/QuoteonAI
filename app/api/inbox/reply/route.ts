import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { sql } from '@/lib/db/client'
import { textToHtml } from '@/lib/llm/formatter'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, subject, text, html, emailThreadId } = body as {
      to: string
      subject?: string
      text: string
      html?: string
      emailThreadId?: string
    }

    if (!to || !text) {
      return NextResponse.json({ error: 'to and text are required' }, { status: 400 })
    }

    const replySubject = subject
      ? subject.startsWith('RE:') ? subject : `RE: ${subject}`
      : 'RE: Your Inquiry'

    const fromEmail = process.env.FROM_EMAIL ?? 'quote-agent@quotify.cc'
    const htmlBody = html ?? textToHtml(text)

    // Send via Resend
    const { id: messageId } = await sendEmail({
      to,
      subject: replySubject,
      html: htmlBody,
      text,
    })

    // Record outbound message and update thread status in DB
    if (emailThreadId) {
      try {
        await sql`
          INSERT INTO email_messages (
            thread_id, direction, from_email, to_email, subject, body_text, body_html
          ) VALUES (
            ${emailThreadId}, 'outbound', ${fromEmail}, ${to}, ${replySubject}, ${text}, ${htmlBody}
          )
        `
        await sql`
          UPDATE email_threads
          SET status = 'replied', last_message_at = NOW(), updated_at = NOW()
          WHERE id = ${emailThreadId}
        `
      } catch (dbErr) {
        // Email was still sent — just log the DB failure
        console.error('[/api/inbox/reply] DB record error (email was sent):', dbErr)
      }
    }

    return NextResponse.json({ ok: true, messageId })
  } catch (err) {
    console.error('[/api/inbox/reply] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send reply' },
      { status: 500 }
    )
  }
}
