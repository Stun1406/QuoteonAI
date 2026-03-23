// ── Transloading rates (FL Distribution LLC Warehouse Rates) ─────────────────
// Flat rate per container based on size and cargo type
export const TRANSLOADING_RATES = {
  // Palletized: flat fee per container by size
  palletized: {
    '20ft': 235,
    '40ft': 335,
    '45ft': 335,
    '53ft': 335,
  } as Record<string, number>,

  // Loose cargo: flat fee per container by piece count tier
  looseCargo: {
    tier1: { maxPcs: 500,  rate: 170 },    // 1–500 pcs
    tier2: { maxPcs: 1000, rate: 230 },    // 501–1000 pcs
    tier3: { maxPcs: 1500, rate: 300 },    // 1001–1500 pcs
    tier4: { ratePerPc: 0.30 },            // 1501+ pcs ($0.30/pc)
  },

  // Accessorials
  palletizeShrinkWrap: 15,    // per pallet
  seal: 5,                    // per seal
  billOfLading: 5,            // per BOL
  laborAfter2hrsPerWorker: 35, // per hour per worker (after first 2 hrs)

  defaultPalletsPerContainer: {
    '20ft': 10,
    '40ft': 20,
    '45ft': 24,
    '53ft': 26,
  } as Record<string, number>,
}

// ── Storage / Warehousing rates ───────────────────────────────────────────────
export const STORAGE_RATES = {
  handlingInOutPerPallet: 22,         // per pallet (in + out)
  normalPalletPerMonth: 22,           // 40x48x60 and under
  oversizePalletPerMonth: 34,         // 40x48x61 and over
  storagePerSqFtPerMonth: 2.45,       // per sq ft per month
  weeklyStoragePerPallet: 7,          // days 3–7 (first 48 hrs free)
  afterHoursMonFri: 350,              // Mon–Fri after-hours open fee
  weekendSatSun: 550,                 // Sat–Sun open fee
}

export const TIER_DISCOUNTS: Record<string, number> = {
  unranked: 0,
  bronze: 2,
  silver: 4,
  gold: 6,
  platinum: 8,
}
