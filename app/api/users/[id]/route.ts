import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db/client'
import bcrypt from 'bcryptjs'

// PATCH /api/users/[id] — update role, status, or password (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as {
    role?: string; is_active?: boolean; name?: string; password?: string
  }

  const updates: Record<string, unknown> = {}
  if (body.role !== undefined) {
    if (!['staff', 'manager', 'admin'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    updates.role = body.role
  }
  if (body.is_active !== undefined) updates.is_active = body.is_active
  if (body.name !== undefined) updates.name = body.name
  if (body.password) updates.password_hash = await bcrypt.hash(body.password, 12)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Build dynamic SET clause
  const setClauses = Object.keys(updates)
  let rows
  if (setClauses.includes('role') && setClauses.includes('is_active') && setClauses.includes('name') && setClauses.includes('password_hash')) {
    rows = await sql`UPDATE users SET role=${updates.role as string}, is_active=${updates.is_active as boolean}, name=${updates.name as string}, password_hash=${updates.password_hash as string}, updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  } else if (setClauses.includes('role') && setClauses.includes('is_active')) {
    rows = await sql`UPDATE users SET role=${updates.role as string}, is_active=${updates.is_active as boolean}, updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  } else if (setClauses.includes('role')) {
    rows = await sql`UPDATE users SET role=${updates.role as string}, updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  } else if (setClauses.includes('is_active')) {
    rows = await sql`UPDATE users SET is_active=${updates.is_active as boolean}, updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  } else if (setClauses.includes('password_hash')) {
    rows = await sql`UPDATE users SET password_hash=${updates.password_hash as string}, updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  } else if (setClauses.includes('name')) {
    rows = await sql`UPDATE users SET name=${updates.name as string}, updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  } else {
    rows = await sql`UPDATE users SET updated_at=NOW() WHERE id=${id} RETURNING id, email, name, role, is_active`
  }

  if (!rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ user: rows[0] })
}

// DELETE /api/users/[id] — deactivate user (admin only, cannot delete self)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (id === session.user?.id) {
    return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
  }

  const rows = await sql`
    UPDATE users SET is_active = false, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `
  if (!rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
