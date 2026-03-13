import { sql } from '../client'
import type { EmailThreadRow, EmailMessageRow } from '../../types/database'

export function normalizeSubject(subject: string): string {
  return subject.toLowerCase().replace(/^(re:|fwd?:|fw:)\s*/gi, '').trim()
}

export async function findEmailThread(subjectNorm: string, participantFrom: string, participantTo: string): Promise<EmailThreadRow | null> {
  const rows = await sql`
    SELECT * FROM email_threads
    WHERE subject_norm = ${subjectNorm}
      AND (participant_from = ${participantFrom} OR participant_to = ${participantFrom}
           OR participant_from = ${participantTo} OR participant_to = ${participantTo})
    ORDER BY last_message_at DESC
    LIMIT 1
  `
  return rows[0] as EmailThreadRow || null
}

export async function createEmailThread(data: {
  subject: string
  subjectNorm: string
  participantFrom: string
  participantTo: string
  status?: string
}): Promise<EmailThreadRow> {
  const rows = await sql`
    INSERT INTO email_threads (subject, subject_norm, participant_from, participant_to, status)
    VALUES (${data.subject}, ${data.subjectNorm}, ${data.participantFrom}, ${data.participantTo}, ${data.status ?? 'new'})
    RETURNING *
  `
  return rows[0] as EmailThreadRow
}

export async function updateEmailThreadLastMessage(id: string): Promise<void> {
  await sql`
    UPDATE email_threads SET last_message_at = NOW(), updated_at = NOW() WHERE id = ${id}
  `
}

export async function getEmailThreadById(id: string): Promise<EmailThreadRow | null> {
  const rows = await sql`SELECT * FROM email_threads WHERE id = ${id} LIMIT 1`
  return rows[0] as EmailThreadRow || null
}

export async function listEmailThreads(limit = 50, offset = 0): Promise<EmailThreadRow[]> {
  const rows = await sql`
    SELECT * FROM email_threads ORDER BY last_message_at DESC LIMIT ${limit} OFFSET ${offset}
  `
  return rows as EmailThreadRow[]
}

export async function insertEmailMessage(data: {
  threadId: string
  direction: 'inbound' | 'outbound'
  canonicalId?: string | null
  messageId?: string | null
  inReplyTo?: string | null
  referencesHeader?: string | null
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
  trustLevel?: string | null
  spf?: string | null
  dkim?: string | null
}): Promise<EmailMessageRow> {
  const rows = await sql`
    INSERT INTO email_messages (
      thread_id, direction, canonical_id, message_id, in_reply_to, references_header,
      from_email, to_email, subject, body_text, body_html, trust_level, spf, dkim
    ) VALUES (
      ${data.threadId}, ${data.direction}, ${data.canonicalId ?? null},
      ${data.messageId ?? null}, ${data.inReplyTo ?? null}, ${data.referencesHeader ?? null},
      ${data.fromEmail}, ${data.toEmail}, ${data.subject},
      ${data.bodyText}, ${data.bodyHtml ?? null}, ${data.trustLevel ?? null},
      ${data.spf ?? null}, ${data.dkim ?? null}
    )
    RETURNING *
  `
  return rows[0] as EmailMessageRow
}

export async function getEmailMessagesByThreadId(threadId: string): Promise<EmailMessageRow[]> {
  const rows = await sql`
    SELECT * FROM email_messages WHERE thread_id = ${threadId} ORDER BY received_at ASC
  `
  return rows as EmailMessageRow[]
}

export async function findEmailMessageByCanonicalId(canonicalId: string): Promise<EmailMessageRow | null> {
  const rows = await sql`
    SELECT * FROM email_messages WHERE canonical_id = ${canonicalId} LIMIT 1
  `
  return rows[0] as EmailMessageRow || null
}

export async function markEmailAsRead(id: string): Promise<void> {
  await sql`UPDATE email_messages SET is_read = true WHERE id = ${id}`
}

export async function resolveThreadForInbound(data: {
  from: string
  to: string
  subject: string
}): Promise<EmailThreadRow> {
  const subjectNorm = normalizeSubject(data.subject)
  const existing = await findEmailThread(subjectNorm, data.from, data.to)
  if (existing) {
    await updateEmailThreadLastMessage(existing.id)
    return existing
  }
  return createEmailThread({
    subject: data.subject,
    subjectNorm,
    participantFrom: data.from,
    participantTo: data.to,
  })
}

export async function insertInboundEmailMessage(data: {
  threadId: string
  canonicalId: string
  messageId?: string
  inReplyTo?: string
  referencesHeader?: string
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string
  bodyHtml?: string
  trustLevel: string
  spf?: string
  dkim?: string
  receivedAt: Date
}): Promise<EmailMessageRow> {
  const rows = await sql`
    INSERT INTO email_messages (
      thread_id, direction, canonical_id, message_id, in_reply_to, references_header,
      from_email, to_email, subject, body_text, body_html, trust_level, spf, dkim, received_at
    ) VALUES (
      ${data.threadId}, 'inbound', ${data.canonicalId},
      ${data.messageId ?? null}, ${data.inReplyTo ?? null}, ${data.referencesHeader ?? null},
      ${data.fromEmail}, ${data.toEmail}, ${data.subject},
      ${data.bodyText}, ${data.bodyHtml ?? null}, ${data.trustLevel},
      ${data.spf ?? null}, ${data.dkim ?? null}, ${data.receivedAt.toISOString()}
    )
    RETURNING *
  `
  return rows[0] as EmailMessageRow
}
