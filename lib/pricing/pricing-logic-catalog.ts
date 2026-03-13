import { DRAYAGE_CITY_RATES, DRAYAGE_BASE_ADD_ONS, DRAYAGE_INVOICE_ADD_ONS, DRAYAGE_WEIGHT_SURCHARGES } from './drayage'
import { LAST_MILE_BASE_RATES, LAST_MILE_MODIFIERS } from './last-mile'
import { TRANSLOADING_RATES, STORAGE_RATES } from './pricing-data'

export type PricingLogicRate = {
  id: string
  category: string
  label: string
  unit: string
  defaultValue: number
  currentValue: number
  source: string
  note?: string
  updatedAt?: string
  lastComment?: string
}

function r(id: string, category: string, label: string, unit: string, value: number, note?: string): PricingLogicRate {
  return { id, category, label, unit, defaultValue: value, currentValue: value, source: 'rate-sheet', note }
}

const CATEGORY_ORDER = ['Transloading', 'Drayage', 'Warehousing', 'Last Mile']

export function comparePricingLogicCatalogItems(a: PricingLogicRate, b: PricingLogicRate): number {
  const ai = CATEGORY_ORDER.indexOf(a.category)
  const bi = CATEGORY_ORDER.indexOf(b.category)
  const aOrd = ai === -1 ? 99 : ai
  const bOrd = bi === -1 ? 99 : bi
  if (aOrd !== bOrd) return aOrd - bOrd
  return a.id.localeCompare(b.id)
}

export function getDefaultPricingLogicCatalog(): PricingLogicRate[] {
  const items: PricingLogicRate[] = []

  // Transloading
  items.push(r('transloading.pallet.first-20', 'Transloading', 'Pallet Handling (first 20)', 'USD/pallet', TRANSLOADING_RATES.normalPalletFirst20))
  items.push(r('transloading.pallet.after-20', 'Transloading', 'Pallet Handling (after 20)', 'USD/pallet', TRANSLOADING_RATES.normalPalletAfter20))
  items.push(r('transloading.pallet.oversize', 'Transloading', 'Oversize Pallet Handling', 'USD/pallet', TRANSLOADING_RATES.oversizePallet))
  items.push(r('transloading.loose-cargo.tier-1', 'Transloading', 'Loose Cargo (≤50 cartons)', 'USD/carton', TRANSLOADING_RATES.looseCargo.tier1.rate))
  items.push(r('transloading.loose-cargo.tier-2', 'Transloading', 'Loose Cargo (51–200 cartons)', 'USD/carton', TRANSLOADING_RATES.looseCargo.tier2.rate))
  items.push(r('transloading.loose-cargo.tier-3', 'Transloading', 'Loose Cargo (200+ cartons)', 'USD/carton', TRANSLOADING_RATES.looseCargo.tier3.rate))
  items.push(r('transloading.shrink-wrap', 'Transloading', 'Shrink Wrap', 'USD/pallet', TRANSLOADING_RATES.shrinkWrapPerPallet))
  items.push(r('transloading.bol', 'Transloading', 'Bill of Lading', 'USD/BOL', TRANSLOADING_RATES.bolPerBol))
  items.push(r('transloading.seal', 'Transloading', 'Seal', 'USD/seal', TRANSLOADING_RATES.sealPerSeal))

  // Drayage city rates
  for (const [city, rate] of Object.entries(DRAYAGE_CITY_RATES)) {
    const slug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    items.push(r(`drayage.city.${slug}`, 'Drayage', `${city} Base Rate`, 'USD', rate.base))
  }

  // Drayage add-ons
  for (const addon of DRAYAGE_BASE_ADD_ONS) {
    items.push(r(addon.id, 'Drayage', addon.label, addon.unit, addon.amount))
  }
  for (const addon of DRAYAGE_INVOICE_ADD_ONS) {
    items.push(r(addon.id, 'Drayage', addon.label, addon.unit, addon.amount))
  }

  // Drayage weight surcharges
  for (const ws of DRAYAGE_WEIGHT_SURCHARGES) {
    const maxLabel = ws.maxLbs === Infinity ? '+' : `–${ws.maxLbs.toLocaleString()}`
    items.push(r(
      `drayage.weight.${ws.minLbs}`,
      'Drayage',
      `Overweight Surcharge (${ws.minLbs.toLocaleString()}${maxLabel} lbs)`,
      'USD',
      ws.surcharge
    ))
  }

  // Warehousing / Storage
  items.push(r('warehousing.storage.normal-pallet', 'Warehousing', 'Normal Pallet Storage', 'USD/pallet/month', STORAGE_RATES.normalPalletPerMonth))
  items.push(r('warehousing.storage.oversize-pallet', 'Warehousing', 'Oversize Pallet Storage', 'USD/pallet/month', STORAGE_RATES.oversizePalletPerMonth))
  items.push(r('warehousing.storage.after-hours-monfri', 'Warehousing', 'After-Hours Access (Mon–Fri)', 'USD/month', STORAGE_RATES.afterHoursMonFri))
  items.push(r('warehousing.storage.weekend-satsun', 'Warehousing', 'Weekend Access (Sat–Sun)', 'USD/month', STORAGE_RATES.weekendSatSun))

  // Last Mile
  for (const rate of LAST_MILE_BASE_RATES) {
    items.push(r(rate.id, 'Last Mile', rate.label, rate.unit, rate.amount))
  }
  for (const mod of LAST_MILE_MODIFIERS) {
    items.push(r(mod.id, 'Last Mile', mod.label, mod.unit, mod.amount))
  }

  return items.sort(comparePricingLogicCatalogItems)
}
