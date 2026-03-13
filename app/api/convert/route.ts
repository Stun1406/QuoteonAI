import { NextRequest, NextResponse } from 'next/server'
import { getTenantProjectContext } from '@/lib/db/context'
import { formatResponse } from '@/lib/email/format-response'
import type { ProcessorResult } from '@/lib/types/processor'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { payload, originalRequest, threadId } = body as {
      payload: ProcessorResult
      originalRequest: string
      threadId?: string
    }

    if (!payload || !originalRequest) {
      return NextResponse.json({ error: 'payload and originalRequest are required' }, { status: 400 })
    }

    const { tenantId, projectId } = getTenantProjectContext()
    const resolvedThreadId = threadId ?? 'standalone'

    const result = await formatResponse({
      payload,
      originalRequest,
      threadId: resolvedThreadId,
      tenantId,
      projectId,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/convert] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
