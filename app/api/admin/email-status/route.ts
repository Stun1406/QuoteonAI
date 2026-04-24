import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

// Protected by WEBHOOK_SECRET — pass it as x-api-key header or ?key= query param
// e.g.  GET /api/admin/email-status?key=<WEBHOOK_SECRET>
function authorized(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET ?? process.env.EMAIL_WORKER_API_KEY ?? ''
  if (!secret) return true // no auth configured — allow
  const fromHeader = req.headers.get('x-api-key') ?? ''
  const fromQuery  = new URL(req.url).searchParams.get('key') ?? ''
  return fromHeader === secret || fromQuery === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── Table existence ───────────────────────────────────────────────────────
    const tbls = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('email_threads','email_messages','email_failures')
      ORDER BY table_name
    ` as Array<{ table_name: string }>
    const existingTables = tbls.map(r => r.table_name)

    // ── Counts ────────────────────────────────────────────────────────────────
    let threadCount = 0, inboundCount = 0, outboundCount = 0
    if (existingTables.includes('email_threads')) {
      const r = await sql`SELECT COUNT(*) AS n FROM email_threads` as Array<{ n: string }>
      threadCount = Number(r[0]?.n ?? 0)
    }
    if (existingTables.includes('email_messages')) {
      const ib = await sql`SELECT COUNT(*) AS n FROM email_messages WHERE direction = 'inbound'`  as Array<{ n: string }>
      const ob = await sql`SELECT COUNT(*) AS n FROM email_messages WHERE direction = 'outbound'` as Array<{ n: string }>
      inboundCount  = Number(ib[0]?.n ?? 0)
      outboundCount = Number(ob[0]?.n ?? 0)
    }

    // ── Recent failures ───────────────────────────────────────────────────────
    let failures: unknown[] = []
    if (existingTables.includes('email_failures')) {
      failures = await sql`
        SELECT id, created_at, stage, status_code, message, context
        FROM email_failures
        ORDER BY created_at DESC
        LIMIT 30
      `
    }

    // ── Recent inbound emails ─────────────────────────────────────────────────
    let recentEmails: unknown[] = []
    if (existingTables.includes('email_messages')) {
      recentEmails = await sql`
        SELECT m.id, m.from_email, m.subject, m.trust_level, m.spf, m.dkim,
               m.received_at, m.direction, t.status AS thread_status
        FROM email_messages m
        JOIN email_threads t ON t.id = m.thread_id
        WHERE m.direction = 'inbound'
        ORDER BY m.received_at DESC
        LIMIT 20
      `
    }

    return NextResponse.json({
      tables: {
        email_threads: existingTables.includes('email_threads'),
        email_messages: existingTables.includes('email_messages'),
        email_failures: existingTables.includes('email_failures'),
      },
      counts: { threads: threadCount, inbound: inboundCount, outbound: outboundCount },
      recentFailures: failures,
      recentEmails,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB query failed' },
      { status: 500 }
    )
  }
}
