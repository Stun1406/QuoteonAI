import {
  DRAYAGE_CITY_RATES, DRAYAGE_BASE_ADD_ONS, DRAYAGE_INVOICE_ADD_ONS,
  DRAYAGE_WEIGHT_SURCHARGES, DRAYAGE_FLAT_FEES,
} from './drayage'
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

export function getDefaultPricingLogicCatalog(): PricingLogicRate[] {
  const items: PricingLogicRate[] = []

  // ── DRAYAGE ACCESSORIALS (PDF order: CHN Rate Sheet page 1) ──────────────
  items.push(r('drayage.addons.pier-pass',    'Drayage', 'Prepaid Pier Pass',                    'USD/move', 80))
  items.push(r('drayage.addons.tcf',          'Drayage', 'TCF (Terminal Clean Fuel)',             'USD/move', 20))
  items.push(r('drayage.invoice-addons.chassis-per-day',      'Drayage', 'Chassis Per Day (min. 2 days)',     'USD/day',  45))
  items.push(r('drayage.invoice-addons.wccp-per-day',         'Drayage', 'WCCP Chassis Per Day (5–15 days)', 'USD/day',  75))
  items.push(r('drayage.addons.chassis-split','Drayage', 'Chassis Split',                         'USD/move', 100))
  items.push(r('drayage.flat.storage-per-day','Drayage', 'Storage Fee',                           'USD/day',  50,  'Pick up and delivery day is free'))
  items.push(r('drayage.flat.empty-storage',  'Drayage', 'Empty Storage Fee',                     'USD/day',  50,  'Applies when nowhere to return empty container in yard over 2 days'))
  items.push(r('drayage.flat.prepull',        'Drayage', 'Prepull',                               'USD/move', 150, 'Delivery is not the same day as pick up'))
  items.push(r('drayage.flat.dry-run',        'Drayage', 'Dry Run Terminal Charge',               'USD/move', 150))
  items.push(r('drayage.addons.rush-request', 'Drayage', 'Rush Fee',                              'USD/move', 200, 'If not received 48 hours before LFD'))
  items.push(r('drayage.invoice-addons.extra-stop',           'Drayage', 'Extra Stop',                        'USD/stop', 150))
  items.push(r('drayage.flat.exam-fee',       'Drayage', 'Exam Fee',                              'USD',      350, '$65/hour waiting time as needed (except free 1 hour)'))
  items.push(r('drayage.invoice-addons.waiting-per-hour',     'Drayage', 'Terminal Waiting Time', 'USD/hour', 65,  'Free 2 hours from waiting line'))
  items.push(r('drayage.invoice-addons.live-unload-per-hour', 'Drayage', 'Live Unload',           'USD/hour', 85,  'Free 1 hour from waiting line'))
  items.push(r('drayage.flat.re-plug-in',     'Drayage', 'Re Plug In',                            'USD/move', 85))

  // Weight surcharges
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

  items.push(r('drayage.flat.do-cancellation',  'Drayage', 'DO Cancellation',           'USD', 50))
  items.push(r('drayage.flat.on-time-delivery', 'Drayage', 'On Time Delivery Service',  'USD/move', 150))

  // ── DRAYAGE CITY RATES (alphabetical, matching PDF pages 2–3) ────────────
  for (const [city, rate] of Object.entries(DRAYAGE_CITY_RATES)) {
    const slug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const dropNote = rate.requiresDropFee ? `+$${rate.dropFeeAmount ?? 150} Drop Fee` : undefined
    items.push(r(`drayage.city.${slug}`, 'Drayage', `${city} Base Rate`, 'USD', rate.base, dropNote))
  }

  // ── TRANSLOADING (PDF order: FLD Rate Sheet) ──────────────────────────────
  items.push(r('transloading.palletized.20ft',         'Transloading', "Palletized — 20'",                        'USD/container', TRANSLOADING_RATES.palletized['20ft']))
  items.push(r('transloading.palletized.40ft',         'Transloading', "Palletized — 40'/45'",                    'USD/container', TRANSLOADING_RATES.palletized['40ft']))
  items.push(r('transloading.loose-cargo.tier-1',      'Transloading', 'Loose Cargo — 1–500 pcs',                 'USD/container', TRANSLOADING_RATES.looseCargo.tier1.rate))
  items.push(r('transloading.loose-cargo.tier-2',      'Transloading', 'Loose Cargo — 501–1,000 pcs',             'USD/container', TRANSLOADING_RATES.looseCargo.tier2.rate))
  items.push(r('transloading.loose-cargo.tier-3',      'Transloading', 'Loose Cargo — 1,001–1,500 pcs',           'USD/container', TRANSLOADING_RATES.looseCargo.tier3.rate))
  items.push(r('transloading.loose-cargo.per-pc',      'Transloading', 'Loose Cargo — 1,501+ pcs',                'USD/pc',        TRANSLOADING_RATES.looseCargo.tier4.ratePerPc))
  items.push(r('transloading.palletize-shrink-wrap',   'Transloading', 'Palletize + Shrink Wrap',                 'USD/pallet',    TRANSLOADING_RATES.palletizeShrinkWrap))
  items.push(r('transloading.seal',                    'Transloading', 'Seal',                                    'USD/seal',      TRANSLOADING_RATES.seal))
  items.push(r('transloading.bol',                     'Transloading', 'Bill of Lading',                          'USD/BOL',       TRANSLOADING_RATES.billOfLading))

  // ── WAREHOUSING / STORAGE (PDF order: FLD Rate Sheet) ─────────────────────
  items.push(r('warehousing.handling-in-out',           'Warehousing', 'Handling In & Out',                       'USD/pallet',       STORAGE_RATES.handlingInOutPerPallet))
  items.push(r('warehousing.after-hours-monfri',        'Warehousing', 'After-Hours Open Fee (Mon–Fri)',           'USD/open',         STORAGE_RATES.afterHoursMonFri))
  items.push(r('warehousing.weekend-satsun',            'Warehousing', 'Warehouse Open Fee (Sat–Sun)',             'USD/open',         STORAGE_RATES.weekendSatSun))
  items.push(r('warehousing.storage.normal-pallet',     'Warehousing', 'Monthly Storage — 40x48x60 and under',    'USD/pallet/month', STORAGE_RATES.normalPalletPerMonth))
  items.push(r('warehousing.storage.oversize-pallet',   'Warehousing', 'Monthly Storage — 40x48x61 and over',     'USD/pallet/month', STORAGE_RATES.oversizePalletPerMonth))
  items.push(r('warehousing.storage.per-sqft',          'Warehousing', 'Monthly Storage per Sq Ft',               'USD/sqft/month',   STORAGE_RATES.storagePerSqFtPerMonth))
  items.push(r('warehousing.storage.weekly-per-pallet', 'Warehousing', 'Weekly Storage per Pallet (days 3–7)',    'USD/pallet/week',  STORAGE_RATES.weeklyStoragePerPallet, 'First 48 hrs free'))
  items.push(r('warehousing.labor-segregation',         'Warehousing', 'Labor / Segregation (after 2 hrs)',       'USD/hr/worker',    TRANSLOADING_RATES.laborAfter2hrsPerWorker))

  // ── LAST MILE ─────────────────────────────────────────────────────────────
  for (const rate of LAST_MILE_BASE_RATES) {
    items.push(r(rate.id, 'Last Mile', rate.label, rate.unit, rate.amount))
  }
  for (const mod of LAST_MILE_MODIFIERS) {
    items.push(r(mod.id, 'Last Mile', mod.label, mod.unit, mod.amount))
  }

  return items
}

// Category order for filter dropdown
export const PRICING_CATEGORY_ORDER = ['Drayage', 'Transloading', 'Warehousing', 'Last Mile']

export type { PricingLogicRate as PricingLogicCatalogItem }
