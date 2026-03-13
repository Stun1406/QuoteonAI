export interface LineItem {
  code: string
  description: string
  amount: number
}

export interface DrayageExtraction {
  city: string | null
  containerSize: '20' | '40' | '45' | '53' | null
  containerWeightLbs: number | null
  chassisDays: number | null
  chassisDaysWccp: number | null
  waitingHours: number | null
  liveUnloadHours: number | null
  rushRequest: boolean
  prepaidPierPass: boolean
  tcfCharge: boolean
  chassisSplitRequired: boolean
  extraStops: number
  notes: string[]
}

export interface DrayageCityRate {
  base: number
  dist: number
  requiresDropFee?: boolean
  dropFeeAmount?: number
}

export interface DrayageQuoteResult {
  city: string
  containerSize: string
  containerWeightLbs: number | null
  lineItems: LineItem[]
  subtotal: number
  basisNotes: string[]
  warnings: string[]
  isEstimated: boolean
  extraction: DrayageExtraction
}

export interface ContainerSpec {
  containerCount: number
  containerSize: '20ft' | '40ft' | '45ft' | '53ft' | null
  cargoPackaging: 'pallet' | 'loose-cargo' | null
  palletCount: number
  looseCargoCount: number
}

export interface QuoteExtraction {
  confirmationNeeded: string[]
  transloading: {
    enabled: boolean
    containers: ContainerSpec[]
    shrinkWrap: boolean
    shrinkWrapPalletCount?: number
    seal: boolean
    billOfLading: boolean
  }
  storage: {
    enabled: boolean
    palletCount: number
    palletSize: 'normal' | 'oversize' | null
    storageDurationDays: number
    monFriAfterHours: boolean
    satSun: boolean
  }
  laborHours?: number
}

export interface QuoteLineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  note?: string
}

export interface QuoteResult {
  lineItems: QuoteLineItem[]
  subtotal: number
  discountPct: number
  discountAmount: number
  total: number
  warnings: string[]
}
