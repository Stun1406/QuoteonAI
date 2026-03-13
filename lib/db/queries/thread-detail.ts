import { sql } from '../client'
import type { MessageThreadRow, MessageArtifactRow, LlmCallRow, ContactRow, CompanyRow } from '../../types/database'

export interface ThreadDetailResult {
  thread: MessageThreadRow
  contact: ContactRow | null
  company: CompanyRow | null
  artifacts: MessageArtifactRow[]
  llmCalls: LlmCallRow[]
}

export async function getThreadDetail(threadUuid: string): Promise<ThreadDetailResult | null> {
  const threadRows = await sql`
    SELECT * FROM message_threads WHERE id = ${threadUuid} LIMIT 1
  `
  if (threadRows.length === 0) return null
  const thread = threadRows[0] as MessageThreadRow

  const [contactRows, companyRows, artifactRows, llmCallRows] = await Promise.all([
    thread.contact_id
      ? sql`SELECT * FROM contacts WHERE id = ${thread.contact_id} LIMIT 1`
      : Promise.resolve([]),
    thread.company_id
      ? sql`SELECT * FROM companies WHERE id = ${thread.company_id} LIMIT 1`
      : Promise.resolve([]),
    sql`SELECT * FROM message_artifacts WHERE thread_id = ${threadUuid} ORDER BY sequence_order ASC`,
    sql`SELECT * FROM llm_calls WHERE thread_id = ${threadUuid} ORDER BY created_at ASC`,
  ])

  return {
    thread,
    contact: contactRows[0] as ContactRow || null,
    company: companyRows[0] as CompanyRow || null,
    artifacts: artifactRows as MessageArtifactRow[],
    llmCalls: llmCallRows as LlmCallRow[],
  }
}
