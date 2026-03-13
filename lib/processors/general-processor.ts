import type { PreprocessResult } from '../types/preprocessor'
import type { ProcessorResult, GeneralResponseData } from '../types/processor'

interface GeneralProcessorOptions {
  tenantId: string
  projectId: string
  threadId: string
  rawMessage: string
}

export async function processGeneralInquiry(
  preprocessResult: PreprocessResult,
  options: GeneralProcessorOptions
): Promise<ProcessorResult> {
  const startTime = Date.now()

  // Response will be generated later by the formatter
  const responseData: GeneralResponseData = {
    type: 'general',
    response: '',
  }

  return {
    processorType: 'general',
    intent: preprocessResult.intent,
    contactInfo: preprocessResult.contactInfo,
    isForwarded: preprocessResult.isForwarded,
    responseData,
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    },
  }
}
