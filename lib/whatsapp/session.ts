export interface WaMessage { role: 'user' | 'assistant'; content: string }

interface Session {
  messages: WaMessage[]
  lastActivity: number
}

const store = new Map<string, Session>()
const TTL_MS = 30 * 60 * 1000 // 30 minutes of inactivity resets the conversation

export function getMessages(phone: string): WaMessage[] {
  const s = store.get(phone)
  if (!s) return []
  if (Date.now() - s.lastActivity > TTL_MS) {
    store.delete(phone)
    return []
  }
  return s.messages
}

export function push(phone: string, msg: WaMessage): void {
  const msgs = getMessages(phone)
  store.set(phone, { messages: [...msgs, msg], lastActivity: Date.now() })
}

export function reset(phone: string): void {
  store.delete(phone)
}
