import { sql } from '../client'
import type { LlmCallRow } from '../../types/database'

export async function createLlmCall(data: {
  tenantId: string
  projectId: string
  threadId: string
  callType: string
  callStage: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  responseTimeMs?: number
  metadata?: Record<string, unknown>
}): Promise<LlmCallRow> {
  const rows = await sql`
    INSERT INTO llm_calls (
      tenant_id, project_id, thread_id, call_type, call_stage, model,
      prompt_tokens, completion_tokens, total_tokens, response_time_ms, metadata
    ) VALUES (
      ${data.tenantId}, ${data.projectId}, ${data.threadId},
      ${data.callType}, ${data.callStage}, ${data.model},
      ${data.promptTokens}, ${data.completionTokens}, ${data.totalTokens},
      ${data.responseTimeMs ?? null}, ${JSON.stringify(data.metadata ?? {})}
    )
    RETURNING *
  `
  return rows[0] as LlmCallRow
}

export async function getLlmCallsByThreadId(threadId: string): Promise<LlmCallRow[]> {
  const rows = await sql`
    SELECT * FROM llm_calls WHERE thread_id = ${threadId} ORDER BY created_at ASC
  `
  return rows as LlmCallRow[]
}

export async function getThreadTokenTotals(threadId: string): Promise<{ inbound: number; processing: number; outbound: number }> {
  const rows = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN call_stage = 'inbound' THEN total_tokens ELSE 0 END), 0) AS inbound,
      COALESCE(SUM(CASE WHEN call_stage = 'processing' THEN total_tokens ELSE 0 END), 0) AS processing,
      COALESCE(SUM(CASE WHEN call_stage = 'outbound' THEN total_tokens ELSE 0 END), 0) AS outbound
    FROM llm_calls WHERE thread_id = ${threadId}
  `
  return {
    inbound: Number(rows[0].inbound),
    processing: Number(rows[0].processing),
    outbound: Number(rows[0].outbound),
  }
}
