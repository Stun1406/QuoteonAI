'use client'

import React, { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type CrmSubTab = 'dashboard' | 'customers' | 'quotes' | 'carriers' | 'shipments' | 'analytics'

interface DashboardStats {
  totalAccounts: number
  totalQuotes: number
  winRate: number
  avgQuoteValue: string | null
  totalShipments: number
  inTransit: number
}

interface RecentQuote {
  id: string
  processor_type: string
  status: string
  quote_value: number | null
  created_at: string
  contact_name: string | null
  company_name: string | null
}

interface Account {
  id: string
  business_name: string
  email_domain: string | null
  industry_type: string | null
  category: string | null
  region: string | null
  credit_terms: string | null
  account_status: string | null
  contact_count: number
  quote_count: number
  total_value: number | null
  created_at: string
}

interface Quote {
  id: string
  processor_type: string
  status: string
  quote_value: number | null
  confidence_score: number | null
  created_at: string
  contact_name: string | null
  contact_email: string | null
  company_name: string | null
  industry_type: string | null
}

interface Carrier {
  id: string
  company_name: string
  mc_number: string | null
  dot_number: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  insurance_status: string
  insurance_expiry: string | null
  performance_score: number | null
  status: string
}

interface Shipment {
  id: string
  bol_number: string | null
  customer_name: string | null
  customer_company: string | null
  carrier_name: string | null
  origin: string | null
  destination: string | null
  equipment_type: string | null
  service_type: string | null
  pickup_date: string | null
  delivery_date: string | null
  actual_delivery: string | null
  status: string
  quote_value: number | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function serviceLabel(t: string | null): string {
  if (!t) return '—'
  const m: Record<string, string> = {
    drayage: 'Drayage', warehousing: 'Transloading', 'last-mile': 'Last Mile',
    hybrid: 'Combined', general: 'General',
  }
  return m[t] ?? t
}

const CATEGORY_STYLE: Record<string, string> = {
  platinum: 'bg-purple-100 text-purple-800',
  gold: 'bg-yellow-100 text-yellow-800',
  silver: 'bg-slate-200 text-slate-700',
  bronze: 'bg-orange-100 text-orange-800',
  standard: 'bg-blue-50 text-blue-700',
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  'in-progress': 'bg-yellow-50 text-yellow-700',
  quoted: 'bg-indigo-50 text-indigo-700',
  won: 'bg-green-50 text-green-700',
  lost: 'bg-red-50 text-red-700',
  pending: 'bg-slate-100 text-slate-600',
  'in-transit': 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
}

function Badge({ label, styleKey }: { label: string; styleKey?: string }) {
  const key = (styleKey ?? label).toLowerCase()
  const cls = STATUS_STYLE[key] ?? CATEGORY_STYLE[key] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
      <p className="text-xs font-medium text-[var(--color-text-3)] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color ?? 'text-[var(--color-text-1)]'} mb-1`}>{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-3)]">{sub}</p>}
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="font-semibold text-[var(--color-text-1)] mb-1">{title}</p>
      <p className="text-sm text-[var(--color-text-3)]">{sub}</p>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-base font-semibold text-[var(--color-text-1)]">{title}</h2>
      {count != null && (
        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide whitespace-nowrap">
    {children}
  </th>
)
const TD = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-4 py-3 text-sm text-[var(--color-text-1)] ${className ?? ''}`}>
    {children}
  </td>
)

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full border-collapse">
        <thead className="bg-[var(--color-bg-2)]">
          <tr>{headers.map(h => <TH key={h}>{h}</TH>)}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
          {children}
        </tbody>
      </table>
    </div>
  )
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function Dashboard({ stats, recent }: { stats: DashboardStats | null; recent: RecentQuote[] }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Accounts" value={stats.totalAccounts} sub="All companies" />
        <StatCard label="Total Quotes" value={stats.totalQuotes} sub="All time" />
        <StatCard
          label="Quote Win Rate"
          value={`${stats.winRate}%`}
          sub="Won vs total"
          color={stats.winRate >= 50 ? 'text-green-600' : stats.winRate >= 25 ? 'text-yellow-600' : 'text-[var(--color-text-1)]'}
        />
        <StatCard
          label="Avg Quote Value"
          value={stats.avgQuoteValue ? `$${Number(stats.avgQuoteValue).toLocaleString()}` : '—'}
          sub="Per quote"
        />
        <StatCard label="Total Shipments" value={stats.totalShipments} sub="All time" />
        <StatCard label="In Transit" value={stats.inTransit} sub="Active shipments" color="text-blue-600" />
      </div>

      {/* Recent Quotes */}
      <div>
        <SectionHeader title="Recent Quotes" count={recent.length} />
        {recent.length === 0 ? (
          <EmptyState icon="📋" title="No quotes yet" sub="Quotes will appear here as emails are processed." />
        ) : (
          <Table headers={['Customer', 'Company', 'Type', 'Value', 'Status', 'Date']}>
            {recent.map(q => (
              <tr key={q.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
                <TD>{q.contact_name ?? '—'}</TD>
                <TD className="font-medium">{q.company_name ?? '—'}</TD>
                <TD>{serviceLabel(q.processor_type)}</TD>
                <TD className="font-semibold text-blue-700">{fmt(q.quote_value)}</TD>
                <TD><Badge label={q.status} /></TD>
                <TD className="text-[var(--color-text-3)]">{fmtDate(q.created_at)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* Analytics overview row */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide mb-3">Quote Pipeline</p>
          <div className="space-y-2">
            {[
              { label: 'New / In Progress', color: 'bg-blue-500', pct: 60 },
              { label: 'Quoted', color: 'bg-indigo-500', pct: 25 },
              { label: 'Won', color: 'bg-green-500', pct: stats.winRate },
            ].map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--color-text-2)]">{b.label}</span>
                  <span className="text-[var(--color-text-3)]">{b.pct}%</span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-3)] rounded-full">
                  <div className={`h-1.5 ${b.color} rounded-full`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide mb-3">Service Mix</p>
          <div className="space-y-2">
            {[
              { label: 'Drayage', color: 'bg-blue-500' },
              { label: 'Transloading', color: 'bg-violet-500' },
              { label: 'Last Mile', color: 'bg-green-500' },
            ].map((s, i) => {
              const pcts = [55, 30, 15]
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--color-text-2)]">{s.label}</span>
                    <span className="text-[var(--color-text-3)]">{pcts[i]}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-bg-3)] rounded-full">
                    <div className={`h-1.5 ${s.color} rounded-full`} style={{ width: `${pcts[i]}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide mb-3">Key Metrics</p>
          <div className="space-y-3">
            {[
              { label: 'On-Time Delivery', value: '97.5%', good: true },
              { label: 'Avg Response Time', value: '< 2 min', good: true },
              { label: 'Quote Accuracy', value: '99.7%', good: true },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center">
                <span className="text-xs text-[var(--color-text-2)]">{m.label}</span>
                <span className={`text-xs font-bold ${m.good ? 'text-green-600' : 'text-red-500'}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Customers({ accounts, loading }: { accounts: Account[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || (a.business_name?.toLowerCase().includes(q) || a.email_domain?.toLowerCase().includes(q) || a.region?.toLowerCase().includes(q))
    const matchCat = filterCat === 'all' || (a.category ?? 'standard').toLowerCase() === filterCat
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
          <option value="standard">Standard</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[var(--color-bg-2)] rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🏢" title="No accounts found" sub="Accounts are created automatically when quotes are processed." />
      ) : (
        <Table headers={['Company', 'Industry', 'Category', 'Region', 'Credit Terms', 'Contacts', 'Quotes', 'Total Value', 'Since']}>
          {filtered.map(a => (
            <tr key={a.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
              <TD>
                <div className="font-medium">{a.business_name}</div>
                {a.email_domain && <div className="text-xs text-[var(--color-text-3)]">{a.email_domain}</div>}
              </TD>
              <TD>{a.industry_type ?? '—'}</TD>
              <TD>
                <Badge
                  label={(a.category ?? 'standard').charAt(0).toUpperCase() + (a.category ?? 'standard').slice(1)}
                  styleKey={a.category ?? 'standard'}
                />
              </TD>
              <TD>{a.region ?? '—'}</TD>
              <TD>{a.credit_terms ?? '—'}</TD>
              <TD className="text-center">{a.contact_count}</TD>
              <TD className="text-center">{a.quote_count}</TD>
              <TD className="font-medium text-blue-700">{fmt(a.total_value)}</TD>
              <TD className="text-[var(--color-text-3)]">{fmtDate(a.created_at)}</TD>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

function Quotes({ quotes, loading }: { quotes: Quote[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = quotes.filter(q => {
    const s = search.toLowerCase()
    const matchSearch = !s || (q.company_name?.toLowerCase().includes(s) || q.contact_name?.toLowerCase().includes(s) || q.contact_email?.toLowerCase().includes(s))
    const matchType = filterType === 'all' || q.processor_type === filterType
    const matchStatus = filterStatus === 'all' || q.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search quotes..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none">
          <option value="all">All Types</option>
          <option value="drayage">Drayage</option>
          <option value="warehousing">Transloading</option>
          <option value="last-mile">Last Mile</option>
          <option value="hybrid">Combined</option>
          <option value="general">General</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="in-progress">In Progress</option>
          <option value="quoted">Quoted</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[var(--color-bg-2)] rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📄" title="No quotes found" sub="Quotes are created automatically when quote emails are processed." />
      ) : (
        <Table headers={['Contact', 'Company', 'Industry', 'Type', 'Value', 'Confidence', 'Status', 'Date']}>
          {filtered.map(q => (
            <tr key={q.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
              <TD>
                <div className="font-medium">{q.contact_name ?? '—'}</div>
                {q.contact_email && <div className="text-xs text-[var(--color-text-3)]">{q.contact_email}</div>}
              </TD>
              <TD>{q.company_name ?? '—'}</TD>
              <TD>{q.industry_type ?? '—'}</TD>
              <TD>
                <span className="text-xs font-medium bg-[var(--color-bg-2)] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-2)]">
                  {serviceLabel(q.processor_type)}
                </span>
              </TD>
              <TD className="font-semibold text-blue-700">{fmt(q.quote_value)}</TD>
              <TD>
                {q.confidence_score != null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[var(--color-bg-3)] rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${q.confidence_score >= 0.8 ? 'bg-green-500' : q.confidence_score >= 0.5 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${q.confidence_score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-3)]">{Math.round(q.confidence_score * 100)}%</span>
                  </div>
                ) : '—'}
              </TD>
              <TD><Badge label={q.status} /></TD>
              <TD className="text-[var(--color-text-3)]">{fmtDate(q.created_at)}</TD>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

function Carriers({ carriers, loading }: { carriers: Carrier[]; loading: boolean }) {
  const [search, setSearch] = useState('')

  const filtered = carriers.filter(c => {
    const s = search.toLowerCase()
    return !s || c.company_name.toLowerCase().includes(s) || c.mc_number?.toLowerCase().includes(s) || c.dot_number?.toLowerCase().includes(s)
  })

  function scoreColor(score: number | null): string {
    if (!score) return 'text-[var(--color-text-3)]'
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-500'
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search carriers..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-[var(--color-bg-2)] rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🚛" title="No carriers yet" sub="Add carriers to track MC#, DOT#, insurance, and performance scores." />
      ) : (
        <Table headers={['Carrier', 'MC #', 'DOT #', 'Contact', 'Insurance', 'Exp. Date', 'Perf. Score', 'Status']}>
          {filtered.map(c => (
            <tr key={c.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
              <TD>
                <div className="font-medium">{c.company_name}</div>
              </TD>
              <TD>{c.mc_number ?? '—'}</TD>
              <TD>{c.dot_number ?? '—'}</TD>
              <TD>
                <div>{c.contact_name ?? '—'}</div>
                {c.contact_phone && <div className="text-xs text-[var(--color-text-3)]">{c.contact_phone}</div>}
              </TD>
              <TD><Badge label={c.insurance_status} /></TD>
              <TD className="text-[var(--color-text-3)]">{c.insurance_expiry ? fmtDate(c.insurance_expiry) : '—'}</TD>
              <TD>
                <span className={`font-bold text-base ${scoreColor(c.performance_score)}`}>
                  {c.performance_score != null ? `${c.performance_score}/10` : '—'}
                </span>
              </TD>
              <TD><Badge label={c.status} /></TD>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

function Shipments({ shipments, loading }: { shipments: Shipment[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = shipments.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.bol_number?.toLowerCase().includes(q) || s.customer_company?.toLowerCase().includes(q) || s.origin?.toLowerCase().includes(q) || s.destination?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by BOL#, customer, origin, destination..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in-transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[var(--color-bg-2)] rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📦" title="No shipments yet" sub="Shipments are tracked here once orders are confirmed and booked." />
      ) : (
        <Table headers={['BOL #', 'Customer', 'Carrier', 'Route', 'Equipment', 'Service', 'Pickup', 'Delivery', 'Value', 'Status']}>
          {filtered.map(s => (
            <tr key={s.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
              <TD><span className="font-mono text-xs">{s.bol_number ?? '—'}</span></TD>
              <TD>{s.customer_company ?? s.customer_name ?? '—'}</TD>
              <TD>{s.carrier_name ?? '—'}</TD>
              <TD>
                <span className="text-xs">{s.origin ?? '—'}</span>
                {s.origin && s.destination && <span className="mx-1 text-[var(--color-text-3)]">→</span>}
                <span className="text-xs">{s.destination ?? ''}</span>
              </TD>
              <TD>{s.equipment_type ?? '—'}</TD>
              <TD>{s.service_type ?? '—'}</TD>
              <TD className="text-[var(--color-text-3)]">{fmtDate(s.pickup_date)}</TD>
              <TD className="text-[var(--color-text-3)]">{fmtDate(s.actual_delivery ?? s.delivery_date)}</TD>
              <TD className="font-medium text-blue-700">{fmt(s.quote_value)}</TD>
              <TD><Badge label={s.status} /></TD>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

const ANALYTICS_PROMPTS = [
  'What is the quote win rate this month?',
  'Show quote conversion ratio by service type',
  'Which lanes have the highest margin?',
  'Carrier performance summary',
  'Revenue breakdown by customer',
  'What are the top reasons for quote decline?',
]

function Analytics({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', text: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/crm/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text.trim() }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer ?? 'Sorry, I could not generate an answer.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Analytics service unavailable. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const fn = (userName || 'there').split(' ')[0]

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] min-h-[520px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 mb-4 text-white">
        <p className="text-xl font-semibold mb-0.5">Hi {fn}, Welcome 👋</p>
        <p className="text-blue-100 text-sm">Ask anything about your quotes, customers, revenue, or operations.</p>
      </div>

      {/* Default prompts */}
      {messages.length === 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide mb-2">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {ANALYTICS_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => send(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-2)] hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-1)] rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1.5 items-center h-4">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Ask about pricing trends, win rates, customer analytics..."
          disabled={loading}
          className="flex-1 px-4 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface CrmData {
  dashboard: { stats: DashboardStats; recentQuotes: RecentQuote[] } | null
  accounts: Account[]
  quotes: Quote[]
  carriers: Carrier[]
  shipments: Shipment[]
}

interface CrmPanelProps {
  userName?: string
}

export default function CrmPanel({ userName = '' }: CrmPanelProps) {
  const [subTab, setSubTab] = useState<CrmSubTab>('dashboard')
  const [data, setData] = useState<CrmData>({ dashboard: null, accounts: [], quotes: [], carriers: [], shipments: [] })
  const [loading, setLoading] = useState<Record<CrmSubTab, boolean>>({
    dashboard: false, customers: false, quotes: false, carriers: false, shipments: false, analytics: false,
  })
  const loaded = useRef<Set<CrmSubTab>>(new Set())

  async function fetchSection(section: CrmSubTab) {
    if (section === 'analytics' || loaded.current.has(section)) return
    setLoading(prev => ({ ...prev, [section]: true }))
    try {
      const apiSection = section === 'customers' ? 'accounts' : section
      const res = await fetch(`/api/crm?section=${apiSection}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()

      if (section === 'dashboard') {
        setData(prev => ({ ...prev, dashboard: { stats: json.stats, recentQuotes: json.recentQuotes } }))
      } else if (section === 'customers') {
        setData(prev => ({ ...prev, accounts: json.accounts ?? [] }))
      } else if (section === 'quotes') {
        setData(prev => ({ ...prev, quotes: json.quotes ?? [] }))
      } else if (section === 'carriers') {
        setData(prev => ({ ...prev, carriers: json.carriers ?? [] }))
      } else if (section === 'shipments') {
        setData(prev => ({ ...prev, shipments: json.shipments ?? [] }))
      }
      loaded.current.add(section)
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }))
    }
  }

  useEffect(() => { fetchSection(subTab) }, [subTab])

  const SUB_TABS: { id: CrmSubTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'customers', label: 'Customers', icon: '🏢' },
    { id: 'quotes', label: 'Quotes', icon: '📋' },
    { id: 'carriers', label: 'Carriers', icon: '🚛' },
    { id: 'shipments', label: 'Shipments', icon: '📦' },
    { id: 'analytics', label: 'AI Analytics', icon: '✨' },
  ]

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-[var(--color-text-2)] border border-[var(--color-border)] hover:bg-[var(--color-bg-2)]'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
        <button
          onClick={() => { loaded.current.delete(subTab); fetchSection(subTab) }}
          className="ml-auto text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] flex items-center gap-1 border border-[var(--color-border)] px-2.5 py-1.5 rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Panel label */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{SUB_TABS.find(t => t.id === subTab)?.icon}</span>
        <h1 className="text-lg font-semibold text-[var(--color-text-1)]">
          {subTab === 'dashboard' && 'CRM Dashboard'}
          {subTab === 'customers' && 'Customer Accounts'}
          {subTab === 'quotes' && 'Quote History'}
          {subTab === 'carriers' && 'Carrier Management'}
          {subTab === 'shipments' && 'Shipment Tracking'}
          {subTab === 'analytics' && 'AI Analytics'}
        </h1>
        {subTab === 'customers' && <span className="text-sm text-[var(--color-text-3)]">— Accounts, contacts & customer tiers</span>}
        {subTab === 'quotes' && <span className="text-sm text-[var(--color-text-3)]">— Full quote pipeline & conversion tracking</span>}
        {subTab === 'carriers' && <span className="text-sm text-[var(--color-text-3)]">— MC#, DOT#, insurance & performance</span>}
        {subTab === 'shipments' && <span className="text-sm text-[var(--color-text-3)]">— BOL tracking & delivery status</span>}
        {subTab === 'analytics' && <span className="text-sm text-[var(--color-text-3)]">— Ask anything about your operations</span>}
      </div>

      {/* Content */}
      {subTab === 'dashboard' && (
        <Dashboard stats={data.dashboard?.stats ?? null} recent={data.dashboard?.recentQuotes ?? []} />
      )}
      {subTab === 'customers' && (
        <Customers accounts={data.accounts} loading={loading.customers} />
      )}
      {subTab === 'quotes' && (
        <Quotes quotes={data.quotes} loading={loading.quotes} />
      )}
      {subTab === 'carriers' && (
        <Carriers carriers={data.carriers} loading={loading.carriers} />
      )}
      {subTab === 'shipments' && (
        <Shipments shipments={data.shipments} loading={loading.shipments} />
      )}
      {subTab === 'analytics' && (
        <Analytics userName={userName} />
      )}
    </div>
  )
}
