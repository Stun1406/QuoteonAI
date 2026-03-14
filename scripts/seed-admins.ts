import { config } from 'dotenv'
config({ path: '.env.local' })
import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'
import { sql } from '../lib/db/client'
import fs from 'fs'
import path from 'path'

async function runMigration() {
  console.log('Running 005_auth.sql migration...')
  const db = neon(process.env.DATABASE_URL!)
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'migrations/005_auth.sql'),
    'utf-8'
  )
  // Split and run each statement individually
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await db.query(stmt)
    } catch (err: unknown) {
      const e = err as { message?: string }
      if (
        e?.message?.includes('already exists') ||
        e?.message?.includes('duplicate')
      ) {
        console.log(`  Skipped (already exists): ${stmt.slice(0, 40)}...`)
      } else {
        console.warn(`  Warning on: ${stmt.slice(0, 60)}\n  ${e?.message}`)
      }
    }
  }
  console.log('Migration complete.')
}

async function seedAdmins() {
  const admins = [
    { email: 'taanishchauhan1406@gmail.com', name: 'Taanish Chauhan' },
    { email: 'mariana.inofuentes@recruit3.ai', name: 'Mariana Inofuentes' },
  ]

  for (const admin of admins) {
    const existing = await sql`SELECT id FROM users WHERE email = ${admin.email}`
    if (existing.length > 0) {
      console.log(`Admin already exists: ${admin.email}`)
      continue
    }

    const tempPassword = 'QuotionAI2025!'
    const password_hash = await bcrypt.hash(tempPassword, 12)

    await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${admin.email}, ${admin.name}, ${password_hash}, 'admin')
    `
    console.log(`Created admin: ${admin.email} — temp password: ${tempPassword}`)
  }
}

async function main() {
  await runMigration()
  await seedAdmins()
  console.log('Done.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
