import { sql } from '../client'
import type { MessageArtifactRow } from '../../types/database'

export async function createArtifact(data: {
  tenantId: string
  projectId: string
  threadId: string
  artifactType: string
  artifactData: Record<string, unknown>
  sequenceOrder: number
}): Promise<MessageArtifactRow> {
  const rows = await sql`
    INSERT INTO message_artifacts (tenant_id, project_id, thread_id, artifact_type, artifact_data, sequence_order)
    VALUES (${data.tenantId}, ${data.projectId}, ${data.threadId}, ${data.artifactType}, ${JSON.stringify(data.artifactData)}, ${data.sequenceOrder})
    ON CONFLICT (thread_id, sequence_order) DO UPDATE
      SET artifact_data = EXCLUDED.artifact_data
    RETURNING *
  `
  return rows[0] as MessageArtifactRow
}

export async function getArtifactsByThreadId(threadId: string): Promise<MessageArtifactRow[]> {
  const rows = await sql`
    SELECT * FROM message_artifacts
    WHERE thread_id = ${threadId}
    ORDER BY sequence_order ASC
  `
  return rows as MessageArtifactRow[]
}

export async function getNextSequenceOrder(threadId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_order
    FROM message_artifacts
    WHERE thread_id = ${threadId}
  `
  return rows[0].next_order as number
}
