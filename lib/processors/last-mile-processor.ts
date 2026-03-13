import { extractLastMileParameters } from '../llm/last-mile-extractor'
import { calculateLastMileQuote } from '../pricing/last-mile'
import type { PreprocessResult } from '../types/preprocessor'
import type { ProcessorResult, LastMileResponseData } from '../types/processor'

interface LastMileProcessorOptions {
  tenantId: string
  projectId: string
  threadId: string
  rawMessage: string
}

export async function processLastMile(
  preprocessResult: PreprocessResult,
  options: LastMileProcessorOptions
): Promise<ProcessorResult> {
  const startTime = Date.now()
  const { tenantId, projectId, threadId, rawMessage } = options

  const extraction = await extractLastMileParameters(rawMessage, { tenantId, projectId, threadId })
  const result = calculateLastMileQuote(extraction)

  const responseData: LastMileResponseData = {
    type: 'last-mile',
    extracted: extraction,
    result,
  }

  return {
    processorType: 'last-mile',
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
