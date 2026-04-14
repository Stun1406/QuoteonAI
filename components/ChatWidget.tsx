'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  quote?: QuoteSummary
}

interface QuoteSummary {
  id: string
  thread_id?: string | null
  service_label: string
  sub_type: string
  port: string
  quantity: number
  quantity_unit: string
  total: number
  customer_email: string
}

// Simple markdown bold renderer
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function BotIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="#1e40af" />
      <circle cx="10" cy="12" r="2" fill="white" />
      <circle cx="18" cy="12" r="2" fill="white" />
      <path d="M9 17c1.2 1.5 8.8 1.5 10 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="12" y="5" width="4" height="3" rx="1" fill="white" opacity=".6" />
    </svg>
  )
}

function ChatBubbleIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M6 6l10 10M16 6L6 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 4h14a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" fill="white" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M15.5 2.5L8 10M15.5 2.5L10.5 15.5L8 10M15.5 2.5L2.5 7.5L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function QuoteCard({
  quote,
  onAction,
}: {
  quote: QuoteSummary
  onAction?: (action: 'accept' | 'decline' | 'revise') => void
}) {
  const [actionTaken, setActionTaken] = useState<'accept' | 'decline' | 'revise' | null>(null)
  const [updating, setUpdating] = useState(false)

  async function handleAction(action: 'accept' | 'decline' | 'revise') {
    setUpdating(true)
    const statusMap = { accept: 'won', decline: 'lost', revise: 'revision-requested' }
    try {
      await fetch('/api/chat/quote/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          threadId: quote.thread_id ?? undefined,
          status: statusMap[action],
        }),
      })
    } catch { /* best-effort */ }
    setActionTaken(action)
    setUpdating(false)
    onAction?.(action)
  }

  const actionLabel = actionTaken === 'accept'
    ? '✓ Quote Accepted'
    : actionTaken === 'decline'
    ? '✗ Quote Declined'
    : actionTaken === 'revise'
    ? '✎ Revision Requested'
    : null

  return (
    <div className="mt-2 bg-white border border-blue-200 rounded-xl p-3 text-xs shadow-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-blue-800 text-[11px] uppercase tracking-wide">Quote Generated</span>
        <span className="text-slate-400 font-mono text-[10px]">{quote.id}</span>
      </div>

      {/* Details */}
      <div className="space-y-1 text-slate-600">
        <div className="flex justify-between">
          <span>Service</span>
          <span className="font-medium text-slate-800">{quote.service_label} — {quote.sub_type}</span>
        </div>
        <div className="flex justify-between">
          <span>Port / Region</span>
          <span className="font-medium text-slate-800">{quote.port}</span>
        </div>
        <div className="flex justify-between">
          <span>Qty</span>
          <span className="font-medium text-slate-800">{quote.quantity} {quote.quantity_unit}</span>
        </div>
      </div>

      {/* Total */}
      <div className="mt-2 pt-2 border-t border-blue-100 flex justify-between items-center">
        <span className="text-slate-500">Total</span>
        <span className="text-lg font-bold text-blue-700">${quote.total.toLocaleString()}</span>
      </div>

      {/* Sent confirmation + thread ID */}
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-green-600 text-[11px]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sent to {quote.customer_email}
        </div>
        {quote.thread_id && (
          <span className="font-mono text-[10px] text-slate-400">{quote.thread_id}</span>
        )}
      </div>

      {/* Action buttons */}
      {!actionTaken ? (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 mb-2 font-medium">Respond to this quote:</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleAction('accept')}
              disabled={updating}
              className="flex-1 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 font-semibold text-[11px] hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              ✓ Accept
            </button>
            <button
              onClick={() => handleAction('revise')}
              disabled={updating}
              className="flex-1 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-[11px] hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              ✎ Revise
            </button>
            <button
              onClick={() => handleAction('decline')}
              disabled={updating}
              className="flex-1 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold text-[11px] hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              ✗ Decline
            </button>
          </div>
        </div>
      ) : (
        <div className={`mt-3 pt-2 border-t border-slate-100 text-center text-[12px] font-semibold ${
          actionTaken === 'accept' ? 'text-green-600' : actionTaken === 'decline' ? 'text-red-500' : 'text-amber-600'
        }`}>
          {actionLabel}
        </div>
      )}
    </div>
  )
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Hi! I'm Quoty, QuoteonAI's assistant.\n\nI can help you understand our platform or generate an instant freight quote for **Drayage**, **Transloading**, or **Last Mile** delivery.\n\nWhat can I help you with today?`,
}

const SUGGESTED = [
  'Get a drayage quote',
  'Get a transloading quote',
  'What is QuoteonAI?',
  'Get a last mile quote',
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggested, setShowSuggested] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setShowSuggested(false)

    const userMsg: Message = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content ?? 'Sorry, something went wrong.',
        quote: data.quote,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[370px] max-w-[calc(100vw-2rem)] flex flex-col"
          style={{ height: 520, filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.18))' }}>
          <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-slate-200">

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1e40af] flex-shrink-0">
              <BotIcon />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">QuoteonAI Assistant</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-blue-200 text-[11px]">Online · Instant quotes</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-blue-200 hover:text-white transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 flex-shrink-0 mt-0.5">
                      <BotIcon />
                    </div>
                  )}
                  <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-[#1e40af] text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                    }`}>
                      {renderContent(msg.content)}
                    </div>
                    {msg.quote && (
                      <QuoteCard
                        quote={msg.quote}
                        onAction={(action) => {
                          const replies = {
                            accept: `I'd like to accept quote ${msg.quote!.id}. Please proceed with the booking.`,
                            decline: `I'd like to decline quote ${msg.quote!.id}. Thank you for your time.`,
                            revise: `I'd like to request a revision for quote ${msg.quote!.id}. Could we discuss the details?`,
                          }
                          send(replies[action])
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 flex-shrink-0 mt-0.5"><BotIcon /></div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested prompts */}
              {showSuggested && messages.length === 1 && !loading && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTED.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full text-slate-600 hover:border-blue-400 hover:text-blue-700 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 bg-white flex-shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a message..."
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-colors disabled:opacity-50 text-slate-800 placeholder-slate-400"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1e40af] text-white disabled:opacity-40 hover:bg-blue-700 transition-colors flex-shrink-0">
                <SendIcon />
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-1.5 bg-white border-t border-slate-100 flex-shrink-0">
              <p className="text-[10px] text-slate-400 text-center">Powered by QuoteonAI · Quotes sent to your email</p>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-[#1e40af] hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        aria-label="Open chat"
      >
        <ChatBubbleIcon open={open} />
        {!open && messages.length > 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  )
}
