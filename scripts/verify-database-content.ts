import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { sql } from '../lib/db/client'

async function main() {
  console.log('=== Database Content Verification ===\n')

  const tables = ['tenants', 'projects', 'companies', 'contacts', 'message_threads', 'message_artifacts', 'llm_calls', 'email_threads', 'email_messages', 'email_failures']

  for (const table of tables) {
    const rows = await sql.query(`SELECT COUNT(*) AS count FROM ${table}`)
    console.log(`${table}: ${rows[0].count} rows`)
  }

  console.log('\nRecent threads:')
  const threads = await sql`
    SELECT mt.thread_id, mt.intent, mt.processor_type, mt.quote_value, mt.created_at,
           c.name AS contact_name, co.business_name AS company_name
    FROM message_threads mt
    LEFT JOIN contacts c ON mt.contact_id = c.id
    LEFT JOIN companies co ON mt.company_id = co.id
    ORDER BY mt.created_at DESC LIMIT 5
  `
  console.table(threads)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
