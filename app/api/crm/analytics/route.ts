import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getTenantProjectContext } from '@/lib/db/context'
import { openai, MODEL } from '@/lib/llm/client'

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json() as { question?: string }
    if (!question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const { tenantId } = getTenantProjectContext()

    // Gather context data from DB
    const [quoteSummary, accountSummary, recentQuotes] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int AS total_quotes,
          COUNT(*) FILTER (WHERE status = 'won')::int AS won,
          COUNT(*) FILTER (WHERE status = 'lost')::int AS lost,
          COUNT(*) FILTER (WHERE status = 'quoted')::int AS quoted,
          ROUND(AVG(quote_value) FILTER (WHERE quote_value IS NOT NULL)::numeric, 2) AS avg_value,
          ROUND(SUM(quote_value) FILTER (WHERE quote_value IS NOT NULL)::numeric, 2) AS total_value,
          COUNT(*) FILTER (WHERE processor_type = 'drayage')::int AS drayage_count,
          COUNT(*) FILTER (WHERE processor_type = 'warehousing')::int AS transloading_count,
          COUNT(*) FILTER (WHERE processor_type = 'last-mile')::int AS last_mile_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30_days
        FROM message_threads
        WHERE tenant_id = ${tenantId}
      `,
      sql`
        SELECT COUNT(*)::int AS total_accounts FROM companies WHERE tenant_id = ${tenantId}
      `,
      sql`
        SELECT mt.processor_type, mt.status, mt.quote_value, mt.created_at,
               c.name AS contact, co.business_name AS company
        FROM message_threads mt
        LEFT JOIN contacts c ON mt.contact_id = c.id
        LEFT JOIN companies co ON mt.company_id = co.id
        WHERE mt.tenant_id = ${tenantId}
        ORDER BY mt.created_at DESC
        LIMIT 20
      `,
    ])

    const qs = quoteSummary[0] ?? {}
    const winRate = qs.total_quotes > 0 ? Math.round((qs.won / qs.total_quotes) * 100) : 0

    const context = `
CRM Analytics Context (FL Distribution — logistics company):
- Total accounts: ${accountSummary[0]?.total_accounts ?? 0}
- Total quotes (all time): ${qs.total_quotes}
- Won: ${qs.won}, Lost: ${qs.lost}, Quoted/Pending: ${qs.quoted}
- Quote win rate: ${winRate}%
- Average quote value: $${qs.avg_value ?? 'N/A'}
- Total quote revenue: $${qs.total_value ?? 'N/A'}
- Quotes last 30 days: ${qs.last_30_days}
- Service breakdown — Drayage: ${qs.drayage_count}, Transloading: ${qs.transloading_count}, Last Mile: ${qs.last_mile_count}
- Recent quotes: ${JSON.stringify(recentQuotes.slice(0, 10))}

Services offered: Drayage (port-to-door), Transloading/Warehousing, Last-Mile delivery, FTL/LTL, Intermodal.
`.trim()

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: 'You are an AI analytics assistant for FL Distribution, a logistics CRM. Answer questions concisely and data-driven using the context provided. If specific data is unavailable, say so honestly and provide general guidance. Use numbers where available.',
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    })

    const answer = response.choices[0].message.content ?? 'No answer generated.'
    return NextResponse.json({ answer })

  } catch (err) {
    console.error('[/api/crm/analytics] Error:', err)
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 500 })
  }
}
