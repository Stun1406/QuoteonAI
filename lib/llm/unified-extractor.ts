import { openai, MODEL } from './client'
import { trackLlmCall } from '../db/llm-tracker'
import type { ContactInfo, MessageIntent, ClassifiedIntent } from '../types/preprocessor'
import type { DrayageExtraction, QuoteExtraction } from '../types/quote'
import type { LastMileExtraction } from '../types/processor'

export type UnifiedExtractionResult = {
  intent: MessageIntent
  classifiedIntent: ClassifiedIntent
  contactInfo: ContactInfo
  isForwarded: boolean
  confidence: number
  originalMessage: string
  drayageParams: DrayageExtraction | null
  warehouseParams: QuoteExtraction | null
  lastMileParams: LastMileExtraction | null
}

const SYSTEM_PROMPT = `You are an expert email parser for FL Distribution, a Southern California logistics company.

Services offered:
- drayage: moving containers from LA/Long Beach ports to inland destinations
- transloading: unloading containers in a warehouse, palletizing, shrink wrap, repackaging
- warehousing: pallet storage and handling
- last-mile: final delivery by straight/box truck to multiple stops
- general-inquiry: questions about services or pricing

Parse the email in one pass and return ONLY valid JSON. No markdown. No explanation.

## Contact extraction rules
- Extract from signature block ONLY, never from body text or headers
- For forwarded emails: extract the ORIGINAL sender, not the forwarder

## Intent classification rules
- drayage: container moved FROM a port TO a destination city/warehouse (port-to-door move, no warehouse work)
- transloading: ANY warehouse operation — unloading, palletizing, shrink wrap, BOL, repackaging, sorting cargo. Container sizes may be mentioned but the work happens AT the warehouse, not a port-to-door move.
- warehousing: storage only, monthly pallet storage, handling in/out without transloading
- last-mile: delivery by truck, number of stops, mileage, liftgate requests
- general-inquiry: questions about services, hours, availability
- PRIORITY RULE: if the email mentions transloading, palletizing, shrink wrap, BOL creation, or repackaging → classify as "transloading" ALWAYS, even if container sizes are also mentioned
- If in doubt between drayage and general-inquiry and a port or container size is mentioned (but NO warehouse keywords): choose drayage

## Response format
{
  "intent": "drayage" | "transloading" | "warehousing" | "last-mile" | "general-inquiry" | "complaint" | "other",
  "isForwarded": boolean,
  "confidence": number (0–1),
  "contactInfo": {
    "name": string | null,
    "email": string | null,
    "company": string | null,
    "title": string | null,
    "phone": string | null,
    "website": string | null
  },
  "drayage": {
    "city": string | null,
    "containerSize": "20" | "40" | "45" | "53" | null,
    "containerWeightLbs": number | null,
    "chassisDays": number | null,
    "chassisDaysWccp": number | null,
    "waitingHours": number | null,
    "liveUnloadHours": number | null,
    "rushRequest": boolean,
    "prepaidPierPass": boolean,
    "tcfCharge": boolean,
    "chassisSplitRequired": boolean,
    "extraStops": number,
    "notes": string[]
  },
  "warehouse": {
    "confirmationNeeded": string[],
    "transloading": {
      "enabled": boolean,
      "containers": [{"containerCount": number, "containerSize": "20ft"|"40ft"|"45ft"|"53ft"|null, "cargoPackaging": "pallet"|"loose-cargo"|null, "palletCount": number, "looseCargoCount": number}],
      "shrinkWrap": boolean,
      "shrinkWrapPalletCount": number | null,
      "seal": boolean,
      "billOfLading": boolean
    },
    "storage": {
      "enabled": boolean,
      "palletCount": number,
      "palletSize": "normal" | "oversize" | null,
      "storageDurationDays": number,
      "monFriAfterHours": boolean,
      "satSun": boolean
    }
  },
  "lastMile": {
    "miles": number | null,
    "stops": number,
    "liftgate": boolean,
    "residential": boolean,
    "reefer": boolean,
    "hazmat": boolean,
    "oversize": boolean,
    "notes": string[]
  }
}

Rules:
- Always include all four parameter objects (drayage, warehouse, lastMile) in the response
- Set fields to null / false / 0 for types that don't apply to this email
- Drayage defaults: prepaidPierPass=true, tcfCharge=true, rushRequest=false, chassisSplitRequired=false, extraStops=0
- Warehouse default containers: [{"containerCount":1,"containerSize":null,"cargoPackaging":null,"palletCount":0,"looseCargoCount":0}]`

