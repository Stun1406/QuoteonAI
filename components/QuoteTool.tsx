'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import { useSession, signOut } from 'next-auth/react'
import CrmPanel from '@/components/crm/CrmPanel'
import { calculateDrayageQuote } from '@/lib/pricing/drayage'
import { estimateDrayageForUnknownCity } from '@/lib/pricing/drayage-distance'
import { calculateWarehouseQuote } from '@/lib/pricing/calculator'
import { calculateLastMileQuote } from '@/lib/pricing/last-mile'
import {
  getDefaultPricingLogicCatalog,
  PRICING_CATEGORY_ORDER,
  type PricingLogicRate,
} from '@/lib/pricing/pricing-logic-catalog'
import type { DrayageExtraction, QuoteExtraction, DrayageQuoteResult } from '@/lib/types/quote'
import type { LastMileExtraction } from '@/lib/types/processor'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabMode =
  | 'inbox'
  | 'ai-review'
  | 'quote-builder'
  | 'search'
  | 'pricing-logic'
  | 'pricing-history'
  | 'customer'
  | 'team'
  | 'crm'

type QuoteBuilderSubTab = 'drayage' | 'transloading' | 'last-mile'

type AppUser = {
  id: string; email: string; name: string | null; role: string; is_active: boolean
  created_at: string
}

type RateChangeRequest = {
  id: string; rate_key: string; rate_label: string
  current_value: number; requested_value: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string; requester_name: string | null; requester_email: string
  reviewer_name: string | null; reviewed_at: string | null; review_note: string | null
}

type MockEmail = {
  id: string
  from: string
  to: string
  subject: string
  body: string
  date: string
  status: 'new' | 'in-progress' | 'responded'
  responses: Array<{
    id: string
    body: string
    sentAt: string
    role: 'user' | 'ai'
    format: 'html' | 'text'
  }>
  company?: string
  phone?: string
  threadKey?: string
  customerTier?: string
  isRead?: boolean
  source?: 'real' | 'mock'
  emailThreadId?: string
}

type AiQueueItem = {
  id: string
  emailId: string
  emailThreadId?: string
  from: string
  subject: string
  originalBody: string
  draft: string
  threadId?: string
  conversation: Array<{ role: 'user' | 'ai'; text: string }>
  sent: boolean
  outcome?: 'won' | 'lost'
}

type PricingHistoryEntry = {
  id: string
  rateId: string
  label: string
  previousValue: number
  newValue: number
  changedBy: string
  comment: string
  changedAt: string
}

type CustomerSettings = {
  companyName: string
  phoneNumber: string
  supportEmail: string
  quoteEmail: string
  address: string
  website: string
  quoteValidityDays: number
  paymentTerms: 'Due on Receipt' | 'Net 15' | 'Net 30' | 'Net 45'
  includeTermsAndConditions: boolean
  autoSendQuotes: boolean
  requireApproval: boolean
  primaryDomain: string
  additionalDomains: string[]
}

type ContainerFormGroup = {
  containerCount: number
  containerSize: '20ft' | '40ft' | '45ft' | '53ft'
  cargoPackaging: 'pallet' | 'loose-cargo'
  palletCount: number
  palletSize: 'normal' | 'oversize'
  looseCargoCount: number
}

type SearchThread = {
  id: string
  subject: string
  from: string
  to: string
  status: string
  last_message_at: string
  created_at: string
  first_message: string | null
  message_count: number
  reply_count: number
}

type EmailMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  to_email: string
  body_text: string
  body_html: string | null
  is_read: boolean
  received_at: string
}

type AiThreadEntry = {
  id: string
  thread_id: string
  intent: string
  processor_type: string
  ai_status: string
  quote_value: number | null
  confidence_score: number | null
  ai_created_at: string
  contact_name: string | null
  company_name: string | null
  artifacts: Array<{
    artifact_type: string
    artifact_data: Record<string, unknown>
    sequence_order: number
    created_at: string
  }>
}

type ThreadDetail = {
  thread: {
    id: string
    subject: string
    participant_from: string
    participant_to: string
    status: string
    last_message_at: string
    created_at: string
  }
  messages: EmailMessage[]
  aiThreads: AiThreadEntry[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { id: TabMode; label: string; minRole?: string }[] = [
  { id: 'inbox', label: 'Message Inbox' },
  { id: 'ai-review', label: 'AI Quote Builder' },
  { id: 'quote-builder', label: 'Quote Simulator' },
  { id: 'search', label: 'Search Thread' },
  { id: 'pricing-logic', label: 'Rate Sheet' },
  { id: 'pricing-history', label: 'Change History', minRole: 'manager' },
  { id: 'customer', label: 'Business Settings', minRole: 'manager' },
  { id: 'team', label: 'Organization', minRole: 'admin' },
  { id: 'crm', label: 'CRM' },
]

function roleLevel(role?: string): number {
  if (role === 'admin') return 3
  if (role === 'manager') return 2
  return 1 // staff or undefined
}

const DEFAULT_CUSTOMER_SETTINGS: CustomerSettings = {
  companyName: 'FL Distributions',
  phoneNumber: '(424) 555-0187',
  supportEmail: '',
  quoteEmail: '',
  address: '',
  website: '',
  quoteValidityDays: 7,
  paymentTerms: 'Net 30',
  includeTermsAndConditions: false,
  autoSendQuotes: false,
  requireApproval: false,
  primaryDomain: '',
  additionalDomains: [],
}

const SAMPLE_EMAILS: MockEmail[] = [
  {
    id: 'email-001',
    from: 'mike.chen@pacificimports.com',
    to: 'quotes@fldistributions.com',
    subject: 'Drayage Quote Request – 40ft Container to Ontario',
    body: `Hi FL Distribution team,

We need a drayage quote for the following shipment arriving next week at the Port of Long Beach:

- Container size: 40ft standard
- Weight: approximately 42,000 lbs
- Destination: Ontario, CA 91761
- 1 chassis day required
- Need Pier Pass included

We will also need the WCCP chassis for 2 days. Please include any applicable TCF charges.

Time is somewhat sensitive — hoping to get pricing by end of day.

Best regards,
Mike Chen
Pacific Imports LLC
(909) 555-0234`,
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    responses: [],
    company: 'Pacific Imports LLC',
    phone: '(909) 555-0234',
    threadKey: 'thread-001',
    customerTier: 'bronze',
    isRead: false,
  },
  {
    id: 'email-002',
    from: 'sarah.rodriguez@westernlogco.com',
    to: 'quotes@fldistributions.com',
    subject: 'Transloading & Storage Quote – 2x40ft Containers',
    body: `Good morning,

I'm reaching out on behalf of Western Logistics Co. We have 2 x 40ft containers arriving from Shanghai next month and need transloading and short-term storage.

Details:
- 2 x 40ft containers
- Approximately 400 pallets total (normal size)
- Need shrink wrap on all pallets
- Will require BOL documentation
- Storage duration: approx 45 days
- No after-hours or weekend access needed

Can you provide a quote for the full service? We'd also like to know about your container seal service.

Thanks,
Sarah Rodriguez
Operations Manager
Western Logistics Co.
(562) 555-0189`,
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'in-progress',
    responses: [
      {
        id: 'resp-001',
        body: 'Hi Sarah, thank you for reaching out! We are preparing your transloading and storage quote. Please expect a detailed response within 2 hours.',
        sentAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
        role: 'ai',
        format: 'text',
      },
    ],
    company: 'Western Logistics Co.',
    phone: '(562) 555-0189',
    threadKey: 'thread-002',
    customerTier: 'silver',
    isRead: true,
  },
  {
    id: 'email-003',
    from: 'david.park@sunrisedistrib.com',
    to: 'info@fldistributions.com',
    subject: 'General Inquiry – Your Logistics Services',
    body: `Hello,

I found your company through a referral from a colleague at Harbor Freight. We're a mid-size distributor based in the Inland Empire and looking for a reliable logistics partner for our import operations.

We typically receive 6–10 containers per month from various ports (LA, LB, Oakland) and need:

1. Drayage to our warehouse in Fontana
2. Transloading services
3. Potentially last-mile delivery to our retail partners in the greater LA area

Could you send over a service overview and general pricing guide? We'd like to set up a call to discuss a potential partnership.

Thank you,
David Park
Sunrise Distribution
Fontana, CA 92335
(909) 555-0312`,
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    responses: [],
    company: 'Sunrise Distribution',
    phone: '(909) 555-0312',
    threadKey: 'thread-003',
    customerTier: 'unranked',
    isRead: false,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}


function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

function simpleMarkdownToHtml(md: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inlineFormat = (s: string) => escape(s).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Group lines into table blocks and regular lines
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    // Detect markdown table (starts and ends with |, or is a separator |---|)
    if (/^\|.*\|$/.test(line.trim())) {
      const tableLines: string[] = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i])
        i++
      }
      // First row = header, second row = separator (skip), rest = body
      const [header, , ...body] = tableLines
      const thCells = header.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
        .map(c => `<th style="padding:8px 14px;text-align:left;background:#F1F5F9;border-bottom:2px solid #CBD5E1;">${inlineFormat(c.trim())}</th>`).join('')
      const bodyRows = body.map(row => {
        const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
          .map(c => `<td style="padding:7px 14px;border-bottom:1px solid #E2E8F0;">${inlineFormat(c.trim())}</td>`).join('')
        return `<tr>${cells}</tr>`
      }).join('')
      htmlParts.push(`<table style="width:100%;border-collapse:collapse;margin:12px 0;font-family:Arial,sans-serif;font-size:13px;"><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>`)
      continue
    }

    // Regular line
    if (line === '') {
      htmlParts.push('<br>')
    } else if (/^─+$/.test(line)) {
      htmlParts.push('<hr style="border:none;border-top:1px solid #E5E7EB;margin:6px 0;">')
    } else if (/^═+$/.test(line)) {
      htmlParts.push('<hr style="border:none;border-top:2px solid #374151;margin:6px 0;">')
    } else {
      htmlParts.push(`<p style="margin:3px 0;font-family:Arial,sans-serif;font-size:13px;">${inlineFormat(line)}</p>`)
    }
    i++
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">${htmlParts.join('\n')}</body></html>`
}

function statusBadgeClass(status: 'new' | 'in-progress' | 'responded') {
  if (status === 'new') return 'bg-gray-100 text-gray-600'
  if (status === 'in-progress') return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function statusLabel(status: 'new' | 'in-progress' | 'responded') {
  if (status === 'new') return 'New'
  if (status === 'in-progress') return 'Unresponded'
  return 'Responded'
}

function formatDrayageEmail(result: DrayageQuoteResult, companyName: string, phoneNumber: string): string {
  const lines = result.lineItems.map(
    item => `${item.code.padEnd(8)} ${item.description.padEnd(35)} ${fmt$(item.amount).padStart(10)}`
  ).join('\n')
  return `Hi Team,

Thank you for reaching out! Please find your drayage quote below.

QUOTE DETAILS
─────────────
Destination:  ${result.city}
Container:    ${result.containerSize} ft
Weight:       ${result.containerWeightLbs ? result.containerWeightLbs.toLocaleString() + ' lbs' : 'Not specified'}

LINE ITEMS
──────────
${lines}
─────────────────────────────────────────────────────
SUBTOTAL${fmt$(result.subtotal).padStart(49)}

BASIS
─────
${result.basisNotes.join('\n')}

Best Regards,
Jacob Hernandez
Operations Lead | ${companyName}
${phoneNumber}`
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] transition-colors text-left"
    >
      <div>
        <div className="text-sm font-medium text-[var(--color-text-1)]">{label}</div>
        {description && <div className="text-xs text-[var(--color-text-3)]">{description}</div>}
      </div>
      <span
        className={`ml-4 px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
          value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {value ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function ToggleBtn({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
        value
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function Card({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl p-5">
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-sm font-semibold text-[var(--color-text-1)]">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">{children}</label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-[var(--color-text-1)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 ${props.className ?? ''}`}
    />
  )
}

// Numeric input that allows free editing (backspace to zero, etc.)
function NumericInput({
  value, onChange, min, step, placeholder,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  placeholder?: string
}) {
  const [text, setText] = React.useState(value === 0 ? '' : String(value))
  const externalRef = React.useRef(value)

  // Sync when parent resets the value (e.g. ↺ Reset)
  React.useEffect(() => {
    if (externalRef.current !== value) {
      externalRef.current = value
      setText(value === 0 ? '' : String(value))
    }
  })

  const isDecimal = step !== undefined && step < 1
  const pattern = isDecimal ? /^\d*\.?\d*$/ : /^\d*$/

  return (
    <input
      type="text"
      inputMode={isDecimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder ?? '0'}
      min={min}
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-[var(--color-text-1)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
      onChange={e => {
        const raw = e.target.value
        if (raw === '' || pattern.test(raw)) {
          setText(raw)
          const n = raw === '' || raw === '.' ? 0 : parseFloat(raw)
          if (!isNaN(n)) {
            externalRef.current = n
            onChange(n)
          }
        }
      }}
      onBlur={() => {
        const n = text === '' || text === '.' ? 0 : parseFloat(text)
        setText(isNaN(n) || n === 0 ? '' : String(n))
      }}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-[var(--color-text-1)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 ${props.className ?? ''}`}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-[var(--color-text-1)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 resize-y ${props.className ?? ''}`}
    />
  )
}

function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const base = 'rounded-lg font-medium transition-colors disabled:opacity-50'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 shadow-sm',
    secondary: 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-slate-700 border border-slate-200 hover:bg-slate-100',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]}`}
    >
      {children}
    </button>
  )
}

