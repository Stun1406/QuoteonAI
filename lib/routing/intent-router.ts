import { processDrayage } from '../processors/drayage-processor'
import { processWarehouse } from '../processors/warehouse-processor'
import { processLastMile } from '../processors/last-mile-processor'
import { processGeneralInquiry } from '../processors/general-processor'
import type { PreprocessResult, LogisticsFlow } from '../types/preprocessor'
import type { ProcessorResult, HybridComponent, HybridResponseData } from '../types/processor'

interface RouterOptions {
  tenantId: string
  projectId: string
  threadId: string
  priorProcessorResult?: ProcessorResult | null
  rawMessage: string
  discountPct?: number
}

export async function routeMessage(
  preprocessResult: PreprocessResult,
  options: RouterOptions
): Promise<ProcessorResult> {
  const flows = preprocessResult.classifiedIntent.flows
  const uniqueFlows = [...new Set(flows)] as LogisticsFlow[]

  // No logistics flows — general inquiry
  if (uniqueFlows.length === 0 || preprocessResult.classifiedIntent.overall !== 'quote') {
    return processGeneralInquiry(preprocessResult, options)
  }

  // Single flow
  if (uniqueFlows.length === 1) {
    const flow = uniqueFlows[0]
    return routeSingleFlow(flow, preprocessResult, options)
  }

  // Hybrid — multiple flows
  return routeHybrid(uniqueFlows, preprocessResult, options)
}

async function routeSingleFlow(
  flow: LogisticsFlow,
  preprocessResult: PreprocessResult,
  options: RouterOptions
): Promise<ProcessorResult> {
  switch (flow) {
    case 'drayage':
      return processDrayage(preprocessResult, options)
    case 'warehousing':
    case 'transloading':
      return processWarehouse(preprocessResult, { ...options, discountPct: options.discountPct ?? 0 })
    case 'last-mile':
      return processLastMile(preprocessResult, options)
    default:
      return processGeneralInquiry(preprocessResult, options)
  }
}

async function routeHybrid(
  flows: LogisticsFlow[],
  preprocessResult: PreprocessResult,
  options: RouterOptions
): Promise<ProcessorResult> {
  const startTime = Date.now()
  const components: HybridComponent[] = []
  const totalsByFlow: Partial<Record<LogisticsFlow, number>> = {}

  for (const flow of flows) {
    const result = await routeSingleFlow(flow, preprocessResult, options)
    let flowTotal = 0

    if (result.responseData.type === 'drayage') {
      flowTotal = result.responseData.quote?.subtotal ?? 0
    } else if (result.responseData.type === 'warehousing') {
      flowTotal = result.responseData.result.total
    } else if (result.responseData.type === 'last-mile') {
      flowTotal = result.responseData.result.total
    }

    components.push({
      flow,
      processorType: result.processorType,
      responseData: result.responseData as HybridComponent['responseData'],
      total: flowTotal,
    })

    totalsByFlow[flow] = flowTotal
  }

  const combinedTotal = Object.values(totalsByFlow).reduce((sum, v) => sum + (v ?? 0), 0)

  const hybridData: HybridResponseData = {
    type: 'hybrid',
    components,
    combinedTotal,
    totalsByFlow,
  }

  return {
    processorType: 'hybrid',
    intent: preprocessResult.intent,
    contactInfo: preprocessResult.contactInfo,
    isForwarded: preprocessResult.isForwarded,
    responseData: hybridData,
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      discountPct: options.discountPct ?? 0,
    },
  }
}
