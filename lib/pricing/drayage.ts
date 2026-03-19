import type { DrayageCityRate, DrayageQuoteResult, LineItem } from '../types/quote'
import type { DrayageExtraction } from '../types/quote'

export const DRAYAGE_CITY_RATES: Record<string, DrayageCityRate> = {
  'ALHAMBRA': { base: 490, dist: 25 },
  'ALTA LOMA': { base: 650, dist: 42 },
  'ANAHEIM': { base: 560, dist: 25 },
  'ARCADIA': { base: 550, dist: 28 },
  'AZUSA': { base: 580, dist: 27 },
  'BALDWIN PARK': { base: 530, dist: 22 },
  'BELL GARDEN': { base: 490, dist: 12 },
  'BELL FLOWER': { base: 440, dist: 15 },
  'BELLFLOWER': { base: 440, dist: 15 },
  'BREA': { base: 550, dist: 30 },
  'BUENA PARK': { base: 530, dist: 24 },
  'BURBANK': { base: 620, dist: 36 },
  'CARSON': { base: 490, dist: 8 },
  'CERRITOS': { base: 500, dist: 18 },
  'CHINO': { base: 600, dist: 40 },
  'CHINO HILLS': { base: 620, dist: 42 },
  'CITY OF INDUSTRY': { base: 550, dist: 23 },
  'COLTON': { base: 750, dist: 62, requiresDropFee: true, dropFeeAmount: 350 },
  'COMMERCE': { base: 540, dist: 15 },
  'COMPTON': { base: 520, dist: 12 },
  'CORONA': { base: 700, dist: 46, requiresDropFee: true, dropFeeAmount: 150 },
  'COSTA MESA': { base: 550, dist: 32 },
  'COVINA': { base: 550, dist: 28 },
  'CYPRESS': { base: 480, dist: 22 },
  'DIAMOND BAR': { base: 550, dist: 32 },
  'DOWNEY': { base: 510, dist: 15 },
  'EAST LOS ANGELES': { base: 550, dist: 18 },
  'EASTVALE': { base: 700, dist: 48 },
  'EL MONTE': { base: 510, dist: 22 },
  'EL SEGUNDO': { base: 480, dist: 14 },
  'FONTANA': { base: 600, dist: 52 },
  'FOUNTAIN VALLEY': { base: 550, dist: 30 },
  'FULLERTON': { base: 530, dist: 26 },
  'GARDEN GROVE': { base: 540, dist: 28 },
  'HAWTHORNE': { base: 490, dist: 14 },
  'HUNTINGTON BEACH': { base: 550, dist: 30 },
  'INGLEWOOD': { base: 490, dist: 12 },
  'IRVINE': { base: 570, dist: 35 },
  'LAKEWOOD': { base: 470, dist: 16 },
  'LONG BEACH': { base: 460, dist: 8 },
  'LOS ANGELES': { base: 500, dist: 18 },
  'LYNWOOD': { base: 470, dist: 12 },
  'MAYWOOD': { base: 470, dist: 12 },
  'MIRA LOMA': { base: 700, dist: 48 },
  'MONROVIA': { base: 630, dist: 28 },
  'MONTCLAIR': { base: 600, dist: 38 },
  'MONTEBELLO': { base: 590, dist: 16 },
  'MONTEREY PARK': { base: 490, dist: 20 },
  'MORENO VALLEY': { base: 750, dist: 68, requiresDropFee: true, dropFeeAmount: 150 },
  'NORWALK': { base: 490, dist: 16 },
  'NORCO': { base: 720, dist: 48, requiresDropFee: true, dropFeeAmount: 150 },
  'ONTARIO': { base: 600, dist: 44 },
  'ORANGE': { base: 600, dist: 32 },
  'PARAMOUNT': { base: 480, dist: 12 },
  'PASADENA': { base: 540, dist: 28 },
  'PICO RIVERA': { base: 510, dist: 15 },
  'POMONA': { base: 580, dist: 32 },
  'RANCHO CUCAMONGA': { base: 600, dist: 44 },
  'RANCHO DOMINGUEZ': { base: 480, dist: 8 },
  'REDLAND': { base: 740, dist: 68, requiresDropFee: true },
  'REDLANDS': { base: 740, dist: 68, requiresDropFee: true },
  'REDONDO BEACH': { base: 490, dist: 16 },
  'RIALTO': { base: 720, dist: 58 },
  'RIVERSIDE': { base: 780, dist: 58, requiresDropFee: true, dropFeeAmount: 150 },
  'ROSEMEAD': { base: 510, dist: 22 },
  'ROWLAND HEIGHTS': { base: 540, dist: 28 },
  'ROWLAND HTS': { base: 540, dist: 28 },
  'SAN BERNARDINO': { base: 700, dist: 65, requiresDropFee: true, dropFeeAmount: 150 },
  'SAN GABRIEL': { base: 520, dist: 22 },
  'SAN PEDRO': { base: 480, dist: 8 },
  'SANTA ANA': { base: 540, dist: 30 },
  'SANTA CLARITA': { base: 650, dist: 45 },
  'SANTA FE SPRINGS': { base: 490, dist: 15 },
  'SIGNAL HILL': { base: 490, dist: 10 },
  'SOUTH EL MONTE': { base: 510, dist: 20 },
  'SOUTH GATE': { base: 490, dist: 12 },
  'STANTON': { base: 520, dist: 24 },
  'TORRANCE': { base: 500, dist: 14 },
  'TUSTIN': { base: 560, dist: 30 },
  'UPLAND': { base: 600, dist: 40 },
  'VENTURA': { base: 720, dist: 65, requiresDropFee: true, dropFeeAmount: 150 },
  'VERNON': { base: 510, dist: 12 },
  'WALNUT': { base: 550, dist: 28 },
  'WEST COVINA': { base: 540, dist: 26 },
  'WESTMINSTER': { base: 520, dist: 26 },
  'WHITTIER': { base: 510, dist: 20 },
  'YORBA LINDA': { base: 570, dist: 32 },
}

