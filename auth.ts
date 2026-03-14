import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db/client'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = String(credentials.email).toLowerCase().trim()
        const password = String(credentials.password)

        const rows = await sql`
          SELECT id, email, name, password_hash, role, is_active
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `
        if (!rows.length) return null
        const user = rows[0] as {
          id: string; email: string; name: string | null
          password_hash: string | null; role: string; is_active: boolean
        }

        if (!user.is_active) return null
        if (!user.password_hash) return null // Google-only account
        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),

    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      async profile(profile) {
        // Only allow sign-in if user already exists in our DB
        const rows = await sql`
          SELECT id, email, name, role, is_active
          FROM users
          WHERE email = ${profile.email.toLowerCase()}
          LIMIT 1
        `
        if (!rows.length || !(rows[0] as { is_active: boolean }).is_active) {
          throw new Error('No account found. Contact an admin.')
        }
        const u = rows[0] as { id: string; email: string; name: string | null; role: string }
        return { id: u.id, email: u.email, name: u.name ?? profile.name, role: u.role }
      },
    }),
  ],
})
