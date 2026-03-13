export type CustomerTier = 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TierInfo {
  tier: CustomerTier
  requestCount: number
  totalSpendUsd: number
  discountPct: number
}
