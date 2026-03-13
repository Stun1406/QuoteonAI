import type { LastMileExtraction, LastMileResult } from '../types/processor'

export const LAST_MILE_BASE_RATES = [
  { id: 'last-mile.base.per-mile-tier-1', label: 'Per Mile (0–50 mi)', amount: 3.50, unit: 'USD/mile' },
  { id: 'last-mile.base.per-mile-tier-2', label: 'Per Mile (50+ mi)', amount: 2.75, unit: 'USD/mile' },
  { id: 'last-mile.base.minimum', label: 'Minimum Charge', amount: 150, unit: 'USD' },
]

export const LAST_MILE_MODIFIERS = [
  { id: 'last-mile.modifier.liftgate', label: 'Liftgate', amount: 85, unit: 'USD/move' },
  { id: 'last-mile.modifier.residential', label: 'Residential Delivery', amount: 45, unit: 'USD/move' },
  { id: 'last-mile.modifier.reefer', label: 'Reefer / Temp Control', amount: 75, unit: 'USD/move' },
  { id: 'last-mile.modifier.hazmat', label: 'Hazmat', amount: 100, unit: 'USD/move' },
  { id: 'last-mile.modifier.oversize', label: 'Oversize / Overweight', amount: 150, unit: 'USD/move' },
  { id: 'last-mile.modifier.high-value', label: 'High Value / Secure', amount: 75, unit: 'USD/move' },
  { id: 'last-mile.modifier.extra-stop', label: 'Extra Stop', amount: 65, unit: 'USD/stop' },
]

export function calculateLastMileQuote(extraction: LastMileExtraction): LastMileResult {
  const lineItems: Array<{ description: string; amount: number }> = []

  const miles = extraction.miles ?? 0

  // Base mileage rate
  if (miles > 0) {
    let mileageCost: number
    if (miles <= 50) {
      mileageCost = miles * 3.50
    } else {
      mileageCost = 50 * 3.50 + (miles - 50) * 2.75
    }
    lineItems.push({ description: `Mileage (${miles} miles)`, amount: +mileageCost.toFixed(2) })
  }

  if (extraction.liftgate) {
    lineItems.push({ description: 'Liftgate', amount: 85 })
  }

  if (extraction.residential) {
    lineItems.push({ description: 'Residential Delivery', amount: 45 })
  }

  if (extraction.reefer) {
    lineItems.push({ description: 'Reefer / Temperature Control', amount: 75 })
  }

  if (extraction.hazmat) {
    lineItems.push({ description: 'Hazmat', amount: 100 })
  }

  if (extraction.stops > 1) {
    const extraStops = extraction.stops - 1
    lineItems.push({ description: `Extra Stop(s) (${extraStops})`, amount: extraStops * 65 })
  }

  if (extraction.oversize) {
    lineItems.push({ description: 'Oversize / Overweight', amount: 150 })
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0)
  const total = Math.max(subtotal, 150) // minimum charge

  if (total > subtotal) {
    lineItems.push({ description: 'Minimum Charge Applied', amount: total - subtotal })
  }

  return { lineItems, subtotal: +subtotal.toFixed(2), total: +total.toFixed(2) }
}
