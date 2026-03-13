import { sql } from '../client'
import type { MessageThreadRow } from '../../types/database'

export function generateThreadId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `THR_${date}_${random}`
}

export async function createMessageThread(data: {
  tenantId: string
  projectId: string
  threadId: string
  contactId?: string | null
  companyId?: string | null
  intent: string
  processorType: string
  isForwarded?: boolean
  confidenceScore?: number | null
}): Promise<MessageThreadRow> {
  const rows = await sql`
    INSERT INTO message_threads (
      tenant_id, project_id, thread_id, contact_id, company_id,
      intent, processor_type, is_forwarded, confidence_score
    ) VALUES (
      ${data.tenantId}, ${data.projectId}, ${data.threadId},
      ${data.contactId ?? null}, ${data.companyId ?? null},
      ${data.intent}, ${data.processorType},
      ${data.isForwarded ?? false}, ${data.confidenceScore ?? null}
    )
    RETURNING *
  `
  return rows[0] as MessageThreadRow
}

export async function getMessageThreadById(id: string): Promise<MessageThreadRow | null> {
  const rows = await sql`SELECT * FROM message_threads WHERE id = ${id} LIMIT 1`
  return rows[0] as MessageThreadRow || null
}

export async function getMessageThreadByThreadId(projectId: string, threadId: string): Promise<MessageThreadRow | null> {
  const rows = await sql`
    SELECT * FROM message_threads
    WHERE project_id = ${projectId} AND thread_id = ${threadId}
    LIMIT 1
  `
  return rows[0] as MessageThreadRow || null
}

export async function updateThreadContactCompany(id: string, contactId: string | null, companyId: string | null): Promise<void> {
  await sql`
    UPDATE message_threads
    SET contact_id = ${contactId}, company_id = ${companyId}, updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function updateThreadIntent(id: string, intent: string, isForwarded: boolean, confidenceScore: number | null): Promise<void> {
  await sql`
    UPDATE message_threads
    SET intent = ${intent}, is_forwarded = ${isForwarded}, confidence_score = ${confidenceScore}, updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function updateThreadProcessorType(id: string, processorType: string, quoteValue: number | null): Promise<void> {
  await sql`
    UPDATE message_threads
    SET processor_type = ${processorType}, quote_value = ${quoteValue}, updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function updateThreadProcessingTime(id: string, processingTimeMs: number): Promise<void> {
  await sql`
    UPDATE message_threads
    SET processing_time_ms = ${processingTimeMs}, updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function updateThreadTokens(id: string, tokensInbound: number, tokensProcessing: number, tokensOutbound: number): Promise<void> {
  await sql`
    UPDATE message_threads
    SET tokens_inbound = ${tokensInbound}, tokens_processing = ${tokensProcessing}, tokens_outbound = ${tokensOutbound}, updated_at = NOW()
    WHERE id = ${id}
  `
}
