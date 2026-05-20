import { sql } from '../db/client'

export async function upsertWhatsAppContact(phone: string, name: string, email: string): Promise<void> {
  await sql`
    INSERT INTO whatsapp_contacts (phone, name, email, updated_at)
    VALUES (${phone}, ${name}, ${email}, NOW())
    ON CONFLICT (phone) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          updated_at = NOW()
  `
}

export async function getWhatsAppContact(phone: string): Promise<{ name: string; email: string } | null> {
  const rows = await sql`
    SELECT name, email FROM whatsapp_contacts WHERE phone = ${phone} LIMIT 1
  `
  return (rows[0] as { name: string; email: string }) || null
}
