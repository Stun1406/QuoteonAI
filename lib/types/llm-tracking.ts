export interface LlmCallRecord {
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
}
