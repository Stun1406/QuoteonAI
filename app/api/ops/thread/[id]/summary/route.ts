import { NextRequest, NextResponse } from 'next/server'
import { getThreadDetail } from '@/lib/db/queries/thread-detail'
import { openai, MODEL } from '@/lib/llm/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const detail = await getThreadDetail(id)

    if (!detail) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const inbound = detail.artifacts.find(a => a.artifact_type === 'inbound')
    const processed = detail.artifacts.find(a => a.artifact_type === 'processed')

    const context = `Thread: ${detail.thread.thread_id}
Intent: ${detail.thread.intent}
Contact: ${detail.contact?.name ?? 'Unknown'} (${detail.contact?.email ?? ''})
Company: ${detail.company?.business_name ?? 'Unknown'}
Quote Value: ${detail.thread.quote_value ? '$' + detail.thread.quote_value : 'N/A'}
Message: ${(inbound?.artifact_data as { rawMessage?: string })?.rawMessage?.slice(0, 500) ?? 'N/A'}`

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        { role: 'system', content: 'You summarize logistics email threads in 2-3 sentences. Be concise and factual.' },
        { role: 'user', content: `Summarize this thread:\n${context}` },
      ],
    })

    const summary = response.choices[0].message.content ?? ''

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[/api/ops/thread/summary] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