export const DRAYAGE_WEIGHT_SURCHARGES = [
  { minLbs: 44001, maxLbs: 46000, surcharge: 100 },
  { minLbs: 46001, maxLbs: 48000, surcharge: 150 },
  { minLbs: 48001, maxLbs: 50000, surcharge: 200 },
  { minLbs: 50001, maxLbs: Infinity, surcharge: 275 },
]

export const DRAYAGE_BASE_ADD_ONS = [
  { id: 'drayage.addons.pier-pass', label: 'Pier Pass', amount: 37, unit: 'USD/move' },
  { id: 'drayage.addons.tcf', label: 'Terminal Clean Fuel (TCF)', amount: 18, unit: 'USD/move' },
  { id: 'drayage.addons.chassis-split', label: 'Chassis Split', amount: 75, unit: 'USD/move' },
  { id: 'drayage.addons.rush-request', label: 'Rush Request', amount: 150, unit: 'USD/move' },
]

export const DRAYAGE_INVOICE_ADD_ONS = [
  { id: 'drayage.invoice-addons.chassis-per-day', label: 'Chassis Per Day', amount: 35, unit: 'USD/day' },
  { id: 'drayage.invoice-addons.wccp-per-day', label: 'WCCP Chassis Per Day', amount: 40, unit: 'USD/day' },
  { id: 'drayage.invoice-addons.waiting-per-hour', label: 'Waiting Time', amount: 75, unit: 'USD/hour' },
  { id: 'drayage.invoice-addons.live-unload-per-hour', label: 'Live Unload', amount: 95, unit: 'USD/hour' },
  { id: 'drayage.invoice-addons.extra-stop', label: 'Extra Stop', amount: 65, unit: 'USD/stop' },
]

