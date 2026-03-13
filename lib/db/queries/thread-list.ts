import { sql } from '../client'
import type { ActivityFeedRow } from './activity-feed'

export async function getThreadList(tenantId: string, page = 1, pageSize = 50): Promise<{
  rows: ActivityFeedRow[]
  total: number
}> {
  const offset = (page - 1) * pageSize

  const [rows, countRows] = await Promise.all([
    sql`
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
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    sql`SELECT COUNT(*) AS total FROM message_threads WHERE tenant_id = ${tenantId}`,
  ])

  return {
    rows: rows as ActivityFeedRow[],
    total: Number(countRows[0].total),
  }
}
