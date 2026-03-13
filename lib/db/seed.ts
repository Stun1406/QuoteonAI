import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { sql } from './client'

async function seed() {
  console.log('Seeding database...')

  // Check if tenant already exists
  const existing = await sql`SELECT id, slug FROM tenants WHERE slug = 'fl-distribution'`

  let tenantId: string
  let projectId: string

  if (existing.length > 0) {
    tenantId = existing[0].id
    console.log(`  ✓ Tenant already exists: ${tenantId}`)

    const existingProject = await sql`
      SELECT id FROM projects WHERE tenant_id = ${tenantId} AND slug = 'quoton'
    `
    if (existingProject.length > 0) {
      projectId = existingProject[0].id
      console.log(`  ✓ Project already exists: ${projectId}`)
    } else {
      const project = await sql`
        INSERT INTO projects (tenant_id, name, slug, settings)
        VALUES (${tenantId}, 'Quoton', 'quoton', '{"version": "2"}')
        RETURNING id
      `
      projectId = project[0].id
      console.log(`  ✓ Created project: ${projectId}`)
    }
  } else {
    const tenant = await sql`
      INSERT INTO tenants (name, slug, settings)
      VALUES ('FL Distribution', 'fl-distribution', '{"company": "FL Distribution", "location": "Southern California"}')
      RETURNING id
    `
    tenantId = tenant[0].id
    console.log(`  ✓ Created tenant: ${tenantId}`)

    const project = await sql`
      INSERT INTO projects (tenant_id, name, slug, settings)
      VALUES (${tenantId}, 'Quoton', 'quoton', '{"version": "2"}')
      RETURNING id
    `
    projectId = project[0].id
    console.log(`  ✓ Created project: ${projectId}`)
  }

  console.log('\n=== Add these to your .env.local ===')
  console.log(`TENANT_ID=${tenantId}`)
  console.log(`PROJECT_ID=${projectId}`)
  console.log('=====================================\n')

  process.exit(0)
}

seed().catch(err => {
  console.error('Seed error:', err)
  process.exit(1)
})
