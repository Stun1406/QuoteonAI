import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.trim()
    const by = req.nextUrl.searchParams.get('by') ?? 'Subject'

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const pattern = `%${q}%`

    let rows
    if (by === 'Thread ID') {
      rows = await sql`
        SELECT
          et.id, et.subject, et.participant_from AS "from", et.participant_to AS "to",
          et.status, et.last_message_at, et.created_at,
          (SELECT em.body_text FROM email_messages em
           WHERE em.thread_id = et.id AND em.direction = 'inbound'
           ORDER BY em.received_at ASC LIMIT 1) AS first_message,
          (SELECT COUNT(*) FROM email_messages em WHERE em.thread_id = et.id)::int AS message_count,
          (SELECT COUNT(*) FROM email_messages em WHERE em.thread_id = et.id AND em.direction = 'outbound')::int AS reply_count
        FROM email_threads et
        WHERE et.id::text ILIKE ${pattern}
        ORDER BY et.last_message_at DESC
        LIMIT 30
      `
    } else if (by === 'Company') {
      rows = await sql`
        SELECT
          et.id, et.subject, et.participant_from AS "from", et.participant_to AS "to",
          et.status, et.last_message_at, et.created_at,
          (SELECT em.body_text FROM email_messages em
           WHERE em.thread_id = et.id AND em.direction = 'inbound'
           ORDER BY em.received_at ASC LIMIT 1) AS first_message,
          (SELECT COUNT(*) FROM email_messages em WHERE em.thread_id = et.id)::int AS message_count,
          (SELECT COUNT(*) FROM email_messages em WHERE em.thread_id = et.id AND em.direction = 'outbound')::int AS reply_count
        FROM email_threads et
        WHERE et.participant_from ILIKE ${pattern}
           OR et.participant_to ILIKE ${pattern}
        ORDER BY et.last_message_at DESC
        LIMIT 30
      `
    } else {
      // Subject (default) — search subject, sender, and body text
      rows = await sql`
        SELECT
          et.id, et.subject, et.participant_from AS "from", et.participant_to AS "to",
          et.status, et.last_message_at, et.created_at,
          (SELECT em.body_text FROM email_messages em
           WHERE em.thread_id = et.id AND em.direction = 'inbound'
           ORDER BY em.received_at ASC LIMIT 1) AS first_message,
          (SELECT COUNT(*) FROM email_messages em WHERE em.thread_id = et.id)::int AS message_count,
          (SELECT COUNT(*) FROM email_messages em WHERE em.thread_id = et.id AND em.direction = 'outbound')::int AS reply_count
        FROM email_threads et
        WHERE et.subject ILIKE ${pattern}
           OR et.participant_from ILIKE ${pattern}
           OR EXISTS (
             SELECT 1 FROM email_messages em
             WHERE em.thread_id = et.id AND em.body_text ILIKE ${pattern}
           )
        ORDER BY et.last_message_at DESC
        LIMIT 30
      `
    }

    return NextResponse.json({ results: rows })
  } catch (err) {
    console.error('[/api/ops/search] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
