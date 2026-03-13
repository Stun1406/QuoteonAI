import {
  createMessageThread,
  getMessageThreadById,
  getMessageThreadByThreadId,
  updateThreadContactCompany,
  updateThreadIntent,
  updateThreadProcessorType,
  updateThreadProcessingTime,
  generateThreadId,
} from '../tables/thread'
import { createArtifact, getArtifactsByThreadId, getNextSequenceOrder } from '../tables/artifact'
import type { MessageThreadRow, MessageArtifactRow } from '../../types/database'
import type { PreprocessResult } from '../../types/preprocessor'

export async function createThread(data: {
  tenantId: string
  projectId: string
  contactId?: string | null
  companyId?: string | null
  preprocessResult: PreprocessResult
}): Promise<MessageThreadRow> {
  const threadId = generateThreadId()

  return createMessageThread({
    tenantId: data.tenantId,
    projectId: data.projectId,
    threadId,
    contactId: data.contactId ?? null,
    companyId: data.companyId ?? null,
    intent: data.preprocessResult.intent,
    processorType: 'pending',
    isForwarded: data.preprocessResult.isForwarded,
    confidenceScore: data.preprocessResult.confidence,
  })
}

export async function getThreadWithArtifacts(threadId: string): Promise<{
  thread: MessageThreadRow
  artifacts: MessageArtifactRow[]
} | null> {
  const thread = await getMessageThreadById(threadId)
  if (!thread) return null
  const artifacts = await getArtifactsByThreadId(threadId)
  return { thread, artifacts }
}

export async function addArtifactToThread(data: {
  threadId: string
  tenantId: string
  projectId: string
  type: string
  data: Record<string, unknown>
  sequenceOrder?: number
}): Promise<MessageArtifactRow> {
  const sequenceOrder = data.sequenceOrder ?? await getNextSequenceOrder(data.threadId)

  return createArtifact({
    tenantId: data.tenantId,
    projectId: data.projectId,
    threadId: data.threadId,
    artifactType: data.type,
    artifactData: data.data,
    sequenceOrder,
  })
}

export {
  getMessageThreadById,
  getMessageThreadByThreadId,
  updateThreadContactCompany,
  updateThreadIntent,
  updateThreadProcessorType,
  updateThreadProcessingTime,
}
