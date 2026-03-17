import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db/client'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email/send'

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
    const newUser = rows[0] as { id: string; email: string; name: string | null; role: string }

    // Send welcome email with login details
    if (password) {
      try {
        await sendEmail({
          to: newUser.email,
          subject: 'Your QuotionAI account has been created',
          text: `Hi ${newUser.name ?? newUser.email},\n\nYour QuotionAI account has been set up.\n\nLogin URL: ${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}\nEmail: ${newUser.email}\nPassword: ${password}\nRole: ${newUser.role}\n\nPlease log in and change your password as soon as possible.\n\n— QuotionAI`,
          html: `<p>Hi ${newUser.name ?? newUser.email},</p><p>Your QuotionAI account has been set up.</p><table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Login URL</td><td style="padding:4px 0;font-size:14px"><a href="${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}">${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}</a></td></tr><tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Email</td><td style="padding:4px 0;font-size:14px">${newUser.email}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Password</td><td style="padding:4px 0;font-size:14px;font-family:monospace;font-weight:bold">${password}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Role</td><td style="padding:4px 0;font-size:14px">${newUser.role}</td></tr></table><p style="color:#6b7280;font-size:13px">Please log in and change your password as soon as possible.</p><p>— QuotionAI</p>`,
        })
      } catch (emailErr) {
        console.error('[POST /api/users] welcome email failed:', emailErr)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    console.error('[POST /api/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
