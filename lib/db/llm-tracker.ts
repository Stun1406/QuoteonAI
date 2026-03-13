import { createLlmCall } from './tables/llm-call'
import { updateThreadTokens } from './tables/thread'
import { getThreadTokenTotals } from './tables/llm-call'

export interface TrackLlmCallParams {
  tenantId: string
  projectId: string
  threadId: string
  callType: string
  callStage: 'inbound' | 'processing' | 'outbound'
  model: string
  promptTokens: number
  completionTokens: number
  responseTimeMs?: number
  metadata?: Record<string, unknown>
}

export async function trackLlmCall(params: TrackLlmCallParams): Promise<void> {
  const totalTokens = params.promptTokens + params.completionTokens

  await createLlmCall({
    tenantId: params.tenantId,
    projectId: params.projectId,
    threadId: params.threadId,
    callType: params.callType,
    callStage: params.callStage,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens,
    responseTimeMs: params.responseTimeMs,
    metadata: params.metadata,
  })

  // Update thread token counts
  const totals = await getThreadTokenTotals(params.threadId)
  await updateThreadTokens(
    params.threadId,
    totals.inbound,
    totals.processing,
    totals.outbound
  )
}