export function normalizeCityName(city: string): string {
  return city
    .toUpperCase()
    .replace(/,\s*(CA|CALIFORNIA)\s*\d*/gi, '')
    .replace(/\s+\d{5}(-\d{4})?$/, '')
    .replace(/[,.']/g, '')
    .trim()
}

export function lookupCity(city: string): DrayageCityRate | null {
  const normalized = normalizeCityName(city)
  return DRAYAGE_CITY_RATES[normalized] ?? null
}

export function calculateDrayageQuote(extraction: DrayageExtraction): DrayageQuoteResult {
  const { city, containerSize, containerWeightLbs, chassisDays, chassisDaysWccp,
    waitingHours, liveUnloadHours, prepaidPierPass, tcfCharge,
    extraStops, rushRequest, chassisSplitRequired } = extraction

  if (!city) {
    return {
      city: 'Unknown',
      containerSize: containerSize ?? '40',
      containerWeightLbs,
      lineItems: [],
      subtotal: 0,
      basisNotes: [],
      warnings: ['Destination city is required to calculate drayage quote.'],
      isEstimated: false,
      extraction,
    }
  }

  const cityRate = lookupCity(city)
  const lineItems: LineItem[] = []
  const basisNotes: string[] = []
  const warnings: string[] = []
  let isEstimated = false

  if (!cityRate) {
    // Unknown city — use fallback estimation
    isEstimated = true
    warnings.push(`City "${city}" not found in standard rate sheet. Rate is estimated.`)
    const estimatedBase = 380 + 30 * 3.85 // rough fallback for unknown
    lineItems.push({ code: 'BASE', description: `Base Rate (estimated for ${city})`, amount: estimatedBase })
    basisNotes.push('Estimated rate — city not found in standard rate sheet. Contact us for a firm quote.')
  } else {
    lineItems.push({ code: 'BASE', description: `Base Rate — ${normalizeCityName(city)}`, amount: cityRate.base })
    basisNotes.push('Base rate includes standard port pickup from LA/LB terminals.')

    if (cityRate.requiresDropFee) {
      const dropAmount = cityRate.dropFeeAmount ?? 150
      lineItems.push({ code: 'DROP', description: 'Drop Fee', amount: dropAmount })
      basisNotes.push(`Drop fee included for ${normalizeCityName(city)} (requires chassis drop).`)
    }
  }

  // Weight surcharge — tiered lookup
  if (containerWeightLbs && containerWeightLbs > 44000) {
    const tier = DRAYAGE_WEIGHT_SURCHARGES.find(t => containerWeightLbs >= t.minLbs && containerWeightLbs <= t.maxLbs)
    const surcharge = tier?.surcharge ?? DRAYAGE_WEIGHT_SURCHARGES[DRAYAGE_WEIGHT_SURCHARGES.length - 1].surcharge
    lineItems.push({ code: 'WTSUR', description: `Overweight Surcharge (${containerWeightLbs.toLocaleString()} lbs)`, amount: surcharge })
  }

  // Rush request
  if (rushRequest) {
    lineItems.push({ code: 'RUSH', description: 'Rush Request', amount: 150 })
  }

  // Chassis split
  if (chassisSplitRequired) {
    lineItems.push({ code: 'CSPLIT', description: 'Chassis Split', amount: 75 })
  }

  // Pier pass
  if (prepaidPierPass !== false) {
    lineItems.push({ code: 'PP', description: 'Pier Pass', amount: 37 })
  }

  // TCF
  if (tcfCharge !== false) {
    lineItems.push({ code: 'TCF', description: 'Terminal Clean Fuel Charge', amount: 18 })
  }

  // Chassis
  if (chassisDays && chassisDays > 0) {
    lineItems.push({ code: 'CHAS', description: `Chassis Days (${chassisDays} days)`, amount: chassisDays * 35 })
  }

  // WCCP chassis
  if (chassisDaysWccp && chassisDaysWccp > 0) {
    lineItems.push({ code: 'WCCP', description: `WCCP Chassis Days (${chassisDaysWccp} days)`, amount: chassisDaysWccp * 40 })
  }

  // Waiting time
  if (waitingHours && waitingHours > 0) {
    lineItems.push({ code: 'WAIT', description: `Waiting Time (${waitingHours} hrs)`, amount: waitingHours * 75 })
  }

  // Live unload
  if (liveUnloadHours && liveUnloadHours > 0) {
    lineItems.push({ code: 'LU', description: `Live Unload (${liveUnloadHours} hrs)`, amount: liveUnloadHours * 95 })
  }

  // Extra stops
  if (extraStops && extraStops > 0) {
    lineItems.push({ code: 'ESTOP', description: `Extra Stop(s) (${extraStops})`, amount: extraStops * 65 })
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)

  return {
    city: normalizeCityName(city),
    containerSize: containerSize ?? '40',
    containerWeightLbs,
    lineItems,
    subtotal,
    basisNotes,
    warnings,
    isEstimated,
    extraction,
  }
}
