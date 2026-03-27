import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getTenantProjectContext } from '@/lib/db/context'

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get('section') ?? 'dashboard'

  try {
    const { tenantId } = getTenantProjectContext()

    switch (section) {

      case 'dashboard': {
        const [accountRows, quoteRows, recentRows, shipmentRows] = await Promise.all([
          sql`SELECT COUNT(*)::int AS count FROM companies WHERE tenant_id = ${tenantId}`,
          sql`SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'quoted')::int AS quoted,
                COUNT(*) FILTER (WHERE status = 'won')::int AS won,
                AVG(quote_value) FILTER (WHERE quote_value IS NOT NULL) AS avg_value
              FROM message_threads WHERE tenant_id = ${tenantId}`,
          sql`SELECT mt.id, mt.processor_type, mt.status, mt.quote_value, mt.created_at,
                     c.name AS contact_name, co.business_name AS company_name
              FROM message_threads mt
              LEFT JOIN contacts c ON mt.contact_id = c.id
              LEFT JOIN companies co ON mt.company_id = co.id
              WHERE mt.tenant_id = ${tenantId}
              ORDER BY mt.created_at DESC LIMIT 8`,
          sql`SELECT COUNT(*)::int AS count,
                     COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
                     COUNT(*) FILTER (WHERE status = 'in-transit')::int AS in_transit
              FROM crm_shipments WHERE tenant_id = ${tenantId}`.catch(() => [{ count: 0, delivered: 0, in_transit: 0 }]),
        ])

        const q = quoteRows[0] ?? {}
        const s = shipmentRows[0] ?? {}
        const winRate = q.total > 0 ? Math.round((q.won / q.total) * 100) : 0

        return NextResponse.json({
          stats: {
            totalAccounts: accountRows[0]?.count ?? 0,
            totalQuotes: q.total ?? 0,
            winRate,
            avgQuoteValue: q.avg_value ? Number(q.avg_value).toFixed(0) : null,
            totalShipments: s.count ?? 0,
            inTransit: s.in_transit ?? 0,
          },
          recentQuotes: recentRows,
        })
      }

      case 'accounts': {
        const accounts = await sql`
          SELECT c.id, c.business_name, c.email_domain, c.website,
                 c.industry_type, c.category, c.region, c.credit_terms,
                 c.account_status, c.created_at,
                 COUNT(ct.id)::int AS contact_count,
                 COUNT(mt.id)::int AS quote_count,
                 SUM(mt.quote_value) FILTER (WHERE mt.quote_value IS NOT NULL) AS total_value
          FROM companies c
          LEFT JOIN contacts ct ON ct.company_id = c.id
          LEFT JOIN message_threads mt ON mt.company_id = c.id
          WHERE c.tenant_id = ${tenantId}
          GROUP BY c.id
          ORDER BY c.business_name ASC
        `
        return NextResponse.json({ accounts })
      }

      case 'quotes': {
        const quotes = await sql`
          SELECT mt.id, mt.processor_type, mt.status, mt.quote_value,
                 mt.confidence_score, mt.created_at,
                 c.name AS contact_name, c.email AS contact_email,
                 co.business_name AS company_name, co.industry_type
          FROM message_threads mt
          LEFT JOIN contacts c ON mt.contact_id = c.id
          LEFT JOIN companies co ON mt.company_id = co.id
          WHERE mt.tenant_id = ${tenantId}
          ORDER BY mt.created_at DESC
          LIMIT 200
        `
        return NextResponse.json({ quotes })
      }

      case 'carriers': {
        const carriers = await sql`
          SELECT * FROM crm_carriers
          WHERE tenant_id = ${tenantId}
          ORDER BY company_name ASC
        `.catch(() => [])
        return NextResponse.json({ carriers })
      }

      case 'shipments': {
        const shipments = await sql`
          SELECT s.*, co.business_name AS customer_company,
                 cr.company_name AS carrier_name
          FROM crm_shipments s
          LEFT JOIN companies co ON s.company_id = co.id
          LEFT JOIN crm_carriers cr ON s.carrier_id = cr.id
          WHERE s.tenant_id = ${tenantId}
          ORDER BY s.created_at DESC
          LIMIT 200
        `.catch(() => [])
        return NextResponse.json({ shipments })
      }

      default:
        return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }
  } catch (err) {
    console.error('[/api/crm] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
