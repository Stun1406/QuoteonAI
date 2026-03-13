import { extractWarehouseParameters } from '../llm/warehouse-extractor'
import { calculateWarehouseQuote } from '../pricing/calculator'
import type { PreprocessResult } from '../types/preprocessor'
import type { ProcessorResult, WarehousingResponseData } from '../types/processor'

interface WarehouseProcessorOptions {
  tenantId: string
  projectId: string
  threadId: string
  priorProcessorResult?: ProcessorResult | null
  rawMessage: string
  discountPct?: number
}

export async function processWarehouse(
  preprocessResult: PreprocessResult,
  options: WarehouseProcessorOptions
): Promise<ProcessorResult> {
  const startTime = Date.now()
  const { tenantId, projectId, threadId, rawMessage, discountPct = 0 } = options

  const extraction = await extractWarehouseParameters(rawMessage, { tenantId, projectId, threadId })
  const result = calculateWarehouseQuote(extraction, discountPct)

  const responseData: WarehousingResponseData = {
    type: 'warehousing',
    extracted: extraction,
    result,
  }

  return {
    processorType: 'warehousing',
    intent: preprocessResult.intent,
    contactInfo: preprocessResult.contactInfo,
    isForwarded: preprocessResult.isForwarded,
    responseData,
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      discountPct,
    },
  }
}