export async function unifiedExtract(
  text: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<UnifiedExtractionResult> {
  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1536,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Parse this email:\n\n${text}` },
    ],
  })

  const responseTimeMs = Date.now() - startTime

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'unified-extract',
    callStage: 'inbound',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  const rawText = response.choices[0].message.content ?? '{}'
  let parsed: Record<string, unknown> = {}
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = {}
  }

  const intent = (parsed.intent as MessageIntent) ?? 'other'
  const rawContact = (parsed.contactInfo as Record<string, unknown>) ?? {}

  const contactInfo: ContactInfo = {
    name: (rawContact.name as string) ?? null,
    email: (rawContact.email as string) ?? null,
    company: (rawContact.company as string) ?? null,
    title: (rawContact.title as string) ?? null,
    phone: (rawContact.phone as string) ?? null,
    website: (rawContact.website as string) ?? null,
  }

  // Fallback: extract phone from body if LLM missed it
  if (!contactInfo.phone) {
    const phoneMatch = text.match(/\+?\d[\d\s().\-]{8,}/)
    if (phoneMatch) contactInfo.phone = phoneMatch[0].trim()
  }

  // Fallback: extract company from email domain
  if (!contactInfo.company && contactInfo.email) {
    const domain = contactInfo.email.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      contactInfo.company = domain.split('.')[0]
    }
  }

  const toNum = (v: unknown): number | null => {
    const n = Number(v)
    return v != null && !isNaN(n) ? n : null
  }

  // Build drayage params
  const rawD = (parsed.drayage as Record<string, unknown>) ?? {}
  const drayageParams: DrayageExtraction = {
    city: typeof rawD.city === 'string' ? rawD.city : null,
    containerSize: (rawD.containerSize as DrayageExtraction['containerSize']) ?? null,
    containerWeightLbs: toNum(rawD.containerWeightLbs),
    chassisDays: toNum(rawD.chassisDays),
    chassisDaysWccp: toNum(rawD.chassisDaysWccp),
    waitingHours: toNum(rawD.waitingHours),
    liveUnloadHours: toNum(rawD.liveUnloadHours),
    rushRequest: Boolean(rawD.rushRequest ?? false),
    prepaidPierPass: rawD.prepaidPierPass !== false,
    tcfCharge: rawD.tcfCharge !== false,
    chassisSplitRequired: Boolean(rawD.chassisSplitRequired ?? false),
    extraStops: toNum(rawD.extraStops) ?? 0,
    notes: Array.isArray(rawD.notes) ? rawD.notes : [],
  }

  // Build warehouse params
  const rawW = (parsed.warehouse as Record<string, unknown>) ?? {}
  const rawTL = (rawW.transloading as Record<string, unknown>) ?? {}
  const rawST = (rawW.storage as Record<string, unknown>) ?? {}
  const warehouseParams: QuoteExtraction = {
    confirmationNeeded: (rawW.confirmationNeeded as string[]) ?? [],
    transloading: {
      enabled: Boolean(rawTL.enabled ?? false),
      containers: Array.isArray(rawTL.containers) ? rawTL.containers : [{ containerCount: 1, containerSize: null, cargoPackaging: null, palletCount: 0, looseCargoCount: 0 }],
      shrinkWrap: Boolean(rawTL.shrinkWrap ?? false),
      shrinkWrapPalletCount: toNum(rawTL.shrinkWrapPalletCount) ?? undefined,
      seal: Boolean(rawTL.seal ?? false),
      billOfLading: Boolean(rawTL.billOfLading ?? false),
    },
    storage: {
      enabled: Boolean(rawST.enabled ?? false),
      palletCount: toNum(rawST.palletCount) ?? 0,
      palletSize: (rawST.palletSize as 'normal' | 'oversize' | null) ?? null,
      storageDurationDays: toNum(rawST.storageDurationDays) ?? 30,
      monFriAfterHours: Boolean(rawST.monFriAfterHours ?? false),
      satSun: Boolean(rawST.satSun ?? false),
    },
  }

  // Build last-mile params
  const rawLM = (parsed.lastMile as Record<string, unknown>) ?? {}
  const lastMileParams: LastMileExtraction = {
    miles: toNum(rawLM.miles),
    stops: toNum(rawLM.stops) ?? 1,
    liftgate: Boolean(rawLM.liftgate ?? false),
    residential: Boolean(rawLM.residential ?? false),
    reefer: Boolean(rawLM.reefer ?? false),
    hazmat: Boolean(rawLM.hazmat ?? false),
    oversize: Boolean(rawLM.oversize ?? false),
    notes: Array.isArray(rawLM.notes) ? rawLM.notes : [],
  }

  const logisticsIntents: MessageIntent[] = ['drayage', 'transloading', 'warehousing', 'last-mile']
  const isLogistics = logisticsIntents.includes(intent)

  return {
    intent,
    classifiedIntent: {
      flows: isLogistics ? [intent as 'drayage' | 'transloading' | 'warehousing' | 'last-mile'] : [],
      primaryFlow: isLogistics ? intent as 'drayage' | 'transloading' | 'warehousing' | 'last-mile' : undefined,
      overall: isLogistics ? 'quote' : 'general',
    },
    contactInfo,
    isForwarded: Boolean(parsed.isForwarded ?? false),
    confidence: (parsed.confidence as number) ?? 0.8,
    originalMessage: text,
    drayageParams: intent === 'drayage' ? drayageParams : null,
    warehouseParams: (intent === 'transloading' || intent === 'warehousing') ? warehouseParams : null,
    lastMileParams: intent === 'last-mile' ? lastMileParams : null,
  }
}
