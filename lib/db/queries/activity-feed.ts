import { sql } from '../client'

export interface ActivityFeedRow {
  id: string
  thread_id: string
  created_at: string
  updated_at: string
  intent: string
  processor_type: string
  quote_value: number | null
  processing_time_ms: number | null
  is_forwarded: boolean
  tokens_total: number
  status: string
  confidence_score: number | null
  contact_name: string | null
  contact_email: string | null
  company_name: string | null
}

export async function getActivityFeed(tenantId: string, limit = 100, offset = 0): Promise<ActivityFeedRow[]> {
  const rows = await sql`
    SELECT
      mt.id,
      mt.thread_id,
      mt.created_at,
      mt.updated_at,
      mt.intent,
      mt.processor_type,
      mt.quote_value,
      mt.processing_time_ms,
      mt.is_forwarded,
      mt.tokens_total,
      mt.status,
      mt.confidence_score,
      c.name AS contact_name,
      c.email AS contact_email,
      co.business_name AS company_name
    FROM message_threads mt
    LEFT JOIN contacts c ON mt.contact_id = c.id
    LEFT JOIN companies co ON mt.company_id = co.id
    WHERE mt.tenant_id = ${tenantId}
    ORDER BY mt.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
  return rows as ActivityFeedRow[]
}

export async function getActivityFeedStats(tenantId: string): Promise<{
  total: number
  totalQuoteValue: number
  avgProcessingTimeMs: number
  totalTokens: number
}> {
  const rows = await sql`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(quote_value), 0) AS total_quote_value,
      COALESCE(AVG(processing_time_ms), 0) AS avg_processing_time,
      COALESCE(SUM(tokens_total), 0) AS total_tokens
    FROM message_threads
    WHERE tenant_id = ${tenantId}
  `
  return {
    total: Number(rows[0].total),
    totalQuoteValue: Number(rows[0].total_quote_value),
    avgProcessingTimeMs: Number(rows[0].avg_processing_time),
    totalTokens: Number(rows[0].total_tokens),
  }
}
