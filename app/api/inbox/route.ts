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
  process_thread_id: string | null
}

// ── Extraction helpers ────────────────────────────────────────────────────────

const GENERIC_DOMAINS = new Set(['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'live', 'protonmail', 'mail', 'me', 'msn', 'ymail', 'googlemail'])

// Matches standard US phone formats with a required separator so we don't
// accidentally match 8-digit port codes, weights, or zip codes.
// Handles: (213) 555-0192  213-555-0192  213.555.0192  +1 213 555 0192
const PHONE_RE = /(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g

function extractPhone(text: string): string | null {
  for (const match of text.matchAll(PHONE_RE)) {
    const digits = match[0].replace(/\D/g, '')
    // Must be exactly 10 or 11 digits (with optional country code)
    if (digits.length === 10 || digits.length === 11) return match[0].trim()
  }
  return null
}

/**
 * Try to extract a company name from the email body.
 * Strategies (tried in order):
 *   1. Explicit label:  "Company: Pacific Trade Logistics"
 *   2. Closing + name + company on the same line or separated by whitespace:
 *      "Thanks, David Chen  Pacific Trade Logistics  (213) 555-0192"
 *   3. A standalone line containing a recognisable business-type keyword
 *      (LLC, Logistics, Freight, Inc, etc.)
 */
function extractCompanyFromBody(body: string): string | null {
  // 1. Explicit label
  const labeled = body.match(/(?:company|organization|firm)[:\s]+([A-Za-z][^\n,]{3,60})/i)
  if (labeled) return labeled[1].trim()

  // 2. Closing salutation followed by [Person Name] then company name
  //    Person name: 1–3 capitalised words
  //    Company: capitalised, ends before phone number, newline, or end-of-string
  const closingRe = /(?:thanks|best regards?|kind regards?|regards?|sincerely|cheers|appreciate)[,.]?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+([A-Z][A-Za-z &.,'-]+?)(?=\s+\(?\d{3}|[\r\n]|$)/im
  const sigMatch = body.match(closingRe)
  if (sigMatch) {
    const candidate = sigMatch[1].trim().replace(/[,.]$/, '')
    if (candidate.length >= 3 && candidate.split(/\s+/).length <= 8) return candidate
  }

  // 3. Any line containing a common business-type keyword, starting with a capital,
  //    that doesn't look like it's part of the quote request itself
  const BIZ_KEYWORD = /\b(?:LLC|L\.L\.C|Inc\.?|Corp\.?|Ltd\.?|Group|Trading|Logistics|Freight|Services|Solutions|Technologies|International|Imports?|Exports?|Distribution|Supply|Ventures?|Holdings?|Partners?|Associates?)\b/i
  const QUOTE_WORDS = /\b(?:please|provide|quote|container|port|weight|chassis|pier|pass|advise|following|applicable|destination|cargo)\b/i
  for (const rawLine of body.split(/\n/)) {
    const line = rawLine.trim()
    if (line.length < 3 || line.length > 80 || !/^[A-Z]/.test(line)) continue
    if (BIZ_KEYWORD.test(line) && !QUOTE_WORDS.test(line)) {
      // Strip any trailing phone number before returning
      return line.replace(PHONE_RE, '').trim().replace(/[,.]$/, '')
    }
  }

  return null
}

function extractCompany(fromEmail: string, bodyText: string): string | null {
  // Body signature is more specific than domain — try it first
  const bodyCompany = extractCompanyFromBody(bodyText)
  if (bodyCompany) return bodyCompany

  // Fall back to email domain
  const domainMatch = fromEmail.match(/@([^.]+)\./)
  if (!domainMatch) return null
  const domain = domainMatch[1].toLowerCase()
  if (GENERIC_DOMAINS.has(domain)) return null
  return domain.charAt(0).toUpperCase() + domain.slice(1)
}

/** For QuotyAI chatbot quote requests, parse the customer name from the body. */
function extractChatbotCustomerName(body: string): string | null {
  const match = body.match(/Customer:\s*([^<\n]+?)(?:\s*<|\s*$)/)
  return match?.[1]?.trim() ?? null
}

// Lazily add process_thread_id column the first time GET is called.
// ALTER TABLE … ADD COLUMN IF NOT EXISTS is idempotent — instant no-op once the column exists.
let _processThreadColReady = false
async function ensureProcessThreadIdColumn() {
  if (_processThreadColReady) return
  try {
    await sql`ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS process_thread_id TEXT`
    _processThreadColReady = true
  } catch {
    // Non-fatal — column may already exist or DB unavailable; SELECT will surface any real error
  }
}

export async function GET() {
  try {
    await ensureProcessThreadIdColumn()

    const threads = await sql`
      SELECT id, subject, participant_from, participant_to, status, last_message_at, created_at, process_thread_id
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
          const company = extractCompany(thread.participant_from, firstInbound.body_text)
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
            processThreadId: thread.process_thread_id ?? undefined,
          }
        })
      )
    ).filter(Boolean)

    return NextResponse.json({ emails })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/inbox] DB error:', message)

    const missingTable = /relation .* does not exist|no such table/i.test(message)
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
      _dbError: message,
      _hint: missingTable
        ? 'Database tables are missing — run: pnpm db:migrate'
        : 'Database connection failed — check DATABASE_URL in Vercel environment variables',
    })
  }
}
