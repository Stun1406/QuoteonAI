import { sql } from './db/client'

export interface EmailFailureData {
  stage: string
  statusCode: number
  message: string
  details?: string
  context?: Record<string, unknown>
}

export async function logEmailFailure(data: EmailFailureData): Promise<void> {
  try {
    await sql`
      INSERT INTO email_failures (stage, status_code, message, details, context)
      VALUES (${data.stage}, ${data.statusCode}, ${data.message}, ${data.details ?? null}, ${JSON.stringify(data.context ?? {})})
    `
  } catch (err) {
    // Don't throw — failure logging must not crash the pipeline
    console.error('[email-failure-log] Failed to log:', err)
  }
}
