import { openai, MODEL } from './client'
import { trackLlmCall } from '../db/llm-tracker'
import type { PreprocessResult, ContactInfo, MessageIntent, ClassifiedIntent, LogisticsFlow } from '../types/preprocessor'

const SYSTEM_PROMPT = `You are an email parser for FL Distribution, a Southern California warehousing and freight logistics company.

Your job is to extract structured data from inbound customer emails.

Return ONLY valid JSON. No markdown. No explanation. No preamble.

## Contact Extraction Rules
- Extract contact info ONLY from signature blocks, never from body text or email headers
- For forwarded emails: extract from the ORIGINAL sender (the person whose email was forwarded), not the forwarder
- For forwarded emails: email priority = From: line of forwarded header, then signature
- Detect forwarding by: 'Forwarded message', 'Begin forwarded message', embedded From:/To:/Date: headers

## Intent Classification
- drayage: port container moves from LA/Long Beach ports, chassis, pier pass, lane mentions, inland delivery city, live unload (driver waits at delivery), waiting time, overweight surcharge, drop fee, extra stops at delivery
- transloading: unloading containers INTO a warehouse, palletizing, shrink wrap, BOL creation, loose cartons, repackaging goods inside a facility
- warehousing: storage, monthly pallet storage, handling in/out, after-hours access
- last-mile: final delivery, straight truck, box truck, mileage, stops, liftgate
- general-inquiry: questions about company, services, hours, location
- complaint: customer complaints or issues
- other: doesn't fit any category

## CRITICAL classification rules
- "Live unload" or "live unload hours" = drayage only (driver waits while container is unloaded at destination). Do NOT classify as transloading.
- "Waiting time" or "detention" = drayage only. Do NOT classify as transloading.
- "Chassis days" = drayage only.
- Only classify as transloading if the email explicitly mentions palletizing, shrink wrap, BOL, or warehouse unloading/sorting.
- A single email asking for a port-to-destination container move with accessorials (chassis, waiting, live unload, pier pass) = drayage only, not hybrid.

## Response Format
{
  "isForwarded": boolean,
  "contactInfo": {
    "name": string | null,
    "email": string | null,
    "company": string | null,
    "title": string | null,
    "phone": string | null,
    "website": string | null
  },
  "intent": "drayage" | "warehousing" | "transloading" | "last-mile" | "general-inquiry" | "complaint" | "other",
  "classifiedIntent": {
    "flows": array of logistics flows detected,
    "primaryFlow": primary flow if multiple or null,
    "overall": "quote" | "general" | "complaint" | "other"
  },
  "confidence": number between 0 and 1
}`

export async function preprocessMessage(
  text: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<PreprocessResult> {
  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Parse this email:\n\n${text}` },
    ],
  })

  const responseTimeMs = Date.now() - startTime
  const rawText = response.choices[0].message.content ?? '{}'

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'preprocess',
    callStage: 'inbound',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  let parsed: Record<string, unknown>
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = {}
  }

  // Extract raw contact info from LLM
  const rawContact = (parsed.contactInfo as Record<string, unknown>) ?? {}
  let contactInfo: ContactInfo = {
    name: (rawContact.name as string) ?? null,
    email: (rawContact.email as string) ?? null,
    company: (rawContact.company as string) ?? null,
    title: (rawContact.title as string) ?? null,
    phone: (rawContact.phone as string) ?? null,
    website: (rawContact.website as string) ?? null,
  }

  // Deterministic fallbacks
  if (!contactInfo.phone) {
    const phoneMatch = text.match(/\+?\d[\d\s().\-]{8,}/)
    if (phoneMatch) contactInfo.phone = phoneMatch[0].trim()
  }

  if (!contactInfo.company) {
    const companyMatch = text.match(/\b([A-Z][a-zA-Z\s]*(Inc|LLC|Corp|Logistics|Distribution|Freight|Transport|Shipping|Trucking|Warehouse|Supply|Group|Co\.|Company)\.?)\b/)
    if (companyMatch) contactInfo.company = companyMatch[0].trim()
  }

  if (!contactInfo.company) {
    const lines = text.trim().split('\n').slice(-8)
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 2 && trimmed.length < 50 && !trimmed.includes('@') && !/^\d+$/.test(trimmed) && !/^(Best|Thanks|Regards|Sincerely|From|Sent)/i.test(trimmed) && !trimmed.includes('http')) {
        const prev = contactInfo.company
        if (!prev && trimmed !== contactInfo.name) {
          contactInfo.company = trimmed
          break
        }
      }
    }
  }

  if (!contactInfo.company && contactInfo.email) {
    const domain = contactInfo.email.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      contactInfo.company = domain.split('.')[0]
    }
  }

  const intent = (parsed.intent as MessageIntent) ?? 'other'
  const rawClassified = (parsed.classifiedIntent as Record<string, unknown>) ?? {}

  const classifiedIntent: ClassifiedIntent = {
    flows: (rawClassified.flows as LogisticsFlow[]) ?? [],
    primaryFlow: (rawClassified.primaryFlow as LogisticsFlow) ?? undefined,
    overall: (rawClassified.overall as ClassifiedIntent['overall']) ?? 'other',
  }

  // If no flows detected but intent is a logistics type, add it
  if (classifiedIntent.flows.length === 0) {
    const logisticsIntents: LogisticsFlow[] = ['drayage', 'transloading', 'warehousing', 'last-mile']
    if (logisticsIntents.includes(intent as LogisticsFlow)) {
      classifiedIntent.flows = [intent as LogisticsFlow]
      classifiedIntent.primaryFlow = intent as LogisticsFlow
      classifiedIntent.overall = 'quote'
    }
  }

  return {
    contactInfo,
    intent,
    classifiedIntent,
    confidence: (parsed.confidence as number) ?? 0.5,
    isForwarded: (parsed.isForwarded as boolean) ?? false,
    originalMessage: text,
  }
}
