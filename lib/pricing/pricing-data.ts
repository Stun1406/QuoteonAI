export const TRANSLOADING_RATES = {
  normalPalletFirst20: 60,
  normalPalletAfter20: 55,
  oversizePallet: 75,
  looseCargo: {
    tier1: { max: 50, rate: 2.50 },
    tier2: { max: 200, rate: 2.00 },
    tier3: { rate: 1.75 },
  },
  shrinkWrapPerPallet: 8,
  bolPerBol: 35,
  sealPerSeal: 15,
  defaultPalletsPerContainer: {
    '20ft': 10,
    '40ft': 20,
    '45ft': 24,
    '53ft': 26,
  } as Record<string, number>,
}

export const STORAGE_RATES = {
  normalPalletPerMonth: 18,
  oversizePalletPerMonth: 25,
  afterHoursMonFri: 75,
  weekendSatSun: 125,
}

export const TIER_DISCOUNTS: Record<string, number> = {
  unranked: 0,
  bronze: 2,
  silver: 4,
  gold: 6,
  platinum: 8,
}
