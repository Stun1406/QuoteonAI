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
  // But if logistics flows were detected, route them even if overall isn't 'quote'
  // to avoid the LLM general formatter generating fake placeholder prices
  if (uniqueFlows.length === 0) {
    return processGeneralInquiry(preprocessResult, options)
  }

  if (preprocessResult.classifiedIntent.overall !== 'quote' && preprocessResult.intent === 'other') {
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

  // Run each flow and track results + totals together
  const flowResults: Array<{ flow: LogisticsFlow; result: ProcessorResult; total: number }> = []

  for (const flow of flows) {
    const result = await routeSingleFlow(flow, preprocessResult, options)
    let total = 0

    if (result.responseData.type === 'drayage') {
      total = result.responseData.quote?.subtotal ?? 0
    } else if (result.responseData.type === 'warehousing') {
      total = result.responseData.result.total
    } else if (result.responseData.type === 'last-mile') {
      total = result.responseData.result.total
    }

    flowResults.push({ flow, result, total })
  }

  const nonZero = flowResults.filter(r => r.total > 0)

  // If only one flow produced a real quote, return it directly (avoids $0.00 hybrid wrapper)
  if (nonZero.length === 1) {
    return nonZero[0].result
  }

  // If no flow produced anything, return the primary flow so the formatter can show
  // a proper "missing fields" message instead of a $0.00 combined total
  if (nonZero.length === 0) {
    const primaryFlow = preprocessResult.classifiedIntent.primaryFlow ?? flows[0]
    const primary = flowResults.find(r => r.flow === primaryFlow) ?? flowResults[0]
    return primary.result
  }

  // Multiple flows with real data — build proper hybrid result
  const components: HybridComponent[] = flowResults.map(r => ({
    flow: r.flow,
    processorType: r.result.processorType,
    responseData: r.result.responseData as HybridComponent['responseData'],
    total: r.total,
  }))

  const totalsByFlow: Partial<Record<LogisticsFlow, number>> = {}
  for (const r of flowResults) {
    totalsByFlow[r.flow] = r.total
  }
  const combinedTotal = nonZero.reduce((sum, r) => sum + r.total, 0)

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
