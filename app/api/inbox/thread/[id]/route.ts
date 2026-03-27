import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [threads, messages] = await Promise.all([
      sql`
        SELECT id, subject, participant_from, participant_to, status, last_message_at, created_at
        FROM email_threads
        WHERE id = ${id}
        LIMIT 1
      `,
      sql`
        SELECT id, direction, from_email, to_email, subject, body_text, body_html, is_read, received_at, created_at
        FROM email_messages
        WHERE thread_id = ${id}
        ORDER BY received_at ASC
      `,
    ])

    if (!threads.length) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const thread = threads[0] as {
      id: string; subject: string; participant_from: string; participant_to: string
      status: string; last_message_at: string; created_at: string
    }

    // Try to find linked AI processing results via contact email match
    let aiDetails: unknown[] = []
    if (thread.participant_from) {
      const aiThreads = await sql`
        SELECT
          mt.id, mt.thread_id, mt.intent, mt.processor_type, mt.status AS ai_status,
          mt.quote_value, mt.confidence_score, mt.created_at AS ai_created_at,
          c.name AS contact_name, co.business_name AS company_name
        FROM message_threads mt
        LEFT JOIN contacts c ON mt.contact_id = c.id
        LEFT JOIN companies co ON mt.company_id = co.id
        WHERE c.email ILIKE ${thread.participant_from}
        ORDER BY mt.created_at DESC
        LIMIT 5
      `

      // For each AI thread, grab the processed artifact for quote details
      aiDetails = await Promise.all(
        (aiThreads as Array<Record<string, unknown>>).map(async (at) => {
          const artifacts = await sql`
            SELECT artifact_type, artifact_data, sequence_order, created_at
            FROM message_artifacts
            WHERE thread_id = ${at.id as string}
            ORDER BY sequence_order ASC
          `
          return { ...at, artifacts }
        })
      )
    }

    return NextResponse.json({
      thread,
      messages,
      aiThreads: aiDetails,
    })
  } catch (err) {
    console.error('[/api/inbox/thread] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
