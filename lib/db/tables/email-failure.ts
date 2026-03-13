import { sql } from '../client'
import type { EmailFailureRow } from '../../types/database'

export async function createEmailFailure(data: {
  stage: string
  statusCode: number
  message: string
  details?: string | null
  context?: Record<string, unknown>
}): Promise<EmailFailureRow> {
  const rows = await sql`
    INSERT INTO email_failures (stage, status_code, message, details, context)
    VALUES (${data.stage}, ${data.statusCode}, ${data.message}, ${data.details ?? null}, ${JSON.stringify(data.context ?? {})})
    RETURNING *
  `
  return rows[0] as EmailFailureRow
}

export async function listEmailFailures(limit = 50): Promise<EmailFailureRow[]> {
  const rows = await sql`SELECT * FROM email_failures ORDER BY created_at DESC LIMIT ${limit}`
  return rows as EmailFailureRow[]
}
