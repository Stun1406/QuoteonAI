import { sql } from '../client'
import type { CompanyRow } from '../../types/database'

export async function findCompanyByDomain(tenantId: string, domain: string): Promise<CompanyRow | null> {
  const rows = await sql`
    SELECT * FROM companies
    WHERE tenant_id = ${tenantId} AND email_domain = ${domain}
    LIMIT 1
  `
  return rows[0] as CompanyRow || null
}

export async function findCompanyByName(tenantId: string, name: string): Promise<CompanyRow | null> {
  const rows = await sql`
    SELECT * FROM companies
    WHERE tenant_id = ${tenantId} AND LOWER(business_name) = LOWER(${name})
    LIMIT 1
  `
  return rows[0] as CompanyRow || null
}

export async function createCompany(tenantId: string, data: {
  businessName: string
  emailDomain?: string | null
  website?: string | null
}): Promise<CompanyRow> {
  const rows = await sql`
    INSERT INTO companies (tenant_id, business_name, email_domain, website)
    VALUES (${tenantId}, ${data.businessName}, ${data.emailDomain ?? null}, ${data.website ?? null})
    ON CONFLICT (tenant_id, email_domain) DO UPDATE
      SET business_name = EXCLUDED.business_name,
          updated_at = NOW()
    RETURNING *
  `
  return rows[0] as CompanyRow
}

export async function getCompanyById(id: string): Promise<CompanyRow | null> {
  const rows = await sql`SELECT * FROM companies WHERE id = ${id} LIMIT 1`
  return rows[0] as CompanyRow || null
}
