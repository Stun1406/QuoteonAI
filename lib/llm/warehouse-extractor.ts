import { openai, MODEL } from './client'
import { trackLlmCall } from '../db/llm-tracker'
import type { QuoteExtraction } from '../types/quote'

const SYSTEM_PROMPT = `You are a warehouse/transloading parameter extractor for FL Distribution.

Extract warehousing and transloading parameters from the email. Return ONLY valid JSON. No markdown. No preamble.

Response format:
{
  "confirmationNeeded": string[],
  "transloading": {
    "enabled": boolean,
    "containers": [
      {
        "containerCount": number,
        "containerSize": "20ft" | "40ft" | "45ft" | "53ft" | null,
        "cargoPackaging": "pallet" | "loose-cargo" | null,
        "palletCount": number,
        "looseCargoCount": number
      }
    ],
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
  },
  "laborHours": number | null
}`

export async function extractWarehouseParameters(
  text: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<QuoteExtraction> {
  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract warehouse parameters from:\n\n${text}` },
    ],
  })

  const responseTimeMs = Date.now() - startTime

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'warehouse-extract',
    callStage: 'processing',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  const rawText = response.choices[0].message.content ?? '{}'

  let parsed: Partial<QuoteExtraction> = {}
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = {}
  }

  return {
    confirmationNeeded: parsed.confirmationNeeded ?? [],
    transloading: {
      enabled: parsed.transloading?.enabled ?? false,
      containers: parsed.transloading?.containers ?? [{
        containerCount: 1,
        containerSize: null,
        cargoPackaging: null,
        palletCount: 0,
        looseCargoCount: 0,
      }],
      shrinkWrap: parsed.transloading?.shrinkWrap ?? false,
      shrinkWrapPalletCount: parsed.transloading?.shrinkWrapPalletCount,
      seal: parsed.transloading?.seal ?? false,
      billOfLading: parsed.transloading?.billOfLading ?? false,
    },
    storage: {
      enabled: parsed.storage?.enabled ?? false,
      palletCount: parsed.storage?.palletCount ?? 0,
      palletSize: parsed.storage?.palletSize ?? null,
      storageDurationDays: parsed.storage?.storageDurationDays ?? 30,
      monFriAfterHours: parsed.storage?.monFriAfterHours ?? false,
      satSun: parsed.storage?.satSun ?? false,
    },
    laborHours: parsed.laborHours,
  }
}
