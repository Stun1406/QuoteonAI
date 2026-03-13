import { NextRequest, NextResponse } from 'next/server'
import { getTenantProjectContext } from '@/lib/db/context'
import { preprocessMessage } from '@/lib/llm/preprocessor'
import { resolveOrCreateCompanyContact } from '@/lib/db/services/company-contact-service'
import { createThread, addArtifactToThread, updateThreadContactCompany, updateThreadProcessorType, updateThreadProcessingTime, getMessageThreadByThreadId } from '@/lib/db/services/thread-service'
import { updateThreadIntent } from '@/lib/db/tables/thread'
import { getArtifactsByThreadId } from '@/lib/db/tables/artifact'
import { buildThreadContextFromArtifacts } from '@/lib/llm/thread-context'
import { routeMessage } from '@/lib/routing/intent-router'
import { getCompanyTier } from '@/lib/db/services/tier-service'
import type { ProcessorResult } from '@/lib/types/processor'
import type { MessageArtifactRow } from '@/lib/types/database'

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { text, threadId: existingThreadId } = body as { text: string; threadId?: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const { tenantId, projectId } = getTenantProjectContext()

    // Load existing thread if threadId provided
    let existingThread = null
    let priorArtifacts: MessageArtifactRow[] = []
    let threadUuid: string | null = null

    if (existingThreadId) {
      existingThread = await getMessageThreadByThreadId(projectId, existingThreadId)
      if (existingThread) {
        threadUuid = existingThread.id
        priorArtifacts = await getArtifactsByThreadId(threadUuid)
      }
    }

    // Build prior context from artifacts (for multi-turn)
    const priorContext = priorArtifacts.length > 0 && threadUuid
      ? await buildThreadContextFromArtifacts(threadUuid)
      : null

    // Find most recent processed artifact for merge
    const priorProcessedArtifact = [...priorArtifacts]
      .reverse()
      .find(a => a.artifact_type === 'processed')

    const priorProcessorResult: ProcessorResult | null = priorProcessedArtifact
      ? (priorProcessedArtifact.artifact_data as unknown as ProcessorResult)
      : null

    // Prepend context for multi-turn
    const messageWithContext = priorContext
      ? `${priorContext}\n\nUser follow-up:\n${text}`
      : text

    // Create preliminary thread if new
    // We need a threadId for LLM tracking — create it first
    // Store inbound artifact first requires a threadId
    // So we preprocess first to get intent, then create thread

    // Preprocess
    const preprocessStartTime = Date.now()

    // Temporarily use a placeholder threadId for LLM tracking if new thread
    // We'll create the actual thread after preprocessing
    let tempThreadId = threadUuid ?? `TEMP_${Date.now()}`

    const preprocessResult = await preprocessMessage(messageWithContext, {
      tenantId,
      projectId,
      threadId: tempThreadId,
    })

    // Resolve company/contact
    const { company, contact } = await resolveOrCreateCompanyContact(tenantId, preprocessResult.contactInfo)

    // Create or use existing thread
    let thread
    if (existingThread && threadUuid) {
      thread = existingThread
      // Update contact/company if newly resolved
      if (contact?.id || company?.id) {
        await updateThreadContactCompany(threadUuid, contact?.id ?? null, company?.id ?? null)
      }
      await updateThreadIntent(threadUuid, preprocessResult.intent, preprocessResult.isForwarded, preprocessResult.confidence)
    } else {
      thread = await createThread({
        tenantId,
        projectId,
        contactId: contact?.id,
        companyId: company?.id,
        preprocessResult,
      })
      threadUuid = thread.id
    }

    // Store INBOUND artifact
    await addArtifactToThread({
      threadId: threadUuid,
      tenantId,
      projectId,
      type: 'inbound',
      data: {
        rawMessage: text,
        from: preprocessResult.contactInfo.email,
        receivedAt: new Date().toISOString(),
      },
      sequenceOrder: priorArtifacts.length + 1,
    })

    // Store PREPROCESSED artifact
    await addArtifactToThread({
      threadId: threadUuid,
      tenantId,
      projectId,
      type: 'preprocessed',
      data: {
        contactInfo: preprocessResult.contactInfo,
        intent: preprocessResult.intent,
        classifiedIntent: preprocessResult.classifiedIntent,
        confidence: preprocessResult.confidence,
        isForwarded: preprocessResult.isForwarded,
      },
      sequenceOrder: priorArtifacts.length + 2,
    })

    // Route to correct processor
    const tierInfo = await getCompanyTier({ tenantId, companyId: company?.id ?? null })

    const processorResult = await routeMessage(preprocessResult, {
      tenantId,
      projectId,
      threadId: threadUuid,
      priorProcessorResult,
      rawMessage: text,
      discountPct: tierInfo.discountPct,
    })

    // Attach tier info
    processorResult.metadata.customerTier = tierInfo.tier
    processorResult.metadata.discountPct = tierInfo.discountPct
    processorResult.metadata.companySpendUsd = tierInfo.totalSpendUsd
    processorResult.metadata.companyRequestCount = tierInfo.requestCount

    // Calculate quote value
    let quoteValue: number | null = null
    if (processorResult.responseData.type === 'drayage') {
      quoteValue = processorResult.responseData.quote?.subtotal ?? null
    } else if (processorResult.responseData.type === 'warehousing') {
      quoteValue = processorResult.responseData.result.total
    } else if (processorResult.responseData.type === 'last-mile') {
      quoteValue = processorResult.responseData.result.total
    } else if (processorResult.responseData.type === 'hybrid') {
      quoteValue = processorResult.responseData.combinedTotal
    }

    // Update thread
    await updateThreadProcessorType(threadUuid, processorResult.processorType, quoteValue)

    if (quoteValue !== null) {
      const { sql } = await import('@/lib/db/client')
      await sql`UPDATE message_threads SET quote_value = ${quoteValue} WHERE id = ${threadUuid}`
    }

    // Store PROCESSED artifact
    await addArtifactToThread({
      threadId: threadUuid,
      tenantId,
      projectId,
      type: 'processed',
      data: processorResult as unknown as Record<string, unknown>,
      sequenceOrder: priorArtifacts.length + 3,
    })

    // Update processing time
    const processingTimeMs = Date.now() - startTime
    await updateThreadProcessingTime(threadUuid, processingTimeMs)

    return NextResponse.json({
      ...processorResult,
      threadId: thread.thread_id,
      threadUuid,
    })
  } catch (err) {
    console.error('[/api/process] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
