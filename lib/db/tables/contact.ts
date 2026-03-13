import { sql } from '../client'
import type { ContactRow } from '../../types/database'

export async function findContactByEmail(tenantId: string, email: string): Promise<ContactRow | null> {
  const rows = await sql`
    SELECT * FROM contacts
    WHERE tenant_id = ${tenantId} AND email = ${email}
    LIMIT 1
  `
  return rows[0] as ContactRow || null
}

export async function createContact(tenantId: string, data: {
  companyId?: string | null
  name?: string | null
  email?: string | null
  title?: string | null
  phone?: string | null
}): Promise<ContactRow> {
  const rows = await sql`
    INSERT INTO contacts (tenant_id, company_id, name, email, title, phone, last_interaction_at)
    VALUES (${tenantId}, ${data.companyId ?? null}, ${data.name ?? null}, ${data.email ?? null}, ${data.title ?? null}, ${data.phone ?? null}, NOW())
    ON CONFLICT (tenant_id, email) DO UPDATE
      SET last_interaction_at = NOW(),
          name = COALESCE(contacts.name, EXCLUDED.name),
          title = COALESCE(contacts.title, EXCLUDED.title),
          phone = COALESCE(contacts.phone, EXCLUDED.phone),
          updated_at = NOW()
    RETURNING *
  `
  return rows[0] as ContactRow
}

export async function updateContactInteraction(id: string): Promise<void> {
  await sql`
    UPDATE contacts SET last_interaction_at = NOW(), updated_at = NOW() WHERE id = ${id}
  `
}

export async function updateContactDetails(id: string, data: {
  name?: string | null
  title?: string | null
  phone?: string | null
}): Promise<void> {
  await sql`
    UPDATE contacts SET
      name = COALESCE(name, ${data.name ?? null}),
      title = COALESCE(title, ${data.title ?? null}),
      phone = COALESCE(phone, ${data.phone ?? null}),
      last_interaction_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function getContactById(id: string): Promise<ContactRow | null> {
  const rows = await sql`SELECT * FROM contacts WHERE id = ${id} LIMIT 1`
  return rows[0] as ContactRow || null
}
