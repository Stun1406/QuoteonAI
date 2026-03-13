import { NextRequest, NextResponse } from 'next/server'
import { getTenantProjectContext } from '@/lib/db/context'
import { sql } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = getTenantProjectContext()
    const q = req.nextUrl.searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const pattern = `%${q}%`

    const rows = await sql`
      SELECT DISTINCT
        mt.id,
        mt.thread_id,
        mt.created_at,
        mt.intent,
        mt.processor_type,
        mt.quote_value,
        mt.status,
        c.name AS contact_name,
        c.email AS contact_email,
        co.business_name AS company_name
      FROM message_threads mt
      LEFT JOIN contacts c ON mt.contact_id = c.id
      LEFT JOIN companies co ON mt.company_id = co.id
      WHERE mt.tenant_id = ${tenantId}
        AND (
          c.name ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
          OR co.business_name ILIKE ${pattern}
          OR mt.thread_id ILIKE ${pattern}
        )
      ORDER BY mt.created_at DESC
      LIMIT 20
    `

    return NextResponse.json({ results: rows })
  } catch (err) {
    console.error('[/api/ops/search] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
