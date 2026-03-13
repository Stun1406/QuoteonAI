import { findCompanyByDomain, findCompanyByName, createCompany } from '../tables/company'
import { findContactByEmail, createContact, updateContactDetails } from '../tables/contact'
import type { ContactInfo } from '../../types/preprocessor'
import type { CompanyRow, ContactRow } from '../../types/database'

export interface ResolvedContactCompany {
  company: CompanyRow | null
  contact: ContactRow | null
}

export async function resolveOrCreateCompanyContact(
  tenantId: string,
  contactInfo: ContactInfo
): Promise<ResolvedContactCompany> {
  let company: CompanyRow | null = null

  // Resolve company
  if (contactInfo.email) {
    const domain = contactInfo.email.split('@')[1]
    if (domain && !isGenericDomain(domain)) {
      company = await findCompanyByDomain(tenantId, domain)

      if (!company && contactInfo.company) {
        company = await findCompanyByName(tenantId, contactInfo.company)
      }

      if (!company) {
        const businessName = contactInfo.company || domainToBusinessName(domain)
        try {
          company = await createCompany(tenantId, {
            businessName,
            emailDomain: domain,
            website: contactInfo.website ?? null,
          })
        } catch {
          // Might have been created by concurrent request
          company = await findCompanyByDomain(tenantId, domain)
        }
      }
    } else if (contactInfo.company) {
      company = await findCompanyByName(tenantId, contactInfo.company)
      if (!company) {
        try {
          company = await createCompany(tenantId, {
            businessName: contactInfo.company,
            emailDomain: null,
            website: contactInfo.website ?? null,
          })
        } catch {
          company = await findCompanyByName(tenantId, contactInfo.company)
        }
      }
    }
  } else if (contactInfo.company) {
    company = await findCompanyByName(tenantId, contactInfo.company)
    if (!company) {
      try {
        company = await createCompany(tenantId, {
          businessName: contactInfo.company,
          emailDomain: null,
          website: contactInfo.website ?? null,
        })
      } catch {
        company = await findCompanyByName(tenantId, contactInfo.company)
      }
    }
  }

  // Resolve contact
  let contact: ContactRow | null = null

  if (contactInfo.email) {
    contact = await findContactByEmail(tenantId, contactInfo.email)

    if (!contact) {
      contact = await createContact(tenantId, {
        companyId: company?.id ?? null,
        name: contactInfo.name ?? null,
        email: contactInfo.email,
        title: contactInfo.title ?? null,
        phone: contactInfo.phone ?? null,
      })
    } else {
      // Update if we have more info
      if (contactInfo.name || contactInfo.title || contactInfo.phone) {
        await updateContactDetails(contact.id, {
          name: contactInfo.name,
          title: contactInfo.title,
          phone: contactInfo.phone,
        })
        contact = {
          ...contact,
          name: contact.name ?? contactInfo.name ?? null,
          title: contact.title ?? contactInfo.title ?? null,
          phone: contact.phone ?? contactInfo.phone ?? null,
        }
      }
    }
  } else if (contactInfo.name || contactInfo.phone) {
    contact = await createContact(tenantId, {
      companyId: company?.id ?? null,
      name: contactInfo.name ?? null,
      email: null,
      title: contactInfo.title ?? null,
      phone: contactInfo.phone ?? null,
    })
  }

  return { company, contact }
}

function isGenericDomain(domain: string): boolean {
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'msn.com', 'live.com']
  return genericDomains.includes(domain.toLowerCase())
}

function domainToBusinessName(domain: string): string {
  const parts = domain.split('.')
  const name = parts[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
