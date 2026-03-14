import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db/client'

// PATCH /api/rate-requests/[id] — approve or reject (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { status, review_note } = await req.json() as {
    status: 'approved' | 'rejected'; review_note?: string
  }

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const rows = await sql`
    UPDATE rate_change_requests
    SET status = ${status},
        reviewed_by = ${session.user!.id!},
        reviewed_at = NOW(),
        review_note = ${review_note ?? null},
        updated_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `
  if (!rows.length) return NextResponse.json({ error: 'Request not found or already reviewed' }, { status: 404 })
  return NextResponse.json({ request: rows[0] })
}
