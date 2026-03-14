import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db/client'
import bcrypt from 'bcryptjs'

// GET /api/users — list all users (admin only)
export async function GET() {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await sql`
    SELECT id, email, name, role, is_active, created_at
    FROM users
    ORDER BY created_at ASC
  `
  return NextResponse.json({ users: rows })
}

// POST /api/users — create user (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, password, role } = body as {
    email: string; name: string; password?: string; role: string
  }

  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
  }
  if (!['staff', 'manager', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const password_hash = password ? await bcrypt.hash(password, 12) : null
  const creatorId = session.user?.id

  try {
    const rows = await sql`
      INSERT INTO users (email, name, password_hash, role, created_by)
      VALUES (${email.toLowerCase().trim()}, ${name ?? null}, ${password_hash}, ${role}, ${creatorId ?? null})
      RETURNING id, email, name, role, is_active, created_at
    `
    return NextResponse.json({ user: rows[0] }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    console.error('[POST /api/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
