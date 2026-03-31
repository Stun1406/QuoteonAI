import { formatProcessorResult } from '../llm/formatter'
import { addArtifactToThread } from '../db/services/thread-service'
import { getNextSequenceOrder } from '../db/tables/artifact'
import type { ProcessorResult } from '../types/processor'

export interface FormatResponseParams {
  payload: ProcessorResult
  originalRequest: string
  threadId: string
  tenantId: string
  projectId: string
}

export interface FormatResponseResult {
  markdown: string
  html: string
  plainText: string
  subject: string
}

export async function formatResponse(params: FormatResponseParams): Promise<FormatResponseResult> {
  const { payload, originalRequest, threadId, tenantId, projectId } = params

  const context = { tenantId, projectId, threadId }
  const formatted = await formatProcessorResult(payload, originalRequest, context)

  // Store markdown artifact (get one base seq, HTML gets base+1)
  const baseSeq = await getNextSequenceOrder(threadId)
  await addArtifactToThread({
    threadId,
    tenantId,
    projectId,
    type: 'markdown',
    data: {
      content: formatted.markdown,
      subject: formatted.subject,
    },
    sequenceOrder: baseSeq,
  })

  // Store HTML artifact
  await addArtifactToThread({
    threadId,
    tenantId,
    projectId,
    type: 'html',
    data: {
      content: formatted.html,
      subject: formatted.subject,
    },
    sequenceOrder: baseSeq + 1,
  })

  return {
    markdown: formatted.markdown,
    html: formatted.html,
    plainText: formatted.plainText,
    subject: formatted.subject,
  }
}
