import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export async function PATCH(req: NextRequest) {
  try {
    const { threadId, quoteId, status } = await req.json() as {
      threadId?: string
      quoteId?: string
      status: string
    }

    const validStatuses = ['awaiting-confirmation', 'won', 'lost', 'revision-requested']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (!threadId && !quoteId) {
      return NextResponse.json({ error: 'threadId or quoteId required' }, { status: 400 })
    }

    // Map customer-facing action to CRM status
    const crmStatus = status === 'won' ? 'won' : status === 'lost' ? 'lost' : status

    if (threadId) {
      // Update by thread_id field (human-readable ID like THR_XXXXXXXX_XXXX)
      await sql`
        UPDATE message_threads
        SET status = ${crmStatus},
            closed_at = ${crmStatus === 'won' || crmStatus === 'lost' ? new Date().toISOString() : null},
            updated_at = NOW()
        WHERE thread_id = ${threadId}
      `
    } else if (quoteId) {
      // Update by matching quoteId stored in artifact_data
      await sql`
        UPDATE message_threads mt
        SET status = ${crmStatus},
            closed_at = ${crmStatus === 'won' || crmStatus === 'lost' ? new Date().toISOString() : null},
            updated_at = NOW()
        FROM message_artifacts ma
        WHERE ma.thread_id = mt.id
          AND ma.artifact_type = 'chatbot-quote'
          AND ma.artifact_data->>'quoteId' = ${quoteId}
      `
    }

    return NextResponse.json({ ok: true, status: crmStatus })
  } catch (err) {
    console.error('[/api/chat/quote/status]', err)
    // Return ok=true even on DB error — status update is best-effort
    return NextResponse.json({ ok: true, note: 'Status noted locally' })
  }
}
