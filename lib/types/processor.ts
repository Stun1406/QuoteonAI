import type { ContactInfo, MessageIntent, LogisticsFlow } from './preprocessor'
import type { CustomerTier } from './tier'
import type { DrayageExtraction, DrayageQuoteResult, QuoteExtraction, QuoteResult } from './quote'

export type ProcessorType = 'warehousing' | 'drayage' | 'last-mile' | 'general' | 'hybrid' | 'fallback'

export interface DrayageResponseData {
  type: 'drayage'
  quote: DrayageQuoteResult | null
  missingFields?: string[]
  notes?: string[]
  extracted?: DrayageExtraction
}

export interface WarehousingResponseData {
  type: 'warehousing'
  extracted: QuoteExtraction
  result: QuoteResult
}

export interface LastMileResponseData {
  type: 'last-mile'
  extracted: LastMileExtraction
  result: LastMileResult
}

export interface LastMileExtraction {
  miles: number | null
  stops: number
  liftgate: boolean
  residential: boolean
  reefer: boolean
  hazmat: boolean
  oversize: boolean
  notes: string[]
}

export interface LastMileResult {
  lineItems: Array<{ description: string; amount: number }>
  subtotal: number
  total: number
}

export interface GeneralResponseData {
  type: 'general'
  response: string
}

export interface HybridComponent {
  flow: LogisticsFlow
  processorType: ProcessorType
  responseData: DrayageResponseData | WarehousingResponseData | LastMileResponseData
  total: number
}

export interface HybridResponseData {
  type: 'hybrid'
  components: HybridComponent[]
  combinedTotal: number
  totalsByFlow: Partial<Record<LogisticsFlow, number>>
}

export interface ProcessorResult {
  processorType: ProcessorType
  intent: MessageIntent
  contactInfo: ContactInfo
  isForwarded: boolean
  responseData: DrayageResponseData | WarehousingResponseData | LastMileResponseData | GeneralResponseData | HybridResponseData
  metadata: {
    processedAt: string
    processingTimeMs: number
    customerTier?: CustomerTier
    companyRequestCount?: number
    companySpendUsd?: number
    discountPct?: number
    discountRequested?: boolean
  }
}
