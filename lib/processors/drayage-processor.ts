import { extractDrayageParameters } from '../llm/drayage-extractor'
import { calculateDrayageQuote } from '../pricing/drayage'
import type { PreprocessResult } from '../types/preprocessor'
import type { ProcessorResult, DrayageResponseData } from '../types/processor'
import type { DrayageExtraction } from '../types/quote'

interface DrayageProcessorOptions {
  tenantId: string
  projectId: string
  threadId: string
  priorProcessorResult?: ProcessorResult | null
  rawMessage: string
  preExtracted?: DrayageExtraction | null
}

function detectRemovalPhrases(text: string, prior: DrayageExtraction): Partial<DrayageExtraction> {
  const overrides: Partial<DrayageExtraction> = {}
  const lower = text.toLowerCase()
  if (/remove chassis|no chassis|without chassis/i.test(lower)) {
    overrides.chassisDays = null
    overrides.chassisDaysWccp = null
  }
  if (/remove extra stops?|no extra stops?/i.test(lower)) overrides.extraStops = 0
  if (/remove waiting|no waiting/i.test(lower)) overrides.waitingHours = null
  if (/remove live unload|no live unload/i.test(lower)) overrides.liveUnloadHours = null
  return overrides
}

function mergeExtractions(current: DrayageExtraction, prior: DrayageExtraction, rawMessage: string): DrayageExtraction {
  const removals = detectRemovalPhrases(rawMessage, prior)
  return {
    city: current.city ?? prior.city,
    containerSize: current.containerSize ?? prior.containerSize,
    containerWeightLbs: current.containerWeightLbs ?? prior.containerWeightLbs,
    chassisDays: 'chassisDays' in removals ? removals.chassisDays! : (current.chassisDays ?? prior.chassisDays),
    chassisDaysWccp: 'chassisDaysWccp' in removals ? removals.chassisDaysWccp! : (current.chassisDaysWccp ?? prior.chassisDaysWccp),
    waitingHours: 'waitingHours' in removals ? null : (current.waitingHours ?? prior.waitingHours),
    liveUnloadHours: 'liveUnloadHours' in removals ? null : (current.liveUnloadHours ?? prior.liveUnloadHours),
    rushRequest: current.rushRequest || prior.rushRequest,
    prepaidPierPass: current.prepaidPierPass,
    tcfCharge: current.tcfCharge,
    chassisSplitRequired: current.chassisSplitRequired || prior.chassisSplitRequired,
    extraStops: 'extraStops' in removals ? 0 : (current.extraStops || prior.extraStops || 0),
    notes: [...(prior.notes ?? []), ...(current.notes ?? [])],
  }
}

export async function processDrayage(
  preprocessResult: PreprocessResult,
  options: DrayageProcessorOptions
): Promise<ProcessorResult> {
  const startTime = Date.now()
  const { tenantId, projectId, threadId, priorProcessorResult, rawMessage, preExtracted } = options

  // Use pre-extracted params if provided, otherwise call LLM
  const extraction = preExtracted ?? await extractDrayageParameters(rawMessage, { tenantId, projectId, threadId })

  let finalExtraction = extraction
  if (priorProcessorResult?.responseData.type === 'drayage' && priorProcessorResult.responseData.extracted) {
    finalExtraction = mergeExtractions(extraction, priorProcessorResult.responseData.extracted, rawMessage)
  } else if (priorProcessorResult?.responseData.type === 'hybrid') {
    const drayageComponent = priorProcessorResult.responseData.components.find(c => c.flow === 'drayage')
    if (drayageComponent?.responseData.type === 'drayage' && drayageComponent.responseData.extracted) {
      finalExtraction = mergeExtractions(extraction, drayageComponent.responseData.extracted, rawMessage)
    }
  }

  const missingFields: string[] = []
  if (!finalExtraction.city) missingFields.push('Destination city')
  if (!finalExtraction.containerSize) missingFields.push('Container size (20, 40, 45, or 53 ft)')

  const quote = missingFields.length === 0 ? calculateDrayageQuote(finalExtraction) : null

  const responseData: DrayageResponseData = {
    type: 'drayage',
    quote,
    missingFields,
    notes: finalExtraction.notes,
    extracted: finalExtraction,
  }

  return {
    processorType: 'drayage',
    intent: preprocessResult.intent,
    contactInfo: preprocessResult.contactInfo,
    isForwarded: preprocessResult.isForwarded,
    responseData,
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    },
  }
}
