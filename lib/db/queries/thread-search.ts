import { sql } from '../client'
import type { ActivityFeedRow } from './activity-feed'

export async function searchThreads(tenantId: string, query: string): Promise<ActivityFeedRow[]> {
  const q = `%${query}%`
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
      AND (
        c.name ILIKE ${q}
        OR c.email ILIKE ${q}
        OR co.business_name ILIKE ${q}
        OR mt.thread_id ILIKE ${q}
      )
    ORDER BY mt.created_at DESC
    LIMIT 50
  `
  return rows as ActivityFeedRow[]
}
