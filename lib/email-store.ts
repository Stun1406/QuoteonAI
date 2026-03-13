// In-memory email store — dev fallback only. DB is source of truth.
interface StoredEmail {
  id: string
  canonicalId: string
  from: string
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string
  receivedAt: Date
  trustLevel: string
}

const store: StoredEmail[] = []

export function storeEmail(email: StoredEmail): void {
  store.unshift(email)
  // Keep max 200 in memory
  if (store.length > 200) store.splice(200)
}

export function getEmailById(id: string): StoredEmail | undefined {
  return store.find(e => e.id === id)
}

export function getAllEmails(): StoredEmail[] {
  return store
}

export function clearEmails(): void {
  store.length = 0
}
