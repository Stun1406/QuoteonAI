import { getArtifactsByThreadId } from '../db/tables/artifact'
import type { ProcessorResult } from '../types/processor'

export async function buildThreadContextFromArtifacts(threadId: string): Promise<string | null> {
  const artifacts = await getArtifactsByThreadId(threadId)

  const processedArtifacts = artifacts.filter(a => a.artifact_type === 'processed')
  if (processedArtifacts.length === 0) return null

  const latest = processedArtifacts[processedArtifacts.length - 1]
  const data = latest.artifact_data as Record<string, unknown>

  return buildContextSummary(data)
}

export async function getLatestProcessorResult(threadId: string): Promise<ProcessorResult | null> {
  const artifacts = await getArtifactsByThreadId(threadId)
  const processedArtifacts = artifacts.filter(a => a.artifact_type === 'processed')

  if (processedArtifacts.length === 0) return null

  const latest = processedArtifacts[processedArtifacts.length - 1]
  return latest.artifact_data as unknown as ProcessorResult
}

function buildContextSummary(data: Record<string, unknown>): string {
  const processorType = data.processorType as string
  const responseData = data.responseData as Record<string, unknown>

  const lines = ['=== PRIOR CONVERSATION CONTEXT ===']

  if (processorType === 'drayage' && responseData?.type === 'drayage') {
    const drayageData = responseData as Record<string, unknown>
    const quote = drayageData.quote as Record<string, unknown> | null
    const extracted = drayageData.extracted as Record<string, unknown> | null

    if (quote) {
      lines.push(`Previously quoted: Drayage to ${quote.city} for ${quote.containerSize}ft container`)
      lines.push(`Previous subtotal: $${quote.subtotal}`)
    }
    if (extracted) {
      lines.push(`Previous parameters: city=${extracted.city}, size=${extracted.containerSize}, weight=${extracted.containerWeightLbs}lbs`)
      if (extracted.chassisDays) lines.push(`Chassis: ${extracted.chassisDays} days`)
      if (extracted.waitingHours) lines.push(`Waiting time: ${extracted.waitingHours} hrs`)
      if (extracted.liveUnloadHours) lines.push(`Live unload: ${extracted.liveUnloadHours} hrs`)
    }
  } else if (processorType === 'warehousing' && responseData?.type === 'warehousing') {
    const whData = responseData as Record<string, unknown>
    const result = whData.result as Record<string, unknown> | null

    if (result) {
      lines.push(`Previously quoted: Warehousing/Transloading`)
      lines.push(`Previous total: $${result.total}`)
    }
  }

  lines.push('=== END PRIOR CONTEXT ===')

  return lines.join('\n')
}
