import { sql } from '../client'
import type { CustomerTier, TierInfo } from '../../types/tier'

export async function getCompanyTier(data: {
  tenantId: string
  companyId: string | null
}): Promise<TierInfo> {
  if (!data.companyId) {
    return { tier: 'unranked', requestCount: 0, totalSpendUsd: 0, discountPct: 0 }
  }

  const rows = await sql`
    SELECT
      COUNT(*) AS request_count,
      COALESCE(SUM(COALESCE(won_value, quote_value)), 0) AS total_spend
    FROM message_threads
    WHERE tenant_id = ${data.tenantId}
      AND company_id = ${data.companyId}
      AND status != 'lost'
  `

  const requestCount = Number(rows[0].request_count)
  const totalSpend = Number(rows[0].total_spend)

  const tier = calculateTier(totalSpend)
  const discountPct = getDiscountPct(tier)

  return {
    tier,
    requestCount,
    totalSpendUsd: totalSpend,
    discountPct,
  }
}

function calculateTier(totalSpend: number): CustomerTier {
  if (totalSpend >= 20000) return 'platinum'
  if (totalSpend >= 15000) return 'gold'
  if (totalSpend >= 10000) return 'silver'
  if (totalSpend >= 5000) return 'bronze'
  return 'unranked'
}

export function getDiscountPct(tier: CustomerTier): number {
  switch (tier) {
    case 'platinum': return 8
    case 'gold': return 6
    case 'silver': return 4
    case 'bronze': return 2
    default: return 0
  }
}
