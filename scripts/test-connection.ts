import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { sql } from '../lib/db/client'

async function testConnection() {
  console.log('Testing database connection...')

  try {
    const result = await sql`SELECT NOW() AS current_time, version() AS pg_version`
    console.log('✓ Connected to database')
    console.log('  Current time:', result[0].current_time)
    console.log('  PostgreSQL version:', (result[0].pg_version as string).split(' ').slice(0, 2).join(' '))

    // Check tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    console.log('\n✓ Tables found:', tables.map((r: Record<string, unknown>) => r.table_name).join(', '))

    // Check tenant
    const tenants = await sql`SELECT id, name, slug FROM tenants LIMIT 5`
    if (tenants.length > 0) {
      console.log('\n✓ Tenants:', tenants.map((t: Record<string, unknown>) => `${t.name} (${t.id})`).join(', '))
    } else {
      console.log('\n⚠ No tenants found — run pnpm db:seed')
    }

    process.exit(0)
  } catch (err) {
    console.error('✗ Connection failed:', err)
    process.exit(1)
  }
}

testConnection()
