import { config } from 'dotenv'
config({ path: '.env.local' })
config() // fallback to .env
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sql } from './client'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function runMigrations() {
  console.log('Running migrations...')

  // Create migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const migrationsDir = join(__dirname, '../../migrations')
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    const applied = await sql`SELECT id FROM _migrations WHERE filename = ${file}`
    if (applied.length > 0) {
      console.log(`  ✓ ${file} (already applied)`)
      continue
    }

    const sqlContent = readFileSync(join(migrationsDir, file), 'utf-8')
    console.log(`  → Applying ${file}...`)

    try {
      // Split into individual statements — Neon doesn't allow multiple commands in a prepared statement
      const statements = sqlContent
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      for (const stmt of statements) {
        await sql.unsafe(stmt)
      }
      await sql`INSERT INTO _migrations (filename) VALUES (${file})`
      console.log(`  ✓ ${file}`)
    } catch (err) {
      console.error(`  ✗ ${file} failed:`, err)
      process.exit(1)
    }
  }

  console.log('Migrations complete.')
  process.exit(0)
}

runMigrations().catch(err => {
  console.error('Migration error:', err)
  process.exit(1)
})
