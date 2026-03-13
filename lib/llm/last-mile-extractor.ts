import { openai, MODEL } from './client'
import { trackLlmCall } from '../db/llm-tracker'
import type { LastMileExtraction } from '../types/processor'

const SYSTEM_PROMPT = `You are a last-mile delivery parameter extractor for FL Distribution.

Extract delivery parameters from the email. Return ONLY valid JSON. No markdown. No preamble.

Response format:
{
  "miles": number | null,
  "stops": number,
  "liftgate": boolean,
  "residential": boolean,
  "reefer": boolean,
  "hazmat": boolean,
  "oversize": boolean,
  "notes": string[]
}`

export async function extractLastMileParameters(
  text: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<LastMileExtraction> {
  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract last-mile delivery parameters from:\n\n${text}` },
    ],
  })

  const responseTimeMs = Date.now() - startTime

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'last-mile-extract',
    callStage: 'processing',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  const rawText = response.choices[0].message.content ?? '{}'

  let parsed: Partial<LastMileExtraction> = {}
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = {}
  }

  return {
    miles: parsed.miles ?? null,
    stops: parsed.stops ?? 1,
    liftgate: parsed.liftgate ?? false,
    residential: parsed.residential ?? false,
    reefer: parsed.reefer ?? false,
    hazmat: parsed.hazmat ?? false,
    oversize: parsed.oversize ?? false,
    notes: parsed.notes ?? [],
  }
}
