import { openai, MODEL } from './client'
import { trackLlmCall } from '../db/llm-tracker'
import type { DrayageExtraction } from '../types/quote'

const SYSTEM_PROMPT = `You are a logistics parameter extractor for FL Distribution, a drayage and freight company.

Extract drayage parameters from the email. Return ONLY valid JSON. No markdown. No preamble.

Cities are in Southern California (near LA/Long Beach ports).

Response format:
{
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
}

Default values: rushRequest=false, prepaidPierPass=true, tcfCharge=true, chassisSplitRequired=false, extraStops=0`

export async function extractDrayageParameters(
  text: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<DrayageExtraction> {
  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract drayage parameters from:\n\n${text}` },
    ],
  })

  const responseTimeMs = Date.now() - startTime

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'drayage-extract',
    callStage: 'processing',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  const rawText = response.choices[0].message.content ?? '{}'

  let parsed: Partial<DrayageExtraction> = {}
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = {}
  }

  return {
    city: parsed.city ?? null,
    containerSize: parsed.containerSize ?? null,
    containerWeightLbs: parsed.containerWeightLbs ?? null,
    chassisDays: parsed.chassisDays ?? null,
    chassisDaysWccp: parsed.chassisDaysWccp ?? null,
    waitingHours: parsed.waitingHours ?? null,
    liveUnloadHours: parsed.liveUnloadHours ?? null,
    rushRequest: parsed.rushRequest ?? false,
    prepaidPierPass: parsed.prepaidPierPass ?? true,
    tcfCharge: parsed.tcfCharge ?? true,
    chassisSplitRequired: parsed.chassisSplitRequired ?? false,
    extraStops: parsed.extraStops ?? 0,
    notes: parsed.notes ?? [],
  }
}
