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

// ── Extraction helpers ────────────────────────────────────────────────────────

const GENERIC_DOMAINS = new Set(['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'live', 'protonmail', 'mail', 'me', 'msn', 'ymail', 'googlemail'])

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)[0-9]{3}[-.\s]?[0-9]{4}/)
  if (!match) return null
  const digits = match[0].replace(/\D/g, '')
  // Skip sequences that look like dates or IDs (e.g. 20260414)
  if (digits.length < 10) return null
  return match[0].trim()
}

function extractCompany(fromEmail: string): string | null {
  const domainMatch = fromEmail.match(/@([^.]+)\./)
  if (!domainMatch) return null
  const domain = domainMatch[1].toLowerCase()
  if (GENERIC_DOMAINS.has(domain)) return null
  // Capitalise domain name as a best-effort company name
  return domain.charAt(0).toUpperCase() + domain.slice(1)
}

/** For QuotyAI chatbot quote requests, parse the customer name from the body. */
function extractChatbotCustomerName(body: string): string | null {
  const match = body.match(/Customer:\s*([^<\n]+?)(?:\s*<|\s*$)/)
  return match?.[1]?.trim() ?? null
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

          const isChatbotQuote = firstInbound.body_text.startsWith('[QuotyAI')
          const company = extractCompany(thread.participant_from)
          const phone = extractPhone(firstInbound.body_text)
          // For chatbot quotes show the customer's real name as the sender label
          const senderName = isChatbotQuote
            ? extractChatbotCustomerName(firstInbound.body_text)
            : null

          return {
            id: thread.id,
            emailThreadId: thread.id,
            from: senderName
              ? `${senderName} <${thread.participant_from}>`
              : thread.participant_from,
            to: thread.participant_to,
            subject: thread.subject,
            body: firstInbound.body_text,
            date: firstInbound.received_at ?? firstInbound.created_at,
            status,
            isRead,
            responses,
            source: 'real',
            company: company ?? undefined,
            phone: phone ?? undefined,
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
