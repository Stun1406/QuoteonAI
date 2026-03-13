import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getAllEmails } from '@/lib/email-store'

type EmailRow = {
  id: string
  direction: string
  from_email: string
  to_email: string
  body_text: string
  body_html: string | null
  is_read: boolean
  received_at: string
  created_at: string
}

type ThreadRow = {
  id: string
  subject: string
  participant_from: string
  participant_to: string
  status: string
  last_message_at: string
  created_at: string
}

export async function GET() {
  try {
    const threads = await sql`
      SELECT id, subject, participant_from, participant_to, status, last_message_at, created_at
      FROM email_threads
      ORDER BY last_message_at DESC
      LIMIT 100
    ` as ThreadRow[]

    const emails = (
      await Promise.all(
        threads.map(async (thread) => {
          const messages = await sql`
            SELECT id, direction, from_email, to_email, body_text, body_html, is_read, received_at, created_at
            FROM email_messages
            WHERE thread_id = ${thread.id}
            ORDER BY received_at ASC
          ` as EmailRow[]

          const firstInbound = messages.find(m => m.direction === 'inbound')
          if (!firstInbound) return null

          const hasOutbound = messages.some(m => m.direction === 'outbound')
          let status: 'new' | 'in-progress' | 'responded' = 'new'
          if (hasOutbound || thread.status === 'replied') status = 'responded'
          else if (thread.status === 'in-progress') status = 'in-progress'

          const isRead = messages
            .filter(m => m.direction === 'inbound')
            .every(m => m.is_read)

          const responses = messages
            .filter(m => m !== firstInbound)
            .map(m => ({
              id: m.id,
              body: m.body_html ?? m.body_text,
              sentAt: m.received_at ?? m.created_at,
              role: m.direction === 'inbound' ? 'user' : 'ai',
              format: m.body_html ? 'html' : 'text',
            }))

          return {
            id: thread.id,
            emailThreadId: thread.id,
            from: thread.participant_from,
            to: thread.participant_to,
            subject: thread.subject,
            body: firstInbound.body_text,
            date: firstInbound.received_at ?? firstInbound.created_at,
            status,
            isRead,
            responses,
            source: 'real',
          }
        })
      )
    ).filter(Boolean)

    return NextResponse.json({ emails })
  } catch (err) {
    // DB not available — fall back to in-memory store
    console.error('[/api/inbox] DB error, falling back to in-memory store:', err)
    const stored = getAllEmails()
    return NextResponse.json({
      emails: stored.map(e => ({
        id: e.id,
        emailThreadId: null,
        from: e.from,
        to: e.to,
        subject: e.subject,
        body: e.bodyText,
        date: e.receivedAt.toISOString(),
        status: 'new',
        isRead: false,
        responses: [],
        source: 'real',
      })),
    })
  }
}
