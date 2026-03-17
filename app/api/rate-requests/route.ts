import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db/client'

// GET /api/rate-requests — list requests
// - admin/manager: see all pending requests
// - staff: see only their own
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string })?.role
  const userId = session.user.id

  let rows
  if (role === 'admin' || role === 'manager') {
    rows = await sql`
      SELECT rcr.*, u.name AS requester_name, u.email AS requester_email,
             r.name AS reviewer_name
      FROM rate_change_requests rcr
      JOIN users u ON rcr.requested_by = u.id
      LEFT JOIN users r ON rcr.reviewed_by = r.id
      ORDER BY rcr.created_at DESC
    `
  } else {
    rows = await sql`
      SELECT rcr.*, u.name AS requester_name, u.email AS requester_email,
             r.name AS reviewer_name
      FROM rate_change_requests rcr
      JOIN users u ON rcr.requested_by = u.id
      LEFT JOIN users r ON rcr.reviewed_by = r.id
      WHERE rcr.requested_by = ${userId!}
      ORDER BY rcr.created_at DESC
    `
  }
  return NextResponse.json({ requests: rows })
}

// POST /api/rate-requests — submit a new request (manager and admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string })?.role
  if (role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    rate_key: string; rate_label: string
    current_value: number; requested_value: number; reason?: string
  }

  if (!body.rate_key || body.requested_value === undefined) {
    return NextResponse.json({ error: 'rate_key and requested_value are required' }, { status: 400 })
  }

  const rows = await sql`
    INSERT INTO rate_change_requests
      (requested_by, rate_key, rate_label, current_value, requested_value, reason)
    VALUES
      (${session.user.id!}, ${body.rate_key}, ${body.rate_label}, ${body.current_value}, ${body.requested_value}, ${body.reason ?? null})
    RETURNING *
  `
  return NextResponse.json({ request: rows[0] }, { status: 201 })
}