function CopyBtn({ getText, label = 'Copy' }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(getText())
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuoteTool() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string })?.role ?? 'staff'
  const [signOutPending, startSignOut] = useTransition()
  const [tab, setTab] = useState<TabMode>('inbox')
  const [qbSubTab, setQbSubTab] = useState<QuoteBuilderSubTab>('drayage')
  const [profileOpen, setProfileOpen] = useState(false)

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('quotion_theme')
    const dark = saved === 'dark'
    setIsDark(dark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [])
  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('quotion_theme', next ? 'dark' : 'light')
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────
  const [emails, setEmails] = useState<MockEmail[]>([])
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set())
  const [composeFrom, setComposeFrom] = useState('')
  const [composeTo, setComposeTo] = useState('quote-agent@quotify.cc')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxError, setInboxError] = useState('')

  // ── AI Queue ───────────────────────────────────────────────────────────────
  const [aiQueue, setAiQueue] = useState<AiQueueItem[]>([])
  const [queueDrafts, setQueueDrafts] = useState<Record<string, string>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({})

  // ── Drayage ────────────────────────────────────────────────────────────────
  const [dCity, setDCity] = useState('')
  const [dContainerSize, setDContainerSize] = useState('40')
  const [dWeight, setDWeight] = useState('')
  const [dExtraStops, setDExtraStops] = useState(0)
  const [dChassisDays, setDChassisDays] = useState(0)
  const [dWccp, setDWccp] = useState(0)
  const [dWaiting, setDWaiting] = useState(0)
  const [dLiveUnload, setDLiveUnload] = useState(0)
  const [dPierPass, setDPierPass] = useState(true)
  const [dTcf, setDTcf] = useState(true)
  const [dChassisSplit, setDChassisSplit] = useState(false)
  const [dRush, setDRush] = useState(false)
  const [dResult, setDResult] = useState<DrayageQuoteResult | null>(null)
  const [dWarning, setDWarning] = useState('')

  // ── Transloading ───────────────────────────────────────────────────────────
  const [tGroups, setTGroups] = useState<ContainerFormGroup[]>([
    {
      containerCount: 1,
      containerSize: '40ft',
      cargoPackaging: 'pallet',
      palletCount: 20,
      palletSize: 'normal',
      looseCargoCount: 0,
    },
  ])
  const [tShrinkWrap, setTShrinkWrap] = useState(false)
  const [tShrinkWrapPallets, setTShrinkWrapPallets] = useState(0)
  const [tSeal, setTSeal] = useState(false)
  const [tBol, setTBol] = useState(false)
  const [tStorageEnabled, setTStorageEnabled] = useState(false)
  const [tStoragePallets, setTStoragePallets] = useState(0)
  const [tStoragePalletSize, setTStoragePalletSize] = useState<'normal' | 'oversize'>('normal')
  const [tStorageDays, setTStorageDays] = useState(30)
  const [tAfterHours, setTAfterHours] = useState(false)
  const [tWeekend, setTWeekend] = useState(false)
  const [tResult, setTResult] = useState<ReturnType<typeof calculateWarehouseQuote> | null>(null)

  // ── Last Mile ──────────────────────────────────────────────────────────────
  const [lmMiles, setLmMiles] = useState('')
  const [lmTruckType, setLmTruckType] = useState('straight-truck')
  const [lmStops, setLmStops] = useState(1)
  const [lmLiftgate, setLmLiftgate] = useState(false)
  const [lmResidential, setLmResidential] = useState(false)
  const [lmReefer, setLmReefer] = useState(false)
  const [lmHazmat, setLmHazmat] = useState(false)
  const [lmOversize, setLmOversize] = useState(false)
  const [lmHighValue, setLmHighValue] = useState(false)
  const [lmResult, setLmResult] = useState<ReturnType<typeof calculateLastMileQuote> | null>(null)
  const [lmHighValueAdded, setLmHighValueAdded] = useState(false)

  // ── Simulator discount / tax ───────────────────────────────────────────────
  const [simDiscountPct, setSimDiscountPct] = useState<number | null>(null)
  const [simTaxPct, setSimTaxPct] = useState<number | null>(null)
  const [showDiscountPicker, setShowDiscountPicker] = useState(false)
  const [showTaxPicker, setShowTaxPicker] = useState(false)
  const [discountCustomMode, setDiscountCustomMode] = useState(false)
  const [taxCustomMode, setTaxCustomMode] = useState(false)
  const [discountCustomVal, setDiscountCustomVal] = useState('')
  const [taxCustomVal, setTaxCustomVal] = useState('')

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchBy, setSearchBy] = useState('Subject')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchThread[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  // ── Pricing Logic ──────────────────────────────────────────────────────────
  const [pricingRates, setPricingRates] = useState<PricingLogicRate[]>([])
  const [pricingSearch, setPricingSearch] = useState('')
  const [pricingCategory, setPricingCategory] = useState('All')
  const [selectedRate, setSelectedRate] = useState<PricingLogicRate | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editComment, setEditComment] = useState('')
  const [editChangedBy, setEditChangedBy] = useState('')
  const [editError, setEditError] = useState('')

  // ── Pricing History ────────────────────────────────────────────────────────
  const [pricingHistory, setPricingHistory] = useState<PricingHistoryEntry[]>([])

  // ── Customer Settings ──────────────────────────────────────────────────────
  const [settings, setSettings] = useState<CustomerSettings>(DEFAULT_CUSTOMER_SETTINGS)
  const [newDomain, setNewDomain] = useState('')
  const [savedAt, setSavedAt] = useState('')

  // ── Team / User Management ─────────────────────────────────────────────────
  const [teamUsers, setTeamUsers] = useState<AppUser[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [addUserEmail, setAddUserEmail] = useState('')
  const [addUserName, setAddUserName] = useState('')
  const [addUserPassword, setAddUserPassword] = useState('')
  const [addUserRole, setAddUserRole] = useState('staff')
  const [addUserError, setAddUserError] = useState('')
  const [addUserSuccess, setAddUserSuccess] = useState('')
  const [knownPasswords, setKnownPasswords] = useState<Record<string, string>>({})
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null)
  const [resetPwValue, setResetPwValue] = useState('')
  const [resetPwLoading, setResetPwLoading] = useState(false)
  const [revealPw, setRevealPw] = useState<Record<string, boolean>>({})
  const [rateRequests, setRateRequests] = useState<RateChangeRequest[]>([])
  const [rateReqLoading, setRateReqLoading] = useState(false)
  // Rate change request form (for staff/manager)
  const [rcrRateKey, setRcrRateKey] = useState('')
  const [rcrRateLabel, setRcrRateLabel] = useState('')
  const [rcrCurrentVal, setRcrCurrentVal] = useState(0)
  const [rcrRequestedVal, setRcrRequestedVal] = useState(0)
  const [rcrReason, setRcrReason] = useState('')
  const [rcrSubmitting, setRcrSubmitting] = useState(false)
  const [rcrSuccess, setRcrSuccess] = useState('')
  const [rcrError, setRcrError] = useState('')

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Mock emails from localStorage
    try {
      const raw = localStorage.getItem('fld_mock_inbox')
      const mocks: MockEmail[] = raw ? JSON.parse(raw) : SAMPLE_EMAILS
      if (!raw) localStorage.setItem('fld_mock_inbox', JSON.stringify(SAMPLE_EMAILS))
      setEmails(mocks.map(e => ({ ...e, source: 'mock' as const })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch {
      setEmails(SAMPLE_EMAILS.map(e => ({ ...e, source: 'mock' as const })))
    }
    // Real emails from the API (overlaid on top of mocks)
    loadRealEmails()

    // Poll for new real emails every 30 seconds
    const pollInterval = setInterval(() => loadRealEmails(), 30_000)

    // Pricing rates
    try {
      const raw = localStorage.getItem('fld_pricing_logic_rates_v1')
      if (raw) {
        setPricingRates(JSON.parse(raw))
      } else {
        const defaults = getDefaultPricingLogicCatalog()
        setPricingRates(defaults)
      }
    } catch {
      setPricingRates(getDefaultPricingLogicCatalog())
    }

    // Pricing history
    try {
      const raw = localStorage.getItem('fld_pricing_logic_history_v1')
      if (raw) setPricingHistory(JSON.parse(raw))
    } catch {
      // ignore
    }

    // Customer settings
    try {
      const raw = localStorage.getItem('fld_customer_settings')
      if (raw) setSettings({ ...DEFAULT_CUSTOMER_SETTINGS, ...JSON.parse(raw) })
    } catch {
      // ignore
    }

    return () => clearInterval(pollInterval)
  }, [])

  const persistEmails = useCallback((updated: MockEmail[]) => {
    setEmails(updated)
    // Only persist mock (non-real) emails to localStorage
    const mockOnly = updated.filter(e => !e.source || e.source === 'mock')
    localStorage.setItem('fld_mock_inbox', JSON.stringify(mockOnly))
  }, [])

  const loadRealEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox')
      if (!res.ok) return
      const { emails: realEmails } = await res.json() as { emails: MockEmail[] }
      setEmails(prev => {
        const mockEmails = prev.filter(e => !e.source || e.source === 'mock')
        const realIds = new Set(realEmails.map(e => e.id))
        const dedupedMocks = mockEmails.filter(e => !realIds.has(e.id))
        return [...realEmails, ...dedupedMocks].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      })
    } catch {
      // API unavailable — keep showing mock emails only
    }
  }, [])

  const persistHistory = useCallback((updated: PricingHistoryEntry[]) => {
    setPricingHistory(updated)
    localStorage.setItem('fld_pricing_logic_history_v1', JSON.stringify(updated))
  }, [])

  // ── Inbox handlers ─────────────────────────────────────────────────────────
  const selectedEmail = emails.find(e => e.id === selectedEmailId) ?? null

  function selectEmail(id: string) {
    setSelectedEmailId(id)
    const updated = emails.map(e =>
      e.id === id
        ? { ...e, isRead: true, status: e.status === 'new' ? ('in-progress' as const) : e.status }
        : e
    )
    persistEmails(updated)
  }

  function toggleCheck(id: string) {
    setCheckedEmails(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function deleteSelected() {
    const updated = emails.filter(e => !checkedEmails.has(e.id))
    persistEmails(updated)
    setCheckedEmails(new Set())
    if (selectedEmailId && checkedEmails.has(selectedEmailId)) setSelectedEmailId(null)
  }

  function deleteAll() {
    persistEmails([])
    setCheckedEmails(new Set())
    setSelectedEmailId(null)
  }

  async function sendToAiQuote(body: string, emailId?: string) {
    setInboxLoading(true)
    setInboxError('')
    try {
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (!processRes.ok) {
        const errBody = await processRes.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Process API returned ${processRes.status}`)
      }
      const processData = await processRes.json()

      const convertRes = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: processData,
          originalRequest: body,
          threadId: processData.threadUuid,
        }),
      })
      if (!convertRes.ok) throw new Error(`Convert API returned ${convertRes.status}`)
      const convertData = await convertRes.json()

      const email = emailId ? emails.find(e => e.id === emailId) : null
      const initialDraft = convertData.markdown ?? convertData.plainText ?? ''
      const item: AiQueueItem = {
        id: uid(),
        emailId: emailId ?? '',
        emailThreadId: email?.emailThreadId,
        from: email?.from ?? composeFrom,
        subject: email?.subject ?? composeSubject,
        originalBody: body,
        draft: initialDraft,
        threadId: processData.threadId,
        conversation: [{ role: 'ai', text: initialDraft }],
        sent: false,
      }
      setAiQueue(prev => [item, ...prev])
      setQueueDrafts(prev => ({ ...prev, [item.id]: item.draft }))
      setTab('ai-review')
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setInboxLoading(false)
    }
  }

  const [sendingReply, setSendingReply] = useState<string | null>(null)
  const [replyError, setReplyError] = useState<Record<string, string>>({})

  async function confirmAndSend(item: AiQueueItem, draft: string) {
    setSendingReply(item.id)
    setReplyError(prev => { const n = { ...prev }; delete n[item.id]; return n })

    const email = item.emailId ? emails.find(e => e.id === item.emailId) : null

    // If this came from a real inbound email, send the reply via Resend
    if (item.emailThreadId && email) {
      try {
        const res = await fetch('/api/inbox/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email.from,
            subject: email.subject,
            text: draft,
            html: simpleMarkdownToHtml(draft),
            emailThreadId: item.emailThreadId,
          }),
        })
        if (!res.ok) {
          const err = await res.json() as { error?: string }
          throw new Error(err.error ?? 'Send failed')
        }
      } catch (err) {
        setSendingReply(null)
        setReplyError(prev => ({ ...prev, [item.id]: err instanceof Error ? err.message : 'Send failed' }))
        return
      }
    } else if (!item.emailThreadId && item.from && item.from !== 'anonymous@example.com') {
      // Compose-originated email — send via Resend
      try {
        const res = await fetch('/api/inbox/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: item.from,
            subject: item.subject ?? 'Your Quote',
            text: draft,
            html: simpleMarkdownToHtml(draft),
          }),
        })
        if (!res.ok) {
          const err = await res.json() as { error?: string }
          throw new Error(err.error ?? 'Send failed')
        }
      } catch (err) {
        setSendingReply(null)
        setReplyError(prev => ({ ...prev, [item.id]: err instanceof Error ? err.message : 'Send failed' }))
        return
      }
    }

    // Update local state regardless
    const now = new Date().toISOString()
    if (item.emailId) {
      const updated = emails.map(e => {
        if (e.id !== item.emailId) return e
        return {
          ...e,
          status: 'responded' as const,
          responses: [
            ...e.responses,
            { id: uid(), body: draft, sentAt: now, role: 'ai' as const, format: 'text' as const },
          ],
        }
      })
      persistEmails(updated)
    }

    setSendingReply(null)
    setAiQueue(prev => prev.map(q => q.id === item.id ? { ...q, sent: true } : q))
  }

  async function followUpRevise(itemId: string, userText: string) {
    const item = aiQueue.find(q => q.id === itemId)
    if (!item || !userText.trim()) return

    setReplyLoading(prev => ({ ...prev, [itemId]: true }))
    setReplyInputs(prev => ({ ...prev, [itemId]: '' }))
    setReplyError(prev => { const n = { ...prev }; delete n[itemId]; return n })

    // Optimistically append user message
    setAiQueue(prev => prev.map(q => q.id === itemId
      ? { ...q, conversation: [...q.conversation, { role: 'user' as const, text: userText }] }
      : q
    ))

    try {
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, threadId: item.threadId }),
      })
      if (!processRes.ok) {
        const errBody = await processRes.json().catch(() => ({}))
        throw new Error((errBody as { error?: string }).error ?? `Process API returned ${processRes.status}`)
      }
      const processData = await processRes.json()

      const convertRes = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: processData,
          originalRequest: userText,
          threadId: processData.threadUuid,
        }),
      })
      if (!convertRes.ok) throw new Error(`Convert API returned ${convertRes.status}`)
      const convertData = await convertRes.json()
      const newDraft = convertData.markdown ?? convertData.plainText ?? ''

      setAiQueue(prev => prev.map(q => q.id === itemId
        ? {
            ...q,
            draft: newDraft,
            threadId: processData.threadId ?? q.threadId,
            conversation: [...q.conversation, { role: 'ai' as const, text: newDraft }],
          }
        : q
      ))
      setQueueDrafts(prev => ({ ...prev, [itemId]: newDraft }))
    } catch (err) {
      setReplyError(prev => ({ ...prev, [itemId]: err instanceof Error ? err.message : 'Revision failed' }))
    } finally {
      setReplyLoading(prev => ({ ...prev, [itemId]: false }))
    }
  }

  async function markQuoteOutcome(item: AiQueueItem, outcome: 'won' | 'lost') {
    if (item.threadId) {
      try {
        await fetch('/api/chat/quote/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: item.threadId, status: outcome }),
        })
      } catch {
        // best-effort — don't block UI
      }
    }

    setAiQueue(prev => prev.map(q => q.id === item.id ? { ...q, outcome } : q))

    setTimeout(() => {
      setAiQueue(prev => prev.filter(q => q.id !== item.id))
      setQueueDrafts(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    }, 2500)
  }

  // ── Drayage handler ────────────────────────────────────────────────────────
  async function calculateDrayage() {
    setDWarning('')
    const extraction: DrayageExtraction = {
      city: dCity || null,
      containerSize: (['20', '40', '45', '53'].includes(dContainerSize)
        ? dContainerSize
        : '40') as DrayageExtraction['containerSize'],
      containerWeightLbs: dWeight ? parseFloat(dWeight) : null,
      chassisDays: dChassisDays || null,
      chassisDaysWccp: dWccp || null,
      waitingHours: dWaiting || null,
      liveUnloadHours: dLiveUnload || null,
      rushRequest: dRush,
      prepaidPierPass: dPierPass,
      tcfCharge: dTcf,
      chassisSplitRequired: dChassisSplit,
      extraStops: dExtraStops,
      notes: [],
    }

    const result = calculateDrayageQuote(extraction)

    setDResult(result)

    if (result.isEstimated && dCity) {
      try {
        const est = await estimateDrayageForUnknownCity(dCity)
        setDWarning(
          `City "${dCity}" not found in rate sheet. Distance-based estimate: ~${est.distanceMiles} mi from port. Rate estimated using standard slope formula.`
        )
      } catch {
        setDWarning(`City "${dCity}" not found in rate sheet. Rate is estimated.`)
      }
    }
  }

  // ── Transloading handler ───────────────────────────────────────────────────
  function calculateTransloading() {
    const firstPalletGroup = tGroups.find(g => g.cargoPackaging === 'pallet')
    const palletSize = firstPalletGroup?.palletSize ?? tStoragePalletSize

    const extraction: QuoteExtraction = {
      confirmationNeeded: [],
      transloading: {
        enabled: true,
        containers: tGroups.map(g => ({
          containerCount: g.containerCount,
          containerSize: g.containerSize,
          cargoPackaging: g.cargoPackaging,
          palletCount: g.palletCount,
          looseCargoCount: g.looseCargoCount,
        })),
        shrinkWrap: tShrinkWrap,
        shrinkWrapPalletCount: tShrinkWrap ? tShrinkWrapPallets || undefined : undefined,
        seal: tSeal,
        billOfLading: tBol,
      },
      storage: {
        enabled: tStorageEnabled,
        palletCount: tStoragePallets,
        palletSize: palletSize,
        storageDurationDays: tStorageDays,
        monFriAfterHours: tAfterHours,
        satSun: tWeekend,
      },
    }
    setTResult(calculateWarehouseQuote(extraction))
  }

  function updateGroup(index: number, patch: Partial<ContainerFormGroup>) {
    setTGroups(prev => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)))
  }

  function addGroup() {
    setTGroups(prev => [
      ...prev,
      { containerCount: 1, containerSize: '40ft', cargoPackaging: 'pallet', palletCount: 20, palletSize: 'normal', looseCargoCount: 0 },
    ])
  }

  function removeGroup(index: number) {
    setTGroups(prev => prev.filter((_, i) => i !== index))
  }

  // ── Last Mile handler ──────────────────────────────────────────────────────
  function calculateLastMile() {
    const extraction: LastMileExtraction = {
      miles: lmMiles ? parseFloat(lmMiles) : null,
      stops: Math.max(1, lmStops),
      liftgate: lmLiftgate,
      residential: lmResidential,
      reefer: lmReefer,
      hazmat: lmHazmat,
      oversize: lmOversize,
      notes: [],
    }
    const base = calculateLastMileQuote(extraction)
    if (lmHighValue) {
      const items = [...base.lineItems, { description: 'High Value / Secure', amount: 75 }]
      const subtotal = +(items.reduce((s, i) => s + i.amount, 0)).toFixed(2)
      const total = Math.max(subtotal, 150)
      setLmResult({ lineItems: items, subtotal, total })
      setLmHighValueAdded(true)
    } else {
      setLmResult(base)
      setLmHighValueAdded(false)
    }
  }

  // ── Search handlers ────────────────────────────────────────────────────────
  async function doSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchError('')
    setSelectedThread(null)
        try {
      const res = await fetch(
        `/api/ops/search?q=${encodeURIComponent(searchQuery.trim())}&by=${encodeURIComponent(searchBy)}`
      )
      const data = await res.json() as { results?: SearchThread[]; error?: string }
      if (data.error) throw new Error(data.error)
      setSearchResults(data.results ?? [])
      if ((data.results ?? []).length === 0) setSearchError('')
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setSearchLoading(false)
    }
  }

  async function loadThread(id: string) {
    setThreadLoading(true)
        try {
      const res = await fetch(`/api/inbox/thread/${encodeURIComponent(id)}`)
      const data = await res.json() as ThreadDetail
      setSelectedThread(data)
    } catch {
      setSelectedThread(null)
    } finally {
      setThreadLoading(false)
    }
  }


  // ── Pricing Logic handlers ─────────────────────────────────────────────────
  function saveRate() {
    if (!selectedRate) return
    if (!editValue.trim()) { setEditError('New value is required.'); return }
    if (!editComment.trim()) { setEditError('Change comment is required.'); return }

    const changedBy = editChangedBy.trim() || session?.user?.name?.trim() || session?.user?.email?.trim() || ''
    if (!changedBy) { setEditError('"Changed by" is required.'); return }

    const newVal = parseFloat(editValue)
    if (isNaN(newVal)) { setEditError('Value must be a number.'); return }

    const now = new Date().toISOString()
    const updated = pricingRates.map(r =>
      r.id === selectedRate.id
        ? { ...r, currentValue: newVal, updatedAt: now, lastComment: editComment }
        : r
    )
    setPricingRates(updated)
    localStorage.setItem('fld_pricing_logic_rates_v1', JSON.stringify(updated))

    const entry: PricingHistoryEntry = {
      id: uid(),
      rateId: selectedRate.id,
      label: selectedRate.label,
      previousValue: selectedRate.currentValue,
      newValue: newVal,
      changedBy,
      comment: editComment,
      changedAt: now,
    }
    persistHistory([entry, ...pricingHistory])

    setSelectedRate({ ...selectedRate, currentValue: newVal, updatedAt: now, lastComment: editComment })
    setEditValue('')
    setEditComment('')
    setEditError('')
  }

  function resetRates() {
    const defaults = getDefaultPricingLogicCatalog()
    const now = new Date().toISOString()

    // Record a history entry for every rate whose value actually changed
    const resetEntries: PricingHistoryEntry[] = pricingRates
      .filter(r => {
        const def = defaults.find(d => d.id === r.id)
        return def && def.defaultValue !== r.currentValue
      })
      .map(r => {
        const def = defaults.find(d => d.id === r.id)!
        return {
          id: uid(),
          rateId: r.id,
          label: r.label,
          previousValue: r.currentValue,
          newValue: def.defaultValue,
          changedBy: 'System Reset',
          comment: 'Rates reset to defaults',
          changedAt: now,
        }
      })

    if (resetEntries.length > 0) {
      persistHistory([...resetEntries, ...pricingHistory])
    }

    setPricingRates(defaults)
    localStorage.setItem('fld_pricing_logic_rates_v1', JSON.stringify(defaults))
    setSelectedRate(null)
  }

  // ── Rate Requests ──────────────────────────────────────────────────────────
  async function loadRateRequests() {
    setRateReqLoading(true)
    try {
      const res = await fetch('/api/rate-requests')
      if (res.ok) {
        const data = await res.json()
        setRateRequests(data.requests ?? [])
      }
    } finally {
      setRateReqLoading(false)
    }
  }

  // ── Customer Settings handlers ─────────────────────────────────────────────
  function saveSettings() {
    localStorage.setItem('fld_customer_settings', JSON.stringify(settings))
    setSavedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  }

  function addDomain() {
    const d = newDomain.trim().toLowerCase()
    if (!d || settings.additionalDomains.includes(d)) return
    setSettings(s => ({ ...s, additionalDomains: [...s.additionalDomains, d] }))
    setNewDomain('')
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const pricingCategories = ['All', ...PRICING_CATEGORY_ORDER]
  const filteredRates = pricingRates
    .filter(r => {
      const matchCat = pricingCategory === 'All' || r.category === pricingCategory
      const matchSearch = !pricingSearch ||
        r.label.toLowerCase().includes(pricingSearch.toLowerCase()) ||
        r.id.toLowerCase().includes(pricingSearch.toLowerCase())
      return matchCat && matchSearch
    })

  const changesCount = pricingRates.filter(r => r.currentValue !== r.defaultValue).length

  // ── Transloading result section classifier ─────────────────────────────────
  function classifyTransloadingItems(result: ReturnType<typeof calculateWarehouseQuote>) {
    const transloading: typeof result.lineItems = []
    const accessorials: typeof result.lineItems = []
    const storage: typeof result.lineItems = []
    for (const item of result.lineItems) {
      if (item.description.startsWith('Transloading') || item.description.startsWith('Loose Cargo')) {
        transloading.push(item)
      } else if (
        item.description === 'Shrink Wrap' ||
        item.description === 'Bill of Lading' ||
        item.description === 'Seal'
      ) {
        accessorials.push(item)
      } else {
        storage.push(item)
      }
    }
    return { transloading, accessorials, storage }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB RENDERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tab 1: Inbox ───────────────────────────────────────────────────────────
  function renderInbox() {
    return (
      <div className="flex flex-col gap-4 h-full">
        {/* Compose form */}
        <Card title="Compose Message">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Label>From</Label>
              <Input value={composeFrom} onChange={e => setComposeFrom(e.target.value)} placeholder="sender@example.com" />
            </div>
            <div>
              <Label>To</Label>
              <Input value={composeTo} onChange={e => setComposeTo(e.target.value)} />
            </div>
          </div>
          <div className="mb-3">
            <Label>Subject</Label>
            <Input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="e.g. Drayage quote for 40ft container to Ontario" />
          </div>
          <div className="mb-3">
            <Label>Body</Label>
            <Textarea
              rows={4}
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              placeholder="Enter email body..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Btn
              onClick={() => {
                if (!composeBody.trim()) return
                const newEmail: MockEmail = {
                  id: uid(),
                  from: composeFrom || 'anonymous@example.com',
                  to: composeTo,
                  subject: composeSubject || '(No subject)',
                  body: composeBody,
                  date: new Date().toISOString(),
                  status: 'new',
                  responses: [],
                  isRead: false,
                }
                persistEmails([newEmail, ...emails])
                setComposeFrom('')
                setComposeSubject('')
                setComposeBody('')
              }}
              variant="secondary"
            >
              Add to Inbox
            </Btn>
            <Btn
              onClick={() => sendToAiQuote(composeBody)}
              disabled={!composeBody.trim() || inboxLoading}
            >
              {inboxLoading ? 'Processing…' : 'Send to AI Quote'}
            </Btn>
            {inboxError && <span className="text-xs text-red-600">{inboxError}</span>}
          </div>
        </Card>

        {/* Two-panel layout */}
        <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: '500px' }}>
          {/* Left: email list */}
          <div className="w-1/3 flex flex-col bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
            {/* Bulk actions */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-2)]">
              <span className="text-xs text-[var(--color-text-3)] flex-1">
                {emails.length} message{emails.length !== 1 ? 's' : ''}
                {checkedEmails.size > 0 && ` · ${checkedEmails.size} selected`}
              </span>
              {checkedEmails.size > 0 && (
                <Btn size="sm" variant="danger" onClick={deleteSelected}>Delete Selected</Btn>
              )}
              <Btn size="sm" variant="ghost" onClick={() => loadRealEmails()}>↻ Refresh</Btn>
              <Btn size="sm" variant="ghost" onClick={deleteAll}>Delete All</Btn>
            </div>

            {/* Email rows */}
            <div className="flex-1 overflow-y-auto">
              {emails.length === 0 && (
                <div className="p-6 text-center text-sm text-[var(--color-text-3)]">No messages</div>
              )}
              {emails.map(email => (
                <div
                  key={email.id}
                  onClick={() => selectEmail(email.id)}
                  className={`flex items-start gap-2 px-3 py-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-2)] transition-colors ${
                    selectedEmailId === email.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkedEmails.has(email.id)}
                    onChange={e => { e.stopPropagation(); toggleCheck(email.id) }}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs text-[var(--color-text-3)] font-mono flex-shrink-0">
                        {fmtTime(email.date)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${statusBadgeClass(email.status)}`}>
                        {statusLabel(email.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {email.source === 'real' && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold uppercase tracking-wide">
                          Live
                        </span>
                      )}
                      <span className={`text-sm truncate ${!email.isRead ? 'font-semibold' : 'font-normal'} text-[var(--color-text-1)]`}>
                        {email.subject}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-3)] truncate mt-0.5">
                      {email.body.slice(0, 80)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 bg-white border border-[var(--color-border)] rounded-xl overflow-y-auto">
            {!selectedEmail ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-3)]">
                Select a message to view
              </div>
            ) : (
              <div className="p-5">
                {/* Header */}
                <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                  <h2 className="text-base font-semibold text-[var(--color-text-1)] mb-2">{selectedEmail.subject}</h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <div><span className="text-[var(--color-text-3)]">From: </span><span className="font-mono text-[var(--color-text-2)]">{selectedEmail.from}</span></div>
                    <div><span className="text-[var(--color-text-3)]">Company: </span><span>{selectedEmail.company ?? '—'}</span></div>
                    <div><span className="text-[var(--color-text-3)]">Date: </span><span className="font-mono">{fmtTime(selectedEmail.date)}</span></div>
                    <div><span className="text-[var(--color-text-3)]">Phone: </span><span className="font-mono">{selectedEmail.phone ?? '—'}</span></div>
                    {selectedEmail.threadKey && (
                      <div><span className="text-[var(--color-text-3)]">Thread ID: </span><span className="font-mono">{selectedEmail.threadKey}</span></div>
                    )}
                    {selectedEmail.customerTier && (
                      <div><span className="text-[var(--color-text-3)]">Tier: </span><span className="capitalize">{selectedEmail.customerTier}</span></div>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="mb-5">
                  <p className="text-xs font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-2">Message</p>
                  <div className="text-sm text-[var(--color-text-1)] whitespace-pre-wrap bg-[var(--color-bg-2)] rounded-lg p-4 leading-relaxed">
                    {selectedEmail.body}
                  </div>
                </div>

                {/* Conversation thread */}
                {selectedEmail.responses.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-3">Thread</p>
                    <div className="space-y-3">
                      {selectedEmail.responses.map(resp => (
                        <div
                          key={resp.id}
                          className={`rounded-lg p-4 relative ${
                            resp.role === 'user'
                              ? 'bg-gray-50'
                              : 'bg-white border border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-[var(--color-text-2)]">
                              {resp.role === 'user'
                                ? 'User Request'
                                : 'AI Response'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-[var(--color-text-3)]">{fmtTime(resp.sentAt)}</span>
                              <CopyBtn getText={() => resp.body} />
                            </div>
                          </div>
                          {resp.format === 'html' || resp.role === 'ai' ? (
                            <div
                              className="text-sm"
                              dangerouslySetInnerHTML={{ __html: resp.format === 'html' ? resp.body : simpleMarkdownToHtml(resp.body) }}
                            />
                          ) : (
                            <div className="text-sm text-[var(--color-text-1)] whitespace-pre-wrap">
                              {resp.body}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply Actions */}
                <div className="border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-3">Reply Actions</p>
                  <div className="flex items-center gap-3">
                    <Btn
                      onClick={() => sendToAiQuote(selectedEmail.body, selectedEmail.id)}
                      disabled={inboxLoading}
                    >
                      {inboxLoading ? 'Processing…' : 'Answer with AI Quote'}
                    </Btn>
                    {inboxError && <span className="text-xs text-red-600">{inboxError}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab 2: AI Review ───────────────────────────────────────────────────────
  function renderAiReview() {
    if (aiQueue.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-sm text-[var(--color-text-3)]">
          No AI quotes pending. Use the Inbox to generate a quote.
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {aiQueue.map(item => {
          const draft = queueDrafts[item.id] ?? item.draft
          const isLoading = replyLoading[item.id] ?? false
          const replyInput = replyInputs[item.id] ?? ''
          return (
            <Card key={item.id}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-1)]">{item.subject || '(No subject)'}</p>
                  <p className="text-xs text-[var(--color-text-3)] font-mono mt-0.5">{item.from}</p>
                </div>
                {item.outcome ? (
                  <span className={`text-xs px-2 py-1 rounded font-medium ${item.outcome === 'won' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.outcome === 'won' ? 'Won' : 'Lost'}
                  </span>
                ) : item.sent ? (
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">Sent — Awaiting Outcome</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium">Pending Review</span>
                )}
              </div>

              {/* Original message collapsible */}
              <details className="mb-4">
                <summary className="text-xs font-medium text-[var(--color-text-3)] cursor-pointer hover:text-[var(--color-text-2)] uppercase tracking-wider">
                  Original Message
                </summary>
                <div className="mt-2 text-sm text-[var(--color-text-2)] whitespace-pre-wrap bg-[var(--color-bg-2)] rounded-lg p-3 max-h-48 overflow-y-auto">
                  {item.originalBody}
                </div>
              </details>

              {/* Conversation history */}
              {item.conversation.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-2">Conversation</p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.conversation.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-[var(--color-bg-2)] text-[var(--color-text-1)] border border-[var(--color-border)]'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-3)] italic">
                          Revising quote…
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Draft editor — only when not yet sent */}
              {!item.sent && (
                <div className="mb-3">
                  <Label>AI Draft — Edit before sending</Label>
                  <Textarea
                    rows={10}
                    value={draft}
                    onChange={e => setQueueDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              {/* Follow-up / revision input — only when not yet sent */}
              {!item.sent && (
                <div className="mb-4">
                  <Label>Ask a follow-up or request a revision</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-bg-1)] text-[var(--color-text-1)] placeholder-[var(--color-text-3)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Add 30 days storage, reduce price by 5%, change container to 20'…"
                      value={replyInput}
                      onChange={e => setReplyInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          followUpRevise(item.id, replyInput)
                        }
                      }}
                      disabled={isLoading}
                    />
                    <Btn
                      onClick={() => followUpRevise(item.id, replyInput)}
                      disabled={isLoading || !replyInput.trim()}
                    >
                      {isLoading ? 'Revising…' : 'Revise'}
                    </Btn>
                  </div>
                </div>
              )}

              {/* Send / copy actions — only when not yet sent */}
              {!item.sent && (
                <div className="flex items-center gap-3 flex-wrap">
                  <Btn
                    onClick={() => confirmAndSend(item, draft)}
                    disabled={sendingReply === item.id || isLoading}
                  >
                    {sendingReply === item.id
                      ? 'Sending…'
                      : (item.emailThreadId || (item.from && item.from !== 'anonymous@example.com'))
                      ? 'Confirm & Send Email'
                      : 'Confirm & Send to Inbox'}
                  </Btn>
                  {(item.emailThreadId || (item.from && item.from !== 'anonymous@example.com')) && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                      Will send via Resend to {item.from}
                    </span>
                  )}
                  <CopyBtn getText={() => simpleMarkdownToHtml(draft)} label="Copy HTML" />
                  <CopyBtn getText={() => draft} label="Copy Text" />
                  {!item.emailId && (
                    <span className="text-xs text-[var(--color-text-3)]">(No source email — copy and send manually)</span>
                  )}
                </div>
              )}

              {/* Won / Lost outcome buttons — shown after sending, before outcome set */}
              {item.sent && !item.outcome && (
                <div className="border-t border-[var(--color-border)] pt-4 mt-2">
                  <p className="text-xs text-[var(--color-text-3)] mb-3">
                    Quote sent. Mark the outcome once the customer responds:
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => markQuoteOutcome(item, 'won')}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                    >
                      Won
                    </button>
                    <button
                      onClick={() => markQuoteOutcome(item, 'lost')}
                      className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                    >
                      Lost
                    </button>
                    <button
                      onClick={() => setAiQueue(prev => prev.map(q => q.id === item.id ? { ...q, sent: false } : q))}
                      className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] underline"
                    >
                      Revise quote
                    </button>
                  </div>
                </div>
              )}

              {/* Outcome confirmation banner */}
              {item.outcome && (
                <div className={`border-t pt-4 mt-2 ${item.outcome === 'won' ? 'border-green-200' : 'border-red-200'}`}>
                  <p className={`text-sm font-medium ${item.outcome === 'won' ? 'text-green-700' : 'text-red-600'}`}>
                    {item.outcome === 'won'
                      ? 'Quote won! Outcome recorded in CRM.'
                      : 'Quote lost. Outcome recorded in CRM.'}
                  </p>
                </div>
              )}

              {replyError[item.id] && (
                <p className="text-xs text-red-600 mt-2">Error: {replyError[item.id]}</p>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  function resetDrayage() {
    setDCity(''); setDContainerSize('40'); setDWeight('')
    setDExtraStops(0); setDChassisDays(0); setDWccp(0)
    setDWaiting(0); setDLiveUnload(0)
    setDPierPass(true); setDTcf(true); setDChassisSplit(false); setDRush(false)
    setDResult(null); setDWarning('')
  }

  function resetTransloading() {
    setTGroups([{ containerCount: 1, containerSize: '40ft', cargoPackaging: 'pallet', palletCount: 20, palletSize: 'normal', looseCargoCount: 0 }])
    setTShrinkWrap(false); setTShrinkWrapPallets(0)
    setTSeal(false); setTBol(false)
    setTStorageEnabled(false); setTStoragePallets(0)
    setTStoragePalletSize('normal'); setTStorageDays(30)
    setTAfterHours(false); setTWeekend(false)
    setTResult(null)
  }

  function resetLastMile() {
    setLmMiles(''); setLmTruckType('straight-truck'); setLmStops(1)
    setLmLiftgate(false); setLmResidential(false); setLmReefer(false)
    setLmHazmat(false); setLmOversize(false); setLmHighValue(false)
    setLmResult(null); setLmHighValueAdded(false)
  }

  // ── Tab 3: Drayage ─────────────────────────────────────────────────────────
  function renderDrayage() {
    return (
      <div className="grid grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <Card
            title="Drayage Quote Calculator"
            action={<button type="button" onClick={resetDrayage} className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-danger)] transition-colors">↺ Reset</button>}
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Destination City</Label>
                <Input
                  value={dCity}
                  onChange={e => setDCity(e.target.value.toUpperCase())}
                  placeholder="e.g. ONTARIO"
                />
              </div>
              <div>
                <Label>Container Size</Label>
                <Select value={dContainerSize} onChange={e => setDContainerSize(e.target.value)}>
                  <option value="20">20 ft</option>
                  <option value="40">40 ft</option>
                  <option value="45">45 ft</option>
                  <option value="53">53 ft</option>
                </Select>
              </div>
              <div>
                <Label>Weight (lbs)</Label>
                <Input
                  type="number"
                  value={dWeight}
                  onChange={e => setDWeight(e.target.value)}
                  placeholder="e.g. 42000"
                  min={0}
                />
              </div>
              <div>
                <Label>Extra Stops</Label>
                <NumericInput value={dExtraStops} onChange={setDExtraStops} min={0} />
              </div>
              <div>
                <Label>Chassis Days</Label>
                <NumericInput value={dChassisDays} onChange={setDChassisDays} min={0} />
              </div>
              <div>
                <Label>WCCP Chassis Days</Label>
                <NumericInput value={dWccp} onChange={setDWccp} min={0} />
              </div>
              <div>
                <Label>Waiting Hours</Label>
                <NumericInput value={dWaiting} onChange={setDWaiting} min={0} step={0.1} />
              </div>
              <div>
                <Label>Live Unload Hours</Label>
                <NumericInput value={dLiveUnload} onChange={setDLiveUnload} min={0} step={0.1} />
              </div>
            </div>

            {/* Toggle row */}
            <div className="mb-4">
              <Label>Options</Label>
              <div className="flex flex-wrap gap-2">
                <ToggleBtn label="Pier Pass" value={dPierPass} onChange={setDPierPass} />
                <ToggleBtn label="TCF" value={dTcf} onChange={setDTcf} />
                <ToggleBtn label="Chassis Split" value={dChassisSplit} onChange={setDChassisSplit} />
                <ToggleBtn label="Rush" value={dRush} onChange={setDRush} />
              </div>
            </div>

            <Btn onClick={calculateDrayage}>Calculate Drayage Quote</Btn>
          </Card>
        </div>

        {/* Result */}
        <div>
          {!dResult ? (
            <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-3)] bg-white border border-[var(--color-border)] rounded-xl">
              Fill in the form and calculate to see your quote.
            </div>
          ) : (
            <div className="space-y-4">
              {dWarning && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  ⚠ {dWarning}
                </div>
              )}
              <Card>
                <div className="mb-3">
                  <p className="text-sm font-semibold text-[var(--color-text-1)]">
                    {dResult.city} · {dResult.containerSize} ft Container
                    {dResult.containerWeightLbs ? ` · ${dResult.containerWeightLbs.toLocaleString()} lbs` : ''}
                    {dResult.isEstimated && <span className="ml-2 text-xs text-amber-600 font-normal">(Estimated)</span>}
                  </p>
                </div>

                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left py-1.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Code</th>
                      <th className="text-left py-1.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Description</th>
                      <th className="text-right py-1.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dResult.lineItems.map((item, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)]">
                        <td className="py-2 font-mono text-xs text-[var(--color-text-3)]">{item.code}</td>
                        <td className="py-2 text-sm text-[var(--color-text-2)]">{item.description}</td>
                        <td className="py-2 text-right font-mono text-sm text-[var(--color-text-1)]">{fmt$(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[var(--color-border-2)]">
                      <td colSpan={2} className="py-2.5 font-bold text-[var(--color-text-1)]">Subtotal</td>
                      <td className="py-2.5 text-right font-mono font-bold text-[var(--color-text-1)]">{fmt$(dResult.subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>

                {dResult.basisNotes.length > 0 && (
                  <div className="text-xs text-[var(--color-text-3)] mb-3">
                    {dResult.basisNotes.map((n, i) => <p key={i}>{n}</p>)}
                  </div>
                )}

                {renderDiscountTaxPanel(dResult.subtotal)}

                <CopyBtn
                  getText={() => formatDrayageEmail(dResult!, settings.companyName, settings.phoneNumber)}
                  label="Copy as Email"
                />
              </Card>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tab 4: Transloading ────────────────────────────────────────────────────
  function renderTransloading() {
    return (
      <div className="grid grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <Card
            title="Container Groups"
            action={<button type="button" onClick={resetTransloading} className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-danger)] transition-colors">↺ Reset</button>}
          >
            {tGroups.map((g, i) => (
              <div key={i} className="border border-[var(--color-border)] rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[var(--color-text-2)]">Container {i + 1}</span>
                  {tGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Count</Label>
                    <NumericInput value={g.containerCount} onChange={v => updateGroup(i, { containerCount: Math.max(1, Math.round(v)) })} min={1} />
                  </div>
                  <div>
                    <Label>Size</Label>
                    <Select
                      value={g.containerSize}
                      onChange={e => updateGroup(i, { containerSize: e.target.value as ContainerFormGroup['containerSize'] })}
                    >
                      <option value="20ft">20 ft</option>
                      <option value="40ft">40 ft</option>
                      <option value="45ft">45 ft</option>
                      <option value="53ft">53 ft</option>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Cargo Packaging</Label>
                    <Select
                      value={g.cargoPackaging}
                      onChange={e => updateGroup(i, { cargoPackaging: e.target.value as 'pallet' | 'loose-cargo' })}
                    >
                      <option value="pallet">Pallet</option>
                      <option value="loose-cargo">Loose Cargo</option>
                    </Select>
                  </div>
                  {g.cargoPackaging === 'pallet' && (
                    <>
                      <div>
                        <Label>Pallet Count</Label>
                        <NumericInput value={g.palletCount} onChange={v => updateGroup(i, { palletCount: Math.round(v) })} min={0} />
                      </div>
                      <div>
                        <Label>Pallet Size</Label>
                        <Select
                          value={g.palletSize}
                          onChange={e => updateGroup(i, { palletSize: e.target.value as 'normal' | 'oversize' })}
                        >
                          <option value="normal">Normal</option>
                          <option value="oversize">Oversize</option>
                        </Select>
                      </div>
                    </>
                  )}
                  {g.cargoPackaging === 'loose-cargo' && (
                    <div className="col-span-2">
                      <Label>Loose Cargo Count (pieces)</Label>
                      <NumericInput value={g.looseCargoCount} onChange={v => updateGroup(i, { looseCargoCount: Math.round(v) })} min={0} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Btn size="sm" variant="secondary" onClick={addGroup}>+ Add Container Group</Btn>
          </Card>

          <Card title="Accessorials">
            <div className="space-y-2">
              <ToggleRow label="Shrink Wrap" value={tShrinkWrap} onChange={setTShrinkWrap} />
              {tShrinkWrap && (
                <div className="pl-4">
                  <Label>Shrink Wrap Pallet Count</Label>
                  <NumericInput value={tShrinkWrapPallets} onChange={setTShrinkWrapPallets} min={0} placeholder="0 = auto from groups" />
                </div>
              )}
              <ToggleRow label="Seal" value={tSeal} onChange={setTSeal} />
              <ToggleRow label="Bill of Lading (BOL)" value={tBol} onChange={setTBol} />
            </div>
          </Card>

          <Card title="Storage and Warehousing">
            <div className="space-y-2">
              <ToggleRow label="Enable Storage and Warehousing" value={tStorageEnabled} onChange={setTStorageEnabled} />
              {tStorageEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label>Pallet Count</Label>
                    <NumericInput value={tStoragePallets} onChange={setTStoragePallets} min={0} />
                  </div>
                  <div>
                    <Label>Pallet Size</Label>
                    <Select
                      value={tStoragePalletSize}
                      onChange={e => setTStoragePalletSize(e.target.value as 'normal' | 'oversize')}
                    >
                      <option value="normal">Normal</option>
                      <option value="oversize">Oversize</option>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Storage Duration (days)</Label>
                    <NumericInput value={tStorageDays} onChange={v => setTStorageDays(Math.max(1, Math.round(v)))} min={1} placeholder="30" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <ToggleRow label="After-Hours (Mon–Fri)" value={tAfterHours} onChange={setTAfterHours} />
                    <ToggleRow label="Weekend (Sat–Sun)" value={tWeekend} onChange={setTWeekend} />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Btn onClick={calculateTransloading}>Calculate Transloading Quote</Btn>
        </div>

        {/* Result */}
        <div>
          {!tResult ? (
            <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-3)] bg-white border border-[var(--color-border)] rounded-xl">
              Fill in the form and calculate to see your quote.
            </div>
          ) : (
            <Card>
              {(() => {
                const { transloading, accessorials, storage } = classifyTransloadingItems(tResult)

                function sectionTable(items: typeof transloading, title: string) {
                  if (items.length === 0) return null
                  const subtotal = items.reduce((s, i) => s + i.total, 0)
                  return (
                    <div className="mb-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-2">{title}</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)]">
                            <th className="text-left py-1.5 text-xs font-medium text-[var(--color-text-3)]">Description</th>
                            <th className="text-right py-1.5 text-xs font-medium text-[var(--color-text-3)]">Qty</th>
                            <th className="text-right py-1.5 text-xs font-medium text-[var(--color-text-3)]">Unit</th>
                            <th className="text-right py-1.5 text-xs font-medium text-[var(--color-text-3)]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={i} className="border-b border-[var(--color-border)]">
                              <td className="py-2 text-[var(--color-text-2)]">{item.description}</td>
                              <td className="py-2 text-right font-mono text-xs">{item.quantity}</td>
                              <td className="py-2 text-right font-mono text-xs">{fmt$(item.unitPrice)}</td>
                              <td className="py-2 text-right font-mono text-sm">{fmt$(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="py-2 text-xs font-semibold text-right text-[var(--color-text-2)]">
                              {title} Subtotal
                            </td>
                            <td className="py-2 text-right font-mono font-semibold text-[var(--color-text-1)]">
                              {fmt$(subtotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                }

                return (
                  <>
                    {sectionTable(transloading, 'Transloading')}
                    {sectionTable(accessorials, 'Accessorials')}
                    {sectionTable(storage, 'Storage')}

                    <div className="border-t-2 border-[var(--color-text-1)] pt-3 flex justify-between items-center">
                      <span className="text-base font-bold text-[var(--color-text-1)]">Grand Total</span>
                      <span className="text-xl font-bold font-mono text-[var(--color-text-1)]">{fmt$(tResult.total)}</span>
                    </div>

                    {renderDiscountTaxPanel(tResult.total)}

                    {tResult.warnings.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Assumptions / Confirmation Needed</p>
                        {tResult.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-700">• {w}</p>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </Card>
          )}
        </div>
      </div>
    )
  }

  // ── Tab 5: Last Mile ───────────────────────────────────────────────────────
  function renderLastMile() {
    return (
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card
            title="Last-Mile Delivery Calculator"
            action={<button type="button" onClick={resetLastMile} className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-danger)] transition-colors">↺ Reset</button>}
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Distance (miles) *</Label>
                <Input
                  type="number"
                  value={lmMiles}
                  onChange={e => setLmMiles(e.target.value)}
                  placeholder="e.g. 35"
                  min={0}
                  step={0.1}
                />
              </div>
              <div>
                <Label>Truck Type</Label>
                <Select value={lmTruckType} onChange={e => setLmTruckType(e.target.value)}>
                  <option value="straight-truck">Straight Truck</option>
                  <option value="box-truck">Box Truck</option>
                  <option value="sprinter">Sprinter</option>
                  <option value="flatbed">Flatbed</option>
                  <option value="reefer">Reefer</option>
                </Select>
              </div>
              <div>
                <Label>Number of Stops</Label>
                <NumericInput value={lmStops} onChange={v => setLmStops(Math.round(v))} min={1} placeholder="1" />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <ToggleRow label="Liftgate" value={lmLiftgate} onChange={setLmLiftgate} />
              <ToggleRow label="Residential Delivery" value={lmResidential} onChange={setLmResidential} />
              <ToggleRow label="Reefer / Temp Control" value={lmReefer} onChange={setLmReefer} />
              <ToggleRow label="Hazmat" value={lmHazmat} onChange={setLmHazmat} />
              <ToggleRow label="Oversize / Overweight" value={lmOversize} onChange={setLmOversize} />
              <ToggleRow label="High Value / Secure" value={lmHighValue} onChange={setLmHighValue} />
            </div>

            <Btn onClick={calculateLastMile} disabled={!lmMiles}>Calculate Last-Mile Quote</Btn>
          </Card>
        </div>

        <div>
          {!lmResult ? (
            <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-3)] bg-white border border-[var(--color-border)] rounded-xl">
              Fill in the form and calculate to see your quote.
            </div>
          ) : (
            <Card>
              <p className="text-sm font-semibold text-[var(--color-text-1)] mb-4">Last-Mile Delivery Quote</p>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-1.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Description</th>
                    <th className="text-right py-1.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lmResult.lineItems.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]">
                      <td className="py-2 text-[var(--color-text-2)]">{item.description}</td>
                      <td className="py-2 text-right font-mono text-sm text-[var(--color-text-1)]">{fmt$(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-border-2)]">
                    <td className="py-2.5 font-bold text-[var(--color-text-1)]">Total</td>
                    <td className="py-2.5 text-right font-mono font-bold text-[var(--color-text-1)]">{fmt$(lmResult.total)}</td>
                  </tr>
                </tfoot>
              </table>
              {lmResult.total > lmResult.subtotal && (
                <p className="text-xs text-[var(--color-text-3)]">* Minimum charge of $150.00 applied.</p>
              )}
              {lmHighValueAdded && (
                <p className="text-xs text-[var(--color-text-3)] mt-1">* High Value / Secure surcharge of $75.00 included.</p>
              )}
              {renderDiscountTaxPanel(lmResult.total)}
            </Card>
          )}
        </div>
      </div>
    )
  }

  // ── Tab 6: Search ──────────────────────────────────────────────────────────
  function renderSearch() {
    const st = selectedThread as ThreadDetail | null

    function statusPill(s: string) {
      const cls =
        s === 'responded' || s === 'replied' ? 'bg-green-100 text-green-700'
        : s === 'unresponded' || s === 'in-progress' ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600'
      const label = s === 'replied' ? 'Responded' : s === 'unresponded' ? 'Unresponded' : s
      return <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${cls}`}>{label}</span>
    }

    function extractQuote(at: AiThreadEntry) {
      const processed = at.artifacts.find(a => a.artifact_type === 'processed')
      if (!processed) return null
      const rd = (processed.artifact_data as Record<string, unknown>).responseData as Record<string, unknown> | undefined
      if (!rd) return null
      const typeLabel: Record<string, string> = { drayage: 'Drayage', warehousing: 'Warehousing', 'last-mile': 'Last Mile', hybrid: 'Hybrid', general: 'General Inquiry' }
      const t = rd.type as string
      let value: number | null = null
      if (t === 'drayage') value = ((rd.quote as Record<string, unknown> | null)?.subtotal as number) ?? null
      if (t === 'warehousing') value = ((rd.result as Record<string, unknown> | null)?.total as number) ?? null
      if (t === 'last-mile') value = ((rd.result as Record<string, unknown> | null)?.total as number) ?? null
      if (t === 'hybrid') value = (rd.combinedTotal as number) ?? null
      return { label: typeLabel[t] ?? t, value }
    }

    return (
      <div>
        <Card>
          <div className="flex gap-3 items-end">
            <div>
              <Label>Search By</Label>
              <Select value={searchBy} onChange={e => setSearchBy(e.target.value)} className="w-36">
                <option>Subject</option>
                <option>Thread ID</option>
                <option>Company</option>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Query</Label>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder={
                  searchBy === 'Thread ID' ? 'Paste thread UUID…'
                  : searchBy === 'Company' ? 'Sender email or domain…'
                  : 'Subject, sender, or keywords in message body…'
                }
              />
            </div>
            <Btn onClick={doSearch} disabled={searchLoading || !searchQuery.trim()}>
              {searchLoading ? 'Searching…' : 'Search'}
            </Btn>
          </div>
          {searchError && <p className="mt-2 text-xs text-red-600">{searchError}</p>}
        </Card>

        {!searchQuery && (
          <p className="mt-6 text-center text-sm text-[var(--color-text-3)]">
            Search by subject line, sender email, or any keyword from the message body.
          </p>
        )}

        {searchResults.length === 0 && !searchLoading && searchQuery && !searchError && (
          <p className="mt-4 text-sm text-[var(--color-text-3)]">No threads found for "{searchQuery}".</p>
        )}

        {searchResults.length > 0 && (
          <div className="flex gap-4 mt-4" style={{ minHeight: '520px' }}>
            {/* Left list */}
            <div className="w-1/3 bg-white border border-[var(--color-border)] rounded-xl overflow-y-auto flex-shrink-0">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { loadThread(r.id) }}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-2)] transition-colors ${
                    st?.thread?.id === r.id ? 'bg-[var(--color-accent-lt)] border-l-2 border-l-[var(--color-accent)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[var(--color-text-3)]">{fmtTime(r.last_message_at)}</span>
                    {statusPill(r.status)}
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-1)] truncate">{r.subject}</div>
                  <div className="text-xs text-[var(--color-text-3)] truncate mt-0.5">{r.from}</div>
                  <div className="flex gap-2 mt-1 text-xs text-[var(--color-text-4)]">
                    <span>{r.message_count} msg{r.message_count !== 1 ? 's' : ''}</span>
                    {r.reply_count > 0 && <span className="text-green-600">· {r.reply_count} repl{r.reply_count !== 1 ? 'ies' : 'y'} sent</span>}
                  </div>
                </button>
              ))}
            </div>

            {/* Right detail */}
            <div className="flex-1 bg-white border border-[var(--color-border)] rounded-xl overflow-y-auto">
              {threadLoading && <div className="flex items-center justify-center h-40 text-sm text-[var(--color-text-3)]">Loading…</div>}
              {!threadLoading && !st && <div className="flex items-center justify-center h-40 text-sm text-[var(--color-text-3)]">← Select a thread</div>}
              {!threadLoading && st && (
                <div className="p-5 space-y-5">

                  {/* Header */}
                  <div className="pb-4 border-b border-[var(--color-border)]">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-base font-bold text-[var(--color-text-1)]">{st.thread.subject}</h3>
                      {statusPill(st.thread.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div><span className="text-[var(--color-text-3)]">From: </span><span className="font-mono">{st.thread.participant_from}</span></div>
                      <div><span className="text-[var(--color-text-3)]">To: </span><span className="font-mono">{st.thread.participant_to}</span></div>
                      <div><span className="text-[var(--color-text-3)]">Received: </span><span className="font-mono">{fmtTime(st.thread.created_at)}</span></div>
                      <div><span className="text-[var(--color-text-3)]">Last activity: </span><span className="font-mono">{fmtTime(st.thread.last_message_at)}</span></div>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-[var(--color-text-4)] break-all">ID: {st.thread.id}</div>
                  </div>

                  {/* AI Processing */}
                  {st.aiThreads.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-3">AI Quote Results</p>
                      <div className="space-y-3">
                        {st.aiThreads.map(at => {
                          const q = extractQuote(at)
                          return (
                            <div key={at.id} className="border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-bg-2)]">
                              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">{at.processor_type}</span>
                                  <span className="text-xs italic text-[var(--color-text-3)]">{at.intent}</span>
                                </div>
                                {q?.value != null && (
                                  <span className="text-sm font-bold font-mono text-green-700">Quote: {fmt$(q.value)}</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                                {at.contact_name && <div><span className="text-[var(--color-text-3)]">Contact: </span>{at.contact_name}</div>}
                                {at.company_name && <div><span className="text-[var(--color-text-3)]">Company: </span>{at.company_name}</div>}
                                {at.confidence_score != null && <div><span className="text-[var(--color-text-3)]">Confidence: </span>{Math.round(at.confidence_score * 100)}%</div>}
                                <div><span className="text-[var(--color-text-3)]">Processed: </span><span className="font-mono">{fmtTime(at.ai_created_at)}</span></div>
                                {q && <div><span className="text-[var(--color-text-3)]">Type: </span>{q.label}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Conversation */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-3">
                      Conversation · {st.messages.length} message{st.messages.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-3">
                      {st.messages.map(msg => (
                        <div key={msg.id} className={`rounded-lg border p-3 ${
                          msg.direction === 'inbound'
                            ? 'border-[var(--color-border)] bg-[var(--color-bg-2)]'
                            : 'border-indigo-200 bg-indigo-50'
                        }`}>
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                                msg.direction === 'inbound' ? 'bg-gray-200 text-gray-700' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {msg.direction === 'inbound' ? '← Inbound' : '→ Outbound'}
                              </span>
                              <span className="text-xs text-[var(--color-text-3)] font-mono">{msg.from_email}</span>
                            </div>
                            <span className="text-xs font-mono text-[var(--color-text-3)]">{fmtTime(msg.received_at ?? '')}</span>
                          </div>
                          {msg.body_html ? (
                            <div className="text-sm text-[var(--color-text-2)]" dangerouslySetInnerHTML={{ __html: msg.body_html }} />
                          ) : (
                            <p className="text-sm text-[var(--color-text-2)] whitespace-pre-wrap">{msg.body_text}</p>
                          )}
                        </div>
                      ))}
                      {st.messages.length === 0 && <p className="text-sm text-[var(--color-text-3)]">No messages stored.</p>}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Tab 7: Pricing Logic ───────────────────────────────────────────────────
  function renderPricingLogic() {
    return (
      <div>
        {/* Search bar */}
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-3)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={pricingSearch}
            onChange={e => setPricingSearch(e.target.value)}
            placeholder="Search rate items by name or ID…"
            className="w-full pl-10 pr-4 py-2.5 text-sm border-2 rounded-xl bg-white focus:outline-none focus:border-indigo-400 transition-colors"
            style={{ borderColor: pricingSearch ? 'var(--color-accent, #6366f1)' : 'var(--color-border)' }}
          />
          {pricingSearch && (
            <button
              onClick={() => setPricingSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filters + stats bar */}
        <div className="flex items-center gap-4 mb-4">
          <Select
            value={pricingCategory}
            onChange={e => setPricingCategory(e.target.value)}
            className="w-44"
          >
            {pricingCategories.map(c => <option key={c}>{c}</option>)}
          </Select>
          {pricingSearch ? (
            <span className="text-sm font-medium text-indigo-600 whitespace-nowrap">
              {filteredRates.length} result{filteredRates.length !== 1 ? 's' : ''} for &ldquo;{pricingSearch}&rdquo;
            </span>
          ) : (
            <span className="text-sm text-[var(--color-text-3)] whitespace-nowrap">
              Total Items: <strong>{filteredRates.length}</strong>
            </span>
          )}
          <span className="text-sm text-[var(--color-text-3)] whitespace-nowrap ml-auto">
            Modified from Default: <strong>{changesCount}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: rate list */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-bg-2)] z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Item</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Category</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--color-text-3)] uppercase">Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--color-text-3)]">
                      No items match &ldquo;{pricingSearch}&rdquo;
                    </td>
                  </tr>
                )}
                {filteredRates.map(rate => (
                  <tr
                    key={rate.id}
                    onClick={() => {
                      setSelectedRate(rate)
                      setEditValue(String(rate.currentValue))
                      setEditComment('')
                      setEditError('')
                    }}
                    className={`border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-2)] transition-colors ${
                      selectedRate?.id === rate.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-[var(--color-text-1)]">{rate.label}</div>
                      <div className="text-xs text-[var(--color-text-3)] font-mono mt-0.5">{rate.id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-3)]">{rate.category}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--color-text-1)]">
                      {fmt$(rate.currentValue)}
                      {rate.currentValue !== rate.defaultValue && (
                        <span className="ml-1 text-xs text-amber-600">●</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: edit panel */}
          <div>
            {!selectedRate ? (
              <div className="flex items-center justify-center h-64 text-sm text-[var(--color-text-3)] bg-white border border-[var(--color-border)] rounded-xl">
                Select a rate item to {userRole === 'staff' ? 'view.' : 'edit.'}
              </div>
            ) : (
              <Card>
                <div className="mb-4">
                  <p className="text-base font-semibold text-[var(--color-text-1)]">{selectedRate.label}</p>
                  <p className="text-xs font-mono text-[var(--color-text-3)] mt-0.5">{selectedRate.id}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
                  <div>
                    <span className="text-[var(--color-text-3)]">Current Value: </span>
                    <span className="font-mono font-semibold">{fmt$(selectedRate.currentValue)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-3)]">Original: </span>
                    <span className="font-mono">{fmt$(selectedRate.defaultValue)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-3)]">Unit: </span>
                    <span>{selectedRate.unit}</span>
                  </div>
                  {selectedRate.updatedAt && (
                    <div>
                      <span className="text-[var(--color-text-3)]">Last Updated: </span>
                      <span className="font-mono">{fmtTime(selectedRate.updatedAt)}</span>
                    </div>
                  )}
                  {selectedRate.lastComment && (
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-3)]">Last Comment: </span>
                      <span className="italic">{selectedRate.lastComment}</span>
                    </div>
                  )}
                  {selectedRate.note && (
                    <div className="col-span-2">
                      <span className="text-[var(--color-text-3)]">Note: </span>
                      <span>{selectedRate.note}</span>
                    </div>
                  )}
                </div>

                {userRole === 'staff' ? (
                  /* Staff: read-only */
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    You have read-only access to the rate sheet. Contact a manager or admin to request changes.
                  </p>
                ) : userRole === 'manager' ? (
                  /* Manager: submit change request */
                  <div className="space-y-3">
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      Submit a change request below. An admin will review and approve it.
                    </p>
                    <div>
                      <Label>Requested Value ({selectedRate.unit})</Label>
                      <Input
                        type="number"
                        step={0.01}
                        value={rcrRateKey === selectedRate.id ? rcrRequestedVal : selectedRate.currentValue}
                        onChange={e => {
                          setRcrRateKey(selectedRate.id)
                          setRcrRateLabel(selectedRate.label)
                          setRcrCurrentVal(selectedRate.currentValue)
                          setRcrRequestedVal(parseFloat(e.target.value) || 0)
                        }}
                      />
                    </div>
                    <div>
                      <Label>Reason</Label>
                      <Textarea rows={2} value={rcrReason} onChange={e => setRcrReason(e.target.value)} placeholder="Why do you need this change?" />
                    </div>
                    {rcrError && <p className="text-xs text-red-600">{rcrError}</p>}
                    {rcrSuccess && <p className="text-xs text-green-600">{rcrSuccess}</p>}
                    <Btn
                      disabled={rcrSubmitting}
                      onClick={async () => {
                        setRcrSubmitting(true); setRcrError(''); setRcrSuccess('')
                        try {
                          const res = await fetch('/api/rate-requests', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              rate_key: selectedRate.id,
                              rate_label: selectedRate.label,
                              current_value: selectedRate.currentValue,
                              requested_value: rcrRequestedVal,
                              reason: rcrReason || undefined,
                            }),
                          })
                          if (res.ok) { setRcrSuccess('Request submitted!'); setRcrReason('') }
                          else { const d = await res.json(); setRcrError(d.error ?? 'Failed') }
                        } finally { setRcrSubmitting(false) }
                      }}
                    >
                      {rcrSubmitting ? 'Submitting…' : 'Submit Change Request'}
                    </Btn>
                  </div>
                ) : (
                  /* Admin: direct edit */
                  <div className="space-y-3">
                    <div>
                      <Label>New Value ({selectedRate.unit})</Label>
                      <Input
                        type="number"
                        step={0.01}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Change Comment *</Label>
                      <Textarea
                        rows={2}
                        value={editComment}
                        onChange={e => setEditComment(e.target.value)}
                        placeholder="Reason for change…"
                      />
                    </div>
                    <div>
                      <Label>Changed By *</Label>
                      <Input
                        value={editChangedBy || (session?.user?.name ?? session?.user?.email ?? '')}
                        onChange={e => setEditChangedBy(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <Btn onClick={saveRate}>Save Change</Btn>
                      <Btn variant="secondary" onClick={resetRates}>Reset Rates</Btn>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* Manager: My Rate Change Requests */}
        {userRole === 'manager' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-1)]">My Rate Change Requests</h3>
              <button
                type="button"
                onClick={loadRateRequests}
                className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors"
              >
                {rateReqLoading ? 'Loading…' : '↺ Refresh'}
              </button>
            </div>
            {rateRequests.length === 0 && !rateReqLoading && (
              <div className="text-sm text-[var(--color-text-3)] py-4 text-center bg-white border border-[var(--color-border)] rounded-xl">
                No requests yet.{' '}
                <button type="button" onClick={loadRateRequests} className="text-blue-600 underline">Load</button>
              </div>
            )}
            {rateRequests.length > 0 && (
              <div className="space-y-2">
                {rateRequests.map(req => (
                  <div key={req.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-white flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text-1)]">{req.rate_label}</p>
                      <p className="text-xs text-[var(--color-text-2)] mt-0.5">
                        <span className="font-mono">{fmt$(req.current_value)}</span>
                        {' → '}
                        <span className="font-mono font-semibold text-blue-700">{fmt$(req.requested_value)}</span>
                      </p>
                      {req.reason && <p className="text-xs text-[var(--color-text-3)] mt-0.5 italic">&ldquo;{req.reason}&rdquo;</p>}
                      {req.review_note && (
                        <p className="text-xs text-[var(--color-text-3)] mt-0.5">
                          Admin note: <span className="italic">{req.review_note}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700'
                        : req.status === 'approved' ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                      }`}>
                        {req.status}
                      </span>
                      {req.reviewed_at && (
                        <p className="text-xs text-[var(--color-text-3)]">
                          by {req.reviewer_name ?? '—'} on {fmtTime(req.reviewed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Tab 8: Pricing History ─────────────────────────────────────────────────
  function renderPricingHistory() {
    const byWho = pricingHistory.reduce<Record<string, { count: number; latest: string }>>((acc, h) => {
      if (!acc[h.changedBy]) acc[h.changedBy] = { count: 0, latest: h.changedAt }
      acc[h.changedBy].count += 1
      if (h.changedAt > acc[h.changedBy].latest) acc[h.changedBy].latest = h.changedAt
      return acc
    }, {})

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-2)]">
            Total Changes Logged: <strong>{pricingHistory.length}</strong>
          </span>
        </div>

        {Object.keys(byWho).length > 0 && (
          <Card title="Who Made Changes">
            <div className="space-y-2">
              {Object.entries(byWho)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([name, { count, latest }]) => (
                  <div key={name} className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--color-border)] last:border-0">
                    <span className="font-medium text-[var(--color-text-1)]">{name}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-[var(--color-text-3)]">{count} change{count !== 1 ? 's' : ''}</span>
                      <span className="font-mono text-[var(--color-text-3)]">{fmtTime(latest)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {pricingHistory.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-[var(--color-text-3)] bg-white border border-[var(--color-border)] rounded-xl">
            No pricing changes recorded yet.
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-3)] uppercase">Time</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-3)] uppercase">Item</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-[var(--color-text-3)] uppercase">Old Rate</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-[var(--color-text-3)] uppercase">New Rate</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-3)] uppercase">Changed By</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-3)] uppercase">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingHistory.map(h => (
                    <tr key={h.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-2)]">
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--color-text-3)] whitespace-nowrap">{fmtTime(h.changedAt)}</td>
                      <td className="py-2.5 px-3">
                        <div className="text-sm text-[var(--color-text-1)]">{h.label}</div>
                        <div className="text-xs font-mono text-[var(--color-text-3)]">{h.rateId}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm text-[var(--color-text-3)]">{fmt$(h.previousValue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-[var(--color-text-1)]">{fmt$(h.newValue)}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--color-text-2)]">{h.changedBy}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--color-text-2)] max-w-xs truncate">{h.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    )
  }

  // ── Tab 9: Customer ────────────────────────────────────────────────────────
  function renderCustomer() {
    const isCompanyComplete = !!(settings.companyName && settings.phoneNumber && (settings.supportEmail || settings.quoteEmail))
    const isQuoteConfigured = !!(settings.quoteValidityDays)

    return (
      <div className="grid grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="col-span-2 space-y-4">
          <Card title="Company Information">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={settings.companyName}
                  onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={settings.phoneNumber}
                  onChange={e => setSettings(s => ({ ...s, phoneNumber: e.target.value }))}
                />
              </div>
              <div>
                <Label>Support Email</Label>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={e => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
                  placeholder="support@company.com"
                />
              </div>
              <div>
                <Label>Quote Email</Label>
                <Input
                  type="email"
                  value={settings.quoteEmail}
                  onChange={e => setSettings(s => ({ ...s, quoteEmail: e.target.value }))}
                  placeholder="quotes@company.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={settings.address}
                  onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
                  placeholder="123 Warehouse Blvd, Los Angeles, CA 90001"
                />
              </div>
              <div className="col-span-2">
                <Label>Website</Label>
                <Input
                  value={settings.website}
                  onChange={e => setSettings(s => ({ ...s, website: e.target.value }))}
                  placeholder="https://fldistributions.com"
                />
              </div>
            </div>
          </Card>

          <Card title="Quote Settings">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Quote Validity (days)</Label>
                <Input
                  type="number"
                  value={settings.quoteValidityDays}
                  onChange={e => setSettings(s => ({ ...s, quoteValidityDays: parseInt(e.target.value) || 7 }))}
                  min={1}
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select
                  value={settings.paymentTerms}
                  onChange={e => setSettings(s => ({ ...s, paymentTerms: e.target.value as CustomerSettings['paymentTerms'] }))}
                >
                  <option>Due on Receipt</option>
                  <option>Net 15</option>
                  <option>Net 30</option>
                  <option>Net 45</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <ToggleRow
                label="Include Terms &amp; Conditions"
                description="Append T&amp;C to outgoing quotes"
                value={settings.includeTermsAndConditions}
                onChange={v => setSettings(s => ({ ...s, includeTermsAndConditions: v }))}
              />
              <ToggleRow
                label="Auto-Send Quotes"
                description="Automatically email AI-generated quotes without manual review"
                value={settings.autoSendQuotes}
                onChange={v => setSettings(s => ({ ...s, autoSendQuotes: v }))}
              />
              <ToggleRow
                label="Require Approval"
                description="Require internal approval before sending quotes"
                value={settings.requireApproval}
                onChange={v => setSettings(s => ({ ...s, requireApproval: v }))}
              />
            </div>
          </Card>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">
          {/* Save button */}
          <div className="flex items-center gap-3">
            <Btn onClick={saveSettings}>Save Settings</Btn>
            {savedAt && (
              <span className="text-xs font-mono text-green-700">Saved {savedAt}</span>
            )}
          </div>

          <Card title="Email Domains">
            <div className="mb-3">
              <Label>Primary Domain</Label>
              <Input
                value={settings.primaryDomain}
                onChange={e => setSettings(s => ({ ...s, primaryDomain: e.target.value.toLowerCase() }))}
                placeholder="fldistributions.com"
              />
            </div>
            <Label>Additional Domains</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                placeholder="partner.com"
                className="flex-1"
              />
              <Btn size="sm" variant="secondary" onClick={addDomain}>Add</Btn>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.additionalDomains.map(d => (
                <span key={d} className="flex items-center gap-1 px-2 py-1 bg-[var(--color-bg-3)] rounded text-xs text-[var(--color-text-2)]">
                  {d}
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, additionalDomains: s.additionalDomains.filter(x => x !== d) }))}
                    className="text-[var(--color-text-3)] hover:text-red-500 ml-0.5 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </Card>

          <Card title="Configuration Status">
            <div className="space-y-2">
              {[
                { label: 'Company Info', ok: isCompanyComplete },
                { label: 'Quote Settings', ok: isQuoteConfigured },
                { label: 'Business Hours', ok: true, badge: 'Set' },
                { label: 'Email Domains', ok: true, badge: `${settings.additionalDomains.length + (settings.primaryDomain ? 1 : 0)} domain${settings.additionalDomains.length + (settings.primaryDomain ? 1 : 0) !== 1 ? 's' : ''}` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[var(--color-text-2)]">{row.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${row.ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {row.badge ?? (row.ok ? 'Complete' : 'Pending')}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Configuration Tips">
            <ul className="space-y-2 text-xs text-[var(--color-text-2)]">
              <li className="flex gap-2"><span className="text-[var(--color-text-3)]">•</span> Set your company name and phone number for email signatures</li>
              <li className="flex gap-2"><span className="text-[var(--color-text-3)]">•</span> Add your quote email to enable routing</li>
              <li className="flex gap-2"><span className="text-[var(--color-text-3)]">•</span> Configure email domains to identify inbound customers</li>
              <li className="flex gap-2"><span className="text-[var(--color-text-3)]">•</span> Set quote validity days to match your standard terms</li>
              <li className="flex gap-2"><span className="text-[var(--color-text-3)]">•</span> Enable Require Approval to review quotes before delivery</li>
            </ul>
          </Card>
        </div>
      </div>
    )
  }

  // ── Tab 10: Team (admin only) ──────────────────────────────────────────────
  function renderTeam() {
    async function loadTeam() {
      setTeamLoading(true)
      try {
        const res = await fetch('/api/users')
        if (res.ok) {
          const data = await res.json()
          setTeamUsers(data.users ?? [])
        }
      } finally {
        setTeamLoading(false)
      }
    }
    async function handleAddUser(e: React.FormEvent) {
      e.preventDefault()
      setAddUserError('')
      setAddUserSuccess('')
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addUserEmail, name: addUserName, password: addUserPassword || undefined, role: addUserRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddUserError(data.error ?? 'Failed to create user')
        return
      }
      const pw = addUserPassword || '(Google-only — no password set)'
      if (addUserPassword && data.user?.id) {
        setKnownPasswords(prev => ({ ...prev, [data.user.id]: addUserPassword }))
      }
      setAddUserSuccess(`User ${data.user.email} created. Password: ${pw}`)
      setAddUserEmail(''); setAddUserName(''); setAddUserPassword(''); setAddUserRole('staff')
      loadTeam()
    }

    async function toggleActive(userId: string, current: boolean) {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current }),
      })
      loadTeam()
    }

    async function changeRole(userId: string, role: string) {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      loadTeam()
    }

    async function handleResetPassword(userId: string) {
      if (!resetPwValue.trim()) return
      setResetPwLoading(true)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPwValue }),
      })
      if (res.ok) {
        setKnownPasswords(prev => ({ ...prev, [userId]: resetPwValue }))
        setResetPwUserId(null)
        setResetPwValue('')
      }
      setResetPwLoading(false)
    }

    async function reviewRequest(reqId: string, status: 'approved' | 'rejected', note?: string) {
      await fetch(`/api/rate-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_note: note }),
      })
      if (status === 'approved') {
        const req = rateRequests.find(r => r.id === reqId)
        if (req) {
          const now = new Date().toISOString()
          const updated = pricingRates.map(r =>
            r.id === req.rate_key
              ? { ...r, currentValue: req.requested_value, updatedAt: now, lastComment: req.reason ?? 'Approved rate change request' }
              : r
          )
          setPricingRates(updated)
          localStorage.setItem('fld_pricing_logic_rates_v1', JSON.stringify(updated))
          const entry: PricingHistoryEntry = {
            id: uid(),
            rateId: req.rate_key,
            label: req.rate_label,
            previousValue: req.current_value,
            newValue: req.requested_value,
            changedBy: session?.user?.name ?? session?.user?.email ?? 'Admin',
            comment: `Approved: ${req.reason ?? 'Rate change request'}`,
            changedAt: now,
          }
          persistHistory([entry, ...pricingHistory])
        }
      }
      loadRateRequests()
    }

    return (
      <div className="space-y-6">
        {/* User List */}
        <Card
          title="Team Members"
          action={
            <button
              type="button"
              onClick={loadTeam}
              className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors"
            >
              {teamLoading ? 'Loading…' : '↺ Refresh'}
            </button>
          }
        >
          {teamUsers.length === 0 && !teamLoading && (
            <div className="text-sm text-[var(--color-text-3)] py-4 text-center">
              No users loaded.{' '}
              <button type="button" onClick={loadTeam} className="text-blue-600 underline">Load</button>
            </div>
          )}
          {teamUsers.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-3)] uppercase">Name / Email</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-3)] uppercase">Password</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-3)] uppercase">Role</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-[var(--color-text-3)] uppercase">Status</th>
                  <th className="text-left py-2 text-xs font-medium text-[var(--color-text-3)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamUsers.map(u => (
                  <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-[var(--color-text-1)]">{u.name ?? '—'}</div>
                      <div className="text-xs text-[var(--color-text-3)]">{u.email}</div>
                    </td>
                    <td className="py-2.5 pr-4 min-w-[180px]">
                      {resetPwUserId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={resetPwValue}
                            onChange={e => setResetPwValue(e.target.value)}
                            placeholder="New password"
                            className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-1)] text-[var(--color-text-1)] w-28"
                          />
                          <button
                            type="button"
                            disabled={resetPwLoading}
                            onClick={() => handleResetPassword(u.id)}
                            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetPwUserId(null); setResetPwValue('') }}
                            className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : knownPasswords[u.id] ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-[var(--color-text-1)]">
                            {revealPw[u.id] ? knownPasswords[u.id] : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealPw(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
                          >
                            {revealPw[u.id] ? 'Hide' : 'Show'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetPwUserId(u.id); setResetPwValue('') }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setResetPwUserId(u.id); setResetPwValue('') }}
                          className="text-xs px-2 py-0.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] text-[var(--color-text-3)] transition-colors"
                        >
                          Set Password
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {u.id === session?.user?.id ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">{u.role}</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-1)] text-[var(--color-text-1)]"
                        >
                          <option value="staff">staff</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {u.id !== session?.user?.id && (
                        <button
                          type="button"
                          onClick={() => toggleActive(u.id, u.is_active)}
                          className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors"
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Add User */}
        <Card title="Add New User">
          <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" required value={addUserEmail} onChange={e => setAddUserEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={addUserName} onChange={e => setAddUserName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label>Temporary Password</Label>
              <Input type="password" value={addUserPassword} onChange={e => setAddUserPassword(e.target.value)} placeholder="Leave blank for Google-only" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={addUserRole} onChange={e => setAddUserRole(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            {addUserError && <p className="col-span-2 text-xs text-red-600">{addUserError}</p>}
            {addUserSuccess && <p className="col-span-2 text-xs text-green-600">{addUserSuccess}</p>}
            <div className="col-span-2">
              <Btn type="submit">Create User</Btn>
            </div>
          </form>
        </Card>

        {/* Permissions Table */}
        <Card title="Role Permissions">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-6 font-medium text-[var(--color-text-3)] uppercase">Permission</th>
                  <th className="text-center py-2 px-4 font-medium text-[var(--color-text-3)] uppercase">Staff</th>
                  <th className="text-center py-2 px-4 font-medium text-[var(--color-text-3)] uppercase">Manager</th>
                  <th className="text-center py-2 px-4 font-medium text-[var(--color-text-3)] uppercase">Admin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Message Inbox (AI)', staff: true, manager: true, admin: true },
                  { label: 'AI Quote tab', staff: true, manager: true, admin: true },
                  { label: 'Drayage Quote Builder', staff: true, manager: true, admin: true },
                  { label: 'Warehouse / Transloading Quote Builder', staff: true, manager: true, admin: true },
                  { label: 'Last-Mile Delivery tab', staff: true, manager: true, admin: true },
                  { label: 'Search Threads', staff: true, manager: true, admin: true },
                  { label: 'Rate Sheet — view', staff: true, manager: true, admin: true },
                  { label: 'Rate Sheet — edit rates directly', staff: false, manager: false, admin: true },
                  { label: 'Rate Sheet — submit change request', staff: false, manager: true, admin: false },
                  { label: 'Change History tab', staff: false, manager: true, admin: true },
                  { label: 'Business Settings tab', staff: false, manager: true, admin: true },
                  { label: 'Team tab', staff: false, manager: false, admin: true },
                  { label: 'View all users', staff: false, manager: false, admin: true },
                  { label: 'Create users', staff: false, manager: false, admin: true },
                  { label: 'Change user roles', staff: false, manager: false, admin: true },
                  { label: 'Deactivate / reactivate users', staff: false, manager: false, admin: true },
                  { label: 'View & reset user passwords', staff: false, manager: false, admin: true },
                  { label: 'View all rate change requests', staff: false, manager: true, admin: true },
                  { label: 'Approve / reject rate change requests', staff: false, manager: false, admin: true },
                  { label: '/ops dashboard & activity feed', staff: false, manager: true, admin: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-2)]">
                    <td className="py-2 pr-6 text-[var(--color-text-2)]">{row.label}</td>
                    {(['staff', 'manager', 'admin'] as const).map(role => (
                      <td key={role} className="py-2 px-4 text-center">
                        {row[role]
                          ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold">✓</span>
                          : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50 text-red-400 font-bold">✕</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Rate Change Requests */}
        <Card
          title="Rate Change Requests"
          action={
            <button
              type="button"
              onClick={loadRateRequests}
              className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors"
            >
              {rateReqLoading ? 'Loading…' : '↺ Refresh'}
            </button>
          }
        >
          {rateRequests.length === 0 && !rateReqLoading && (
            <div className="text-sm text-[var(--color-text-3)] py-4 text-center">
              No requests.{' '}
              <button type="button" onClick={loadRateRequests} className="text-blue-600 underline">Load</button>
            </div>
          )}
          {rateRequests.length > 0 && (
            <div className="space-y-3">
              {rateRequests.map(req => (
                <div key={req.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text-1)]">{req.rate_label}</p>
                      <p className="text-xs text-[var(--color-text-3)] mt-0.5 font-mono">{req.rate_key}</p>
                      <p className="text-xs text-[var(--color-text-2)] mt-1">
                        <span className="font-mono">{fmt$(req.current_value)}</span>
                        {' → '}
                        <span className="font-mono font-semibold text-blue-700">{fmt$(req.requested_value)}</span>
                        {' by '}
                        <span className="font-medium">{req.requester_name ?? req.requester_email}</span>
                      </p>
                      {req.reason && <p className="text-xs text-[var(--color-text-3)] mt-1 italic">&ldquo;{req.reason}&rdquo;</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700'
                        : req.status === 'approved' ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                      }`}>
                        {req.status}
                      </span>
                      {req.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => reviewRequest(req.id, 'approved')}
                            className="text-xs px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewRequest(req.id, 'rejected')}
                            className="text-xs px-2.5 py-1 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {req.reviewed_at && (
                        <p className="text-xs text-[var(--color-text-3)]">
                          by {req.reviewer_name ?? '—'} on {fmtTime(req.reviewed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  function renderDiscountTaxPanel(base: number) {
    const DISCOUNT_OPTS = [3, 5, 10, 15, 20]
    const TAX_OPTS = [5, 7.5, 10, 12.5, 18]
    const discountAmt = simDiscountPct != null ? base * simDiscountPct / 100 : 0
    const afterDiscount = base - discountAmt
    const taxAmt = simTaxPct != null ? afterDiscount * simTaxPct / 100 : 0
    const finalTotal = afterDiscount + taxAmt

    function applyCustomDiscount() {
      const v = parseFloat(discountCustomVal)
      if (!isNaN(v) && v >= 0 && v <= 100) {
        setSimDiscountPct(v); setShowDiscountPicker(false); setDiscountCustomMode(false); setDiscountCustomVal('')
      }
    }
    function applyCustomTax() {
      const v = parseFloat(taxCustomVal)
      if (!isNaN(v) && v >= 0 && v <= 100) {
        setSimTaxPct(v); setShowTaxPicker(false); setTaxCustomMode(false); setTaxCustomVal('')
      }
    }

    return (
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        {/* Toggle buttons */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => { setShowDiscountPicker(v => !v); setShowTaxPicker(false); setTaxCustomMode(false) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${simDiscountPct != null ? 'bg-green-50 border-green-300 text-green-700' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}
          >
            {simDiscountPct != null ? `Discount: ${simDiscountPct}%` : '+ Add Discount'}
          </button>
          {simDiscountPct != null && (
            <button type="button" onClick={() => { setSimDiscountPct(null); setDiscountCustomMode(false) }} className="text-xs text-red-400 hover:text-red-600">✕</button>
          )}
          <button
            type="button"
            onClick={() => { setShowTaxPicker(v => !v); setShowDiscountPicker(false); setDiscountCustomMode(false) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${simTaxPct != null ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}
          >
            {simTaxPct != null ? `Tax: ${simTaxPct}%` : '+ Add Tax'}
          </button>
          {simTaxPct != null && (
            <button type="button" onClick={() => { setSimTaxPct(null); setTaxCustomMode(false) }} className="text-xs text-red-400 hover:text-red-600">✕</button>
          )}
        </div>

        {/* Discount picker */}
        {showDiscountPicker && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {DISCOUNT_OPTS.map(p => (
                <button key={p} type="button"
                  onClick={() => { setSimDiscountPct(p); setShowDiscountPicker(false); setDiscountCustomMode(false) }}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${simDiscountPct === p ? 'bg-green-500 text-white border-green-500' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-green-50 hover:border-green-300 hover:text-green-700'}`}>
                  {p}%
                </button>
              ))}
              <button type="button"
                onClick={() => setDiscountCustomMode(v => !v)}
                className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${discountCustomMode ? 'bg-green-500 text-white border-green-500' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-green-50 hover:border-green-300 hover:text-green-700'}`}>
                Custom
              </button>
            </div>
            {discountCustomMode && (
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={discountCustomVal}
                  onChange={e => setDiscountCustomVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyCustomDiscount()}
                  placeholder="e.g. 12.5"
                  className="w-28 px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-green-400"
                  autoFocus
                />
                <span className="text-xs text-[var(--color-text-3)]">%</span>
                <button type="button" onClick={applyCustomDiscount}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  Apply
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tax picker */}
        {showTaxPicker && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {TAX_OPTS.map(p => (
                <button key={p} type="button"
                  onClick={() => { setSimTaxPct(p); setShowTaxPicker(false); setTaxCustomMode(false) }}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${simTaxPct === p ? 'bg-blue-500 text-white border-blue-500' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'}`}>
                  {p}%
                </button>
              ))}
              <button type="button"
                onClick={() => setTaxCustomMode(v => !v)}
                className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${taxCustomMode ? 'bg-blue-500 text-white border-blue-500' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'}`}>
                Custom
              </button>
            </div>
            {taxCustomMode && (
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={taxCustomVal}
                  onChange={e => setTaxCustomVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyCustomTax()}
                  placeholder="e.g. 8.25"
                  className="w-28 px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-400"
                  autoFocus
                />
                <span className="text-xs text-[var(--color-text-3)]">%</span>
                <button type="button" onClick={applyCustomTax}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Apply
                </button>
              </div>
            )}
          </div>
        )}

        {/* Breakdown */}
        {(simDiscountPct != null || simTaxPct != null) && (
          <div className="space-y-1.5 text-sm mt-2">
            <div className="flex justify-between text-[var(--color-text-2)]">
              <span>Base</span><span className="font-mono">{fmt$(base)}</span>
            </div>
            {simDiscountPct != null && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({simDiscountPct}%)</span><span className="font-mono">−{fmt$(discountAmt)}</span>
              </div>
            )}
            {simTaxPct != null && (
              <div className="flex justify-between text-blue-600">
                <span>Tax ({simTaxPct}%)</span><span className="font-mono">+{fmt$(taxAmt)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-[var(--color-border)] pt-2 mt-1">
              <span>Final Total</span><span className="font-mono text-blue-700">{fmt$(finalTotal)}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderQuoteBuilder() {
    const subTabs: { id: QuoteBuilderSubTab; label: string }[] = [
      { id: 'drayage', label: 'Drayage' },
      { id: 'transloading', label: 'Warehouse / Transloading' },
      { id: 'last-mile', label: 'Last-Mile Delivery' },
    ]
    return (
      <div>
        <div className="flex items-center gap-2 mb-6 border-b border-[var(--color-border)] pb-3">
          {subTabs.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setQbSubTab(st.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                qbSubTab === st.id
                  ? 'bg-blue-600 text-white'
                  : 'text-[var(--color-text-2)] border border-[var(--color-border)] hover:bg-[var(--color-bg-2)]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
        {qbSubTab === 'drayage' && renderDrayage()}
        {qbSubTab === 'transloading' && renderTransloading()}
        {qbSubTab === 'last-mile' && renderLastMile()}
      </div>
    )
  }

  function renderCrm() {
    return <CrmPanel userName={session?.user?.name ?? ''} />
  }

  const tabContent: Record<TabMode, () => React.ReactNode> = {
    inbox: renderInbox,
    'ai-review': renderAiReview,
    'quote-builder': renderQuoteBuilder,
    search: renderSearch,
    crm: renderCrm,
    'pricing-logic': renderPricingLogic,
    'pricing-history': renderPricingHistory,
    customer: renderCustomer,
    team: renderTeam,
  }

  const unreadCount = emails.filter(e => !e.isRead).length
  const queueCount = aiQueue.length

  return (
    <div className="min-h-screen bg-[var(--color-bg-2)]">
      {/* Sticky header / tab bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[var(--color-border)] shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left: brand */}
          <div className="flex items-center gap-3 flex-shrink-0 mr-4">
            <span className="font-semibold text-sm text-[var(--color-text-1)] whitespace-nowrap">
              QuotionAI
            </span>
          </div>

          {/* Center: tabs — filtered by role */}
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {TABS.filter(t => !t.minRole || roleLevel(userRole) >= roleLevel(t.minRole)).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-[var(--color-text-2)] border border-[var(--color-border)] hover:bg-[var(--color-bg-2)]'
                }`}
              >
                {t.label}
                {t.id === 'inbox' && unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
                {t.id === 'ai-review' && queueCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {queueCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right: refresh + theme + user/sign-out */}
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            {tab === 'inbox' && (
              <button
                type="button"
                onClick={() => { loadRealEmails() }}
                className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors"
              >
                ↺ Refresh
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-2)] text-[var(--color-text-2)] transition-colors select-none"
            >
              {isDark ? '☀ Light' : '☾ Dark'}
            </button>
            {session?.user && (
              <div className="relative pl-2 border-l border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setProfileOpen(o => !o)}
                  className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center hover:bg-blue-700 transition-colors select-none"
                  title={session.user.name ?? session.user.email ?? ''}
                >
                  {(session.user.name ?? session.user.email ?? '?')[0].toUpperCase()}
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-9 z-50 w-52 bg-white border border-[var(--color-border)] rounded-lg shadow-lg py-1">
                      <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
                        <p className="text-sm font-medium text-[var(--color-text-1)] truncate">{session.user.name ?? '—'}</p>
                        <p className="text-xs text-[var(--color-text-3)] truncate mt-0.5">{session.user.email}</p>
                        <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium uppercase">{userRole}</span>
                      </div>
                      <button
                        type="button"
                        disabled={signOutPending}
                        onClick={() => { setProfileOpen(false); startSignOut(() => { signOut({ callbackUrl: '/login' }) }) }}
                        className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {tabContent[tab]()}
      </div>
    </div>
  )
}
