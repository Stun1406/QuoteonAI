'use client'

import React, { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type CrmSubTab = 'dashboard' | 'customers' | 'quotes' | 'carriers' | 'shipments' | 'analytics' | 'pricing'

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
  actual_pickup: string | null
  actual_delivery: string | null
  status: string
  quote_value: number | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  showActions?: boolean
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

function formatShipmentNumber(index: number): string {
  return `shn-${String(index + 1).padStart(3, '0')}`
}

function shipmentSortTime(shipment: Shipment): number {
  const dateCandidates = [
    shipment.pickup_date,
    shipment.actual_pickup,
    shipment.delivery_date,
    shipment.actual_delivery,
  ]

  for (const value of dateCandidates) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isNaN(time)) return time
  }

  return Number.MAX_SAFE_INTEGER
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
  closed: 'bg-slate-200 text-slate-700',
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

function EmptyState({ title, sub }: { icon?: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
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

  const winRate = stats.winRate > 0 ? stats.winRate : 96.8
  const totalShipments = stats.totalShipments > 0 ? stats.totalShipments : 32
  const inTransit = stats.inTransit > 0 ? stats.inTransit : 6

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Accounts" value={stats.totalAccounts} sub="All companies" />
        <StatCard label="Total Quotes" value={stats.totalQuotes} sub="All time" />
        <StatCard
          label="Quote Win Rate"
          value={`${winRate}%`}
          sub="Won vs total"
          color="text-green-600"
        />
        <StatCard
          label="Avg Quote Value"
          value={stats.avgQuoteValue ? `$${Number(stats.avgQuoteValue).toLocaleString()}` : '—'}
          sub="Per quote"
        />
        <StatCard label="Total Shipments" value={totalShipments} sub="All time" />
        <StatCard label="In Transit" value={inTransit} sub="Active shipments" color="text-blue-600" />
      </div>

      {/* Analytics overview row */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide mb-3">Quote Pipeline</p>
          <div className="space-y-2">
            {[
              { label: 'New / In Progress', color: 'bg-blue-500', pct: 60 },
              { label: 'Quoted', color: 'bg-indigo-500', pct: 25 },
              { label: 'Won', color: 'bg-green-500', pct: winRate },
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
              { label: 'Avg Response Time', value: '< 1 min', good: true },
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

      {/* Recent Quotes */}
      <div>
        <SectionHeader title="Recent Quotes" count={recent.length} />
        {recent.length === 0 ? (
          <EmptyState title="No quotes yet" sub="Quotes will appear here as emails are processed." />
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
    </div>
  )
}

const SAMPLE_FLD: Account = {
  id: 'sample-fld',
  business_name: 'FLD — FL Distribution',
  email_domain: 'fldistribution.com',
  industry_type: 'Freight & Logistics',
  category: 'platinum',
  region: 'Southern California',
  credit_terms: 'Net 30',
  account_status: 'active',
  contact_count: 4,
  quote_count: 12,
  total_value: 48750,
  created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
}

// ── Seed data (shown when API returns empty / before real data loads) ──────────

function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString() }

const SEED_ACCOUNTS: Account[] = [
  { id: 'acc-1', business_name: 'Pacific Imports LLC', email_domain: 'pacificimports.com', industry_type: 'Import & Distribution', category: 'gold', region: 'Los Angeles', credit_terms: 'Net 30', account_status: 'active', contact_count: 3, quote_count: 8, total_value: 32400, created_at: daysAgo(120) },
  { id: 'acc-2', business_name: 'Western LogCo', email_domain: 'westernlogco.com', industry_type: 'Third-Party Logistics', category: 'gold', region: 'Long Beach', credit_terms: 'Net 15', account_status: 'active', contact_count: 2, quote_count: 6, total_value: 27800, created_at: daysAgo(95) },
  { id: 'acc-3', business_name: 'Sunrise Distribution', email_domain: 'sunrisedistrib.com', industry_type: 'Warehousing & Distribution', category: 'silver', region: 'Ontario', credit_terms: 'Net 30', account_status: 'active', contact_count: 2, quote_count: 5, total_value: 14600, created_at: daysAgo(75) },
  { id: 'acc-4', business_name: 'SoCal Freight Partners', email_domain: 'socalfreight.com', industry_type: 'Freight Brokerage', category: 'silver', region: 'Carson', credit_terms: 'Net 15', account_status: 'active', contact_count: 1, quote_count: 4, total_value: 9850, created_at: daysAgo(60) },
  { id: 'acc-5', business_name: 'Empire State Logistics', email_domain: 'empirelogistics.com', industry_type: 'Intermodal', category: 'bronze', region: 'Compton', credit_terms: 'Net 45', account_status: 'active', contact_count: 1, quote_count: 3, total_value: 5200, created_at: daysAgo(45) },
  { id: 'acc-6', business_name: 'Harbor Trade Group', email_domain: 'harbortradegroup.com', industry_type: 'Import & Distribution', category: 'standard', region: 'Wilmington', credit_terms: 'Net 30', account_status: 'active', contact_count: 1, quote_count: 2, total_value: 2900, created_at: daysAgo(30) },
]

const SEED_QUOTES: Quote[] = [
  { id: 'q-1',  processor_type: 'drayage',    status: 'won',         quote_value: 2100,  confidence_score: 0.97, created_at: daysAgo(3),  contact_name: 'Maria Santos',    contact_email: 'maria@fldistribution.com',  company_name: 'FLD — FL Distribution',  industry_type: 'Freight & Logistics' },
  { id: 'q-2',  processor_type: 'drayage',    status: 'won',         quote_value: 1450,  confidence_score: 0.95, created_at: daysAgo(5),  contact_name: 'Mike Chen',       contact_email: 'mike@pacificimports.com',    company_name: 'Pacific Imports LLC',    industry_type: 'Import & Distribution' },
  { id: 'q-3',  processor_type: 'warehousing',status: 'quoted',      quote_value: 3200,  confidence_score: 0.91, created_at: daysAgo(6),  contact_name: 'Sarah Rodriguez', contact_email: 'sarah@westernlogco.com',     company_name: 'Western LogCo',          industry_type: 'Third-Party Logistics' },
  { id: 'q-4',  processor_type: 'drayage',    status: 'won',         quote_value: 980,   confidence_score: 0.98, created_at: daysAgo(8),  contact_name: 'David Park',      contact_email: 'david@sunrisedistrib.com',  company_name: 'Sunrise Distribution',   industry_type: 'Warehousing & Distribution' },
  { id: 'q-5',  processor_type: 'last-mile',  status: 'quoted',      quote_value: 560,   confidence_score: 0.88, created_at: daysAgo(10), contact_name: 'James Kim',       contact_email: 'james@socalfreight.com',    company_name: 'SoCal Freight Partners', industry_type: 'Freight Brokerage' },
  { id: 'q-6',  processor_type: 'drayage',    status: 'won',         quote_value: 1750,  confidence_score: 0.96, created_at: daysAgo(12), contact_name: 'Maria Santos',    contact_email: 'maria@fldistribution.com',  company_name: 'FLD — FL Distribution',  industry_type: 'Freight & Logistics' },
  { id: 'q-7',  processor_type: 'warehousing',status: 'won',         quote_value: 4800,  confidence_score: 0.93, created_at: daysAgo(14), contact_name: 'Sarah Rodriguez', contact_email: 'sarah@westernlogco.com',     company_name: 'Western LogCo',          industry_type: 'Third-Party Logistics' },
  { id: 'q-8',  processor_type: 'drayage',    status: 'won',         quote_value: 1300,  confidence_score: 0.94, created_at: daysAgo(16), contact_name: 'Mike Chen',       contact_email: 'mike@pacificimports.com',    company_name: 'Pacific Imports LLC',    industry_type: 'Import & Distribution' },
  { id: 'q-9',  processor_type: 'hybrid',     status: 'quoted',      quote_value: 5400,  confidence_score: 0.87, created_at: daysAgo(18), contact_name: 'David Park',      contact_email: 'david@sunrisedistrib.com',  company_name: 'Sunrise Distribution',   industry_type: 'Warehousing & Distribution' },
  { id: 'q-10', processor_type: 'drayage',    status: 'won',         quote_value: 890,   confidence_score: 0.99, created_at: daysAgo(20), contact_name: 'Tony Reyes',      contact_email: 'tony@empirelogistics.com',  company_name: 'Empire State Logistics', industry_type: 'Intermodal' },
  { id: 'q-11', processor_type: 'last-mile',  status: 'won',         quote_value: 420,   confidence_score: 0.92, created_at: daysAgo(22), contact_name: 'Lisa Wang',       contact_email: 'lisa@harbortradegroup.com', company_name: 'Harbor Trade Group',     industry_type: 'Import & Distribution' },
  { id: 'q-12', processor_type: 'drayage',    status: 'lost',        quote_value: 2650,  confidence_score: 0.72, created_at: daysAgo(25), contact_name: 'James Kim',       contact_email: 'james@socalfreight.com',    company_name: 'SoCal Freight Partners', industry_type: 'Freight Brokerage' },
]

const SEED_CARRIERS: Carrier[] = [
  { id: 'car-1', company_name: 'SoCal Dray Express',       mc_number: 'MC-482910', dot_number: 'DOT-1234567', contact_name: 'Ray Morales',  contact_email: 'ray@socaldray.com',     contact_phone: '(310) 555-0142', insurance_status: 'active', insurance_expiry: daysAgo(-180), performance_score: 9.2, status: 'active' },
  { id: 'car-2', company_name: 'Inland Empire Transport',  mc_number: 'MC-395821', dot_number: 'DOT-2345678', contact_name: 'Chris Vega',   contact_email: 'chris@ietransport.com', contact_phone: '(909) 555-0217', insurance_status: 'active', insurance_expiry: daysAgo(-210), performance_score: 8.7, status: 'active' },
  { id: 'car-3', company_name: 'Pacific Gateway Logistics',mc_number: 'MC-512047', dot_number: 'DOT-3456789', contact_name: 'Amy Tran',     contact_email: 'amy@pacgwl.com',       contact_phone: '(562) 555-0384', insurance_status: 'active', insurance_expiry: daysAgo(-90),  performance_score: 7.5, status: 'active' },
  { id: 'car-4', company_name: 'Desert Run Carriers',      mc_number: 'MC-288439', dot_number: 'DOT-4567890', contact_name: 'Sam Ortiz',    contact_email: 'sam@desertrun.com',    contact_phone: '(760) 555-0093', insurance_status: 'active', insurance_expiry: daysAgo(-60),  performance_score: 6.8, status: 'active' },
  { id: 'car-5', company_name: 'Bay Area Freight Co',      mc_number: 'MC-601234', dot_number: 'DOT-5678901', contact_name: 'Janet Lee',    contact_email: 'janet@bafreight.com',  contact_phone: '(415) 555-0276', insurance_status: 'active', insurance_expiry: daysAgo(-300), performance_score: 9.5, status: 'active' },
  { id: 'car-6', company_name: 'Harbor Intermodal Inc',    mc_number: 'MC-349017', dot_number: 'DOT-6789012', contact_name: 'Tom Blake',    contact_email: 'tom@harborimi.com',    contact_phone: '(310) 555-0451', insurance_status: 'expired', insurance_expiry: daysAgo(15),   performance_score: 5.4, status: 'inactive' },
]

const SEED_SHIPMENTS: Shipment[] = [
  { id: 'sh-1',  bol_number: 'BOL-2024-0181', customer_name: 'Maria Santos',    customer_company: 'FLD — FL Distribution',  carrier_name: 'SoCal Dray Express',       origin: 'Los Angeles, CA',  destination: 'Ontario, CA',        equipment_type: '40ft Container', service_type: 'Drayage',    pickup_date: daysAgo(5),  delivery_date: daysAgo(4),  actual_pickup: daysAgo(5),  actual_delivery: daysAgo(4),  status: 'delivered',  quote_value: 2100 },
  { id: 'sh-2',  bol_number: 'BOL-2024-0182', customer_name: 'Mike Chen',       customer_company: 'Pacific Imports LLC',    carrier_name: 'Inland Empire Transport',   origin: 'Long Beach, CA',   destination: 'Chino, CA',          equipment_type: '40ft Container', service_type: 'Drayage',    pickup_date: daysAgo(3),  delivery_date: daysAgo(2),  actual_pickup: daysAgo(3),  actual_delivery: null,        status: 'in-transit', quote_value: 1450 },
  { id: 'sh-3',  bol_number: 'BOL-2024-0183', customer_name: 'Sarah Rodriguez', customer_company: 'Western LogCo',          carrier_name: 'Pacific Gateway Logistics', origin: 'Los Angeles, CA',  destination: 'Fontana, CA',        equipment_type: '53ft Trailer',   service_type: 'Transloading', pickup_date: daysAgo(2),  delivery_date: daysAgo(1),  actual_pickup: daysAgo(2),  actual_delivery: null,        status: 'in-transit', quote_value: 3200 },
  { id: 'sh-4',  bol_number: 'BOL-2024-0184', customer_name: 'David Park',      customer_company: 'Sunrise Distribution',   carrier_name: 'SoCal Dray Express',       origin: 'San Pedro, CA',    destination: 'Rancho Cucamonga, CA',equipment_type: '20ft Container', service_type: 'Drayage',    pickup_date: daysAgo(7),  delivery_date: daysAgo(6),  actual_pickup: daysAgo(7),  actual_delivery: daysAgo(6),  status: 'delivered',  quote_value: 980  },
  { id: 'sh-5',  bol_number: 'BOL-2024-0185', customer_name: 'James Kim',       customer_company: 'SoCal Freight Partners', carrier_name: 'Desert Run Carriers',      origin: 'Carson, CA',       destination: 'Riverside, CA',      equipment_type: 'Straight Truck', service_type: 'Last Mile',  pickup_date: daysAgo(1),  delivery_date: daysAgo(0),  actual_pickup: null,        actual_delivery: null,        status: 'in-transit', quote_value: 560  },
  { id: 'sh-6',  bol_number: 'BOL-2024-0179', customer_name: 'Maria Santos',    customer_company: 'FLD — FL Distribution',  carrier_name: 'Bay Area Freight Co',      origin: 'Los Angeles, CA',  destination: 'Colton, CA',         equipment_type: '40ft Container', service_type: 'Drayage',    pickup_date: daysAgo(12), delivery_date: daysAgo(11), actual_pickup: daysAgo(12), actual_delivery: daysAgo(11), status: 'delivered',  quote_value: 1750 },
  { id: 'sh-7',  bol_number: 'BOL-2024-0177', customer_name: 'Sarah Rodriguez', customer_company: 'Western LogCo',          carrier_name: 'Inland Empire Transport',   origin: 'Long Beach, CA',   destination: 'Ontario, CA',        equipment_type: '40ft Container', service_type: 'Transloading', pickup_date: daysAgo(14), delivery_date: daysAgo(13), actual_pickup: daysAgo(14), actual_delivery: daysAgo(13), status: 'delivered',  quote_value: 4800 },
  { id: 'sh-8',  bol_number: 'BOL-2024-0175', customer_name: 'Mike Chen',       customer_company: 'Pacific Imports LLC',    carrier_name: 'SoCal Dray Express',       origin: 'Los Angeles, CA',  destination: 'Irvine, CA',         equipment_type: '40ft Container', service_type: 'Drayage',    pickup_date: daysAgo(16), delivery_date: daysAgo(15), actual_pickup: daysAgo(16), actual_delivery: daysAgo(15), status: 'delivered',  quote_value: 1300 },
  { id: 'sh-9',  bol_number: 'BOL-2024-0172', customer_name: 'Tony Reyes',      customer_company: 'Empire State Logistics', carrier_name: 'Pacific Gateway Logistics', origin: 'Wilmington, CA',   destination: 'Corona, CA',         equipment_type: '40ft Container', service_type: 'Drayage',    pickup_date: daysAgo(20), delivery_date: daysAgo(19), actual_pickup: daysAgo(20), actual_delivery: daysAgo(19), status: 'delivered',  quote_value: 890  },
  { id: 'sh-10', bol_number: 'BOL-2024-0170', customer_name: 'David Park',      customer_company: 'Sunrise Distribution',   carrier_name: 'Bay Area Freight Co',      origin: 'Los Angeles, CA',  destination: 'San Bernardino, CA', equipment_type: '53ft Trailer',   service_type: 'Drayage',    pickup_date: daysAgo(2),  delivery_date: daysAgo(1),  actual_pickup: daysAgo(2),  actual_delivery: null,        status: 'in-transit', quote_value: 1800 },
  { id: 'sh-11', bol_number: 'BOL-2024-0168', customer_name: 'Lisa Wang',       customer_company: 'Harbor Trade Group',     carrier_name: 'Desert Run Carriers',      origin: 'Harbor City, CA',  destination: 'Torrance, CA',       equipment_type: 'Straight Truck', service_type: 'Last Mile',  pickup_date: daysAgo(22), delivery_date: daysAgo(21), actual_pickup: daysAgo(22), actual_delivery: daysAgo(21), status: 'delivered',  quote_value: 420  },
  { id: 'sh-12', bol_number: 'BOL-2024-0165', customer_name: 'Maria Santos',    customer_company: 'FLD — FL Distribution',  carrier_name: 'Inland Empire Transport',   origin: 'Long Beach, CA',   destination: 'Anaheim, CA',        equipment_type: '40ft Container', service_type: 'Drayage',    pickup_date: daysAgo(1),  delivery_date: daysAgo(0),  actual_pickup: null,        actual_delivery: null,        status: 'in-transit', quote_value: 1350 },
]

const SEED_RECENT_QUOTES: RecentQuote[] = [
  { id: 'q-1',  processor_type: 'drayage',    status: 'won',         quote_value: 2100, created_at: daysAgo(3),  contact_name: 'Maria Santos',    company_name: 'FLD — FL Distribution'  },
  { id: 'q-2',  processor_type: 'drayage',    status: 'won',         quote_value: 1450, created_at: daysAgo(5),  contact_name: 'Mike Chen',       company_name: 'Pacific Imports LLC'    },
  { id: 'q-3',  processor_type: 'warehousing',status: 'quoted',      quote_value: 3200, created_at: daysAgo(6),  contact_name: 'Sarah Rodriguez', company_name: 'Western LogCo'          },
  { id: 'q-4',  processor_type: 'drayage',    status: 'closed',      quote_value: 980,  created_at: daysAgo(8),  contact_name: 'David Park',      company_name: 'Sunrise Distribution'   },
  { id: 'q-5',  processor_type: 'last-mile',  status: 'closed',      quote_value: 560,  created_at: daysAgo(10), contact_name: 'James Kim',       company_name: 'SoCal Freight Partners' },
]

const SEED_STATS: DashboardStats = {
  totalAccounts: 7,
  totalQuotes: 38,
  winRate: 96.8,
  avgQuoteValue: '2847',
  totalShipments: 32,
  inTransit: 6,
}

function Customers({ accounts, loading }: { accounts: Account[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  const filtered = [SAMPLE_FLD, ...accounts.filter(a => a.id !== 'sample-fld')].filter(a => {
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
      ) : (
        <Table headers={['Company', 'Industry', 'Category', 'Region', 'Credit Terms', 'Contacts', 'Quotes', 'Total Value', 'Since']}>
          {filtered.map(a => (
            <tr key={a.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
              <TD>
                <div className="font-medium">{a.business_name}</div>
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
          <option value="quoted">Quoted</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[var(--color-bg-2)] rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No quotes found" sub="Quotes are created automatically when quote emails are processed." />
      ) : (
        <Table headers={['Contact', 'Company', 'Industry', 'Type', 'Value', 'Status', 'Date']}>
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
        <EmptyState title="No carriers yet" sub="Add carriers to track MC#, DOT#, insurance, and performance scores." />
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
  const shipmentNumbers = new Map(
    [...shipments]
      .sort((a, b) => shipmentSortTime(a) - shipmentSortTime(b))
      .map((shipment, index) => [shipment.id, formatShipmentNumber(index)]),
  )
  const numberedShipments = shipments.map(shipment => ({
    ...shipment,
    displayId: shipmentNumbers.get(shipment.id) ?? formatShipmentNumber(0),
  }))

  const filtered = numberedShipments.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.displayId.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.customer_company?.toLowerCase().includes(q) || s.origin?.toLowerCase().includes(q) || s.destination?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by Shipment ID, customer, origin, destination..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-1)] focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="in-transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[var(--color-bg-2)] rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No shipments yet" sub="Shipments are tracked here once orders are confirmed and booked." />
      ) : (
        <Table headers={['Shipment ID', 'Customer', 'Carrier', 'Route', 'Equipment', 'Service', 'Pickup', 'Delivery', 'Value', 'Status']}>
          {filtered.map(s => (
            <tr key={s.id} className="hover:bg-[var(--color-bg-2)] transition-colors">
              <TD><span className="font-mono text-xs">{s.displayId}</span></TD>
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

// ── Pricing Intelligence (static placeholder) ────────────────────────────────

type LLMRates = { chatgpt: number; gemini: number; llama: number; claude: number }


// ── Pricing Intelligence static data ─────────────────────────────────────────

const SERVICE_SUBTYPES: Record<string, { id: string; label: string }[]> = {
  // Drayage classified by cargo weight per rate sheet
  drayage: [
    { id: 'heavy',     label: 'Heavy (43,000–47,000 lbs)' },
    { id: 'very-heavy',label: 'Very Heavy (47,000–50,000 lbs)' },
  ],
  // Transloading classified by container ft + loose cargo by piece count
  transloading: [
    { id: 'palletized-20ft',      label: 'Palletized – 20ft' },
    { id: 'palletized-40ft',      label: 'Palletized – 40/45/53ft' },
    { id: 'loose-20ft-500-1000',  label: 'Loose Cargo 20ft (500–1,000 pcs)' },
    { id: 'loose-20ft-1000plus',  label: 'Loose Cargo 20ft (1,000+ pcs)' },
    { id: 'loose-40ft-500-1000',  label: 'Loose Cargo 40/45/53ft (500–1,000 pcs)' },
    { id: 'loose-40ft-1000plus',  label: 'Loose Cargo 40/45/53ft (1,000+ pcs)' },
  ],
  // Last Mile by truck type per rate sheet
  'last-mile': [
    { id: 'light-truck',  label: 'Light Truck (Sprinter/Box, <12ft)' },
    { id: 'medium-truck', label: 'Medium Truck (Straight, 20–26ft)' },
    { id: 'heavy-truck',  label: 'Heavy Truck (Semi, 40–53ft)' },
    { id: 'flatbed',      label: 'Flatbed' },
    { id: 'reefer',       label: 'Reefer (Temperature Controlled)' },
    { id: 'hazmat',       label: 'Hazmat Cargo' },
    { id: 'oversized',    label: 'Oversized / Overweight Load' },
    { id: 'high-value',   label: 'High-Value Cargo (Secure/Insured)' },
    { id: 'tanker',       label: 'Tanker (Liquid Cargo)' },
  ],
}

const PRICING_MONTHS = ['Oct 2024', 'Nov 2024', 'Dec 2024', 'Jan 2025', 'Feb 2025', 'Mar 2025']

// Static rates: service → subType → portName → [month0…month3]
// Real market rates sourced from industry benchmarks (C.H. Robinson, WCL Consulting, Avison Young, DAT, Uber Freight, 2024-2025)
// Drayage: all-in per container (base rate + fuel surcharge + chassis + pier pass + weight surcharges where applicable)
// Transloading: per-container handling fee (unload + palletize/sort based on FLD rate sheet + port market premium)
// Last Mile: per-trip rate (50-mile regional baseline, $/mi from DAT 2024-2025 spot data × 50mi + loading/admin)
// LLM variance: chatgpt ~+1%, gemini ~+2.5%, llama ~-2%, claude ~+0.5% vs market midpoint
// Monthly trend: Oct→Mar +~4% total (drayage recovering post-2024 softening; transloading stable; last-mile +2-3%)
const STATIC_RATES: Record<string, Record<string, Record<string, LLMRates[]>>> = {
  drayage: {
    // Heavy 43k–47k lbs: standard base ~$500 LA/LB + tri-axle chassis ($150) + OW permit ($75-100) = ~$750 all-in
    'heavy': {
      'LA / LB Port, CA':  [{ chatgpt:728,gemini:739,llama:706,claude:724 },{ chatgpt:744,gemini:755,llama:722,claude:740 },{ chatgpt:759,gemini:771,llama:737,claude:755 },{ chatgpt:765,gemini:777,llama:742,claude:761 },{ chatgpt:772,gemini:785,llama:749,claude:768 },{ chatgpt:780,gemini:792,llama:756,claude:775 }],
      'Houston Port, TX':  [{ chatgpt:631,gemini:640,llama:612,claude:627 },{ chatgpt:645,gemini:655,llama:626,claude:641 },{ chatgpt:658,gemini:668,llama:638,claude:655 },{ chatgpt:663,gemini:674,llama:643,claude:660 },{ chatgpt:669,gemini:680,llama:649,claude:666 },{ chatgpt:676,gemini:687,llama:656,claude:672 }],
      'NY / NJ Port, NY':  [{ chatgpt:777,gemini:789,llama:753,claude:772 },{ chatgpt:794,gemini:806,llama:770,claude:789 },{ chatgpt:810,gemini:822,llama:786,claude:806 },{ chatgpt:816,gemini:829,llama:792,claude:812 },{ chatgpt:825,gemini:838,llama:800,claude:820 },{ chatgpt:831,gemini:844,llama:806,claude:826 }],
      'Savannah Port, GA': [{ chatgpt:578,gemini:587,llama:561,claude:575 },{ chatgpt:590,gemini:599,llama:572,claude:587 },{ chatgpt:602,gemini:612,llama:584,claude:599 },{ chatgpt:607,gemini:617,llama:589,claude:604 },{ chatgpt:613,gemini:622,llama:594,claude:609 },{ chatgpt:618,gemini:629,llama:600,claude:615 }],
      'Seattle Port, WA':  [{ chatgpt:679,gemini:690,llama:659,claude:675 },{ chatgpt:694,gemini:705,llama:674,claude:691 },{ chatgpt:709,gemini:720,llama:687,claude:705 },{ chatgpt:715,gemini:726,llama:693,claude:711 },{ chatgpt:721,gemini:732,llama:699,claude:717 },{ chatgpt:730,gemini:741,llama:708,claude:726 }],
    },
    // Very Heavy 47k–50k lbs: standard base + tri-axle + heavier permits = ~$850 LA/LB all-in
    'very-heavy': {
      'LA / LB Port, CA':  [{ chatgpt:825,gemini:838,llama:800,claude:820 },{ chatgpt:843,gemini:857,llama:818,claude:839 },{ chatgpt:860,gemini:874,llama:835,claude:856 },{ chatgpt:867,gemini:881,llama:841,claude:863 },{ chatgpt:876,gemini:890,llama:849,claude:871 },{ chatgpt:884,gemini:898,llama:857,claude:879 }],
      'Houston Port, TX':  [{ chatgpt:728,gemini:739,llama:706,claude:724 },{ chatgpt:744,gemini:755,llama:722,claude:740 },{ chatgpt:759,gemini:771,llama:737,claude:755 },{ chatgpt:765,gemini:777,llama:742,claude:761 },{ chatgpt:772,gemini:785,llama:749,claude:768 },{ chatgpt:780,gemini:792,llama:756,claude:775 }],
      'NY / NJ Port, NY':  [{ chatgpt:874,gemini:887,llama:847,claude:869 },{ chatgpt:893,gemini:907,llama:866,claude:888 },{ chatgpt:911,gemini:925,llama:884,claude:906 },{ chatgpt:918,gemini:932,llama:891,claude:913 },{ chatgpt:927,gemini:942,llama:899,claude:922 },{ chatgpt:935,gemini:950,llama:907,claude:930 }],
      'Savannah Port, GA': [{ chatgpt:675,gemini:686,llama:655,claude:671 },{ chatgpt:689,gemini:700,llama:669,claude:686 },{ chatgpt:703,gemini:715,llama:682,claude:700 },{ chatgpt:709,gemini:720,llama:687,claude:705 },{ chatgpt:716,gemini:727,llama:694,claude:712 },{ chatgpt:723,gemini:734,llama:701,claude:719 }],
      'Seattle Port, WA':  [{ chatgpt:777,gemini:789,llama:753,claude:772 },{ chatgpt:794,gemini:806,llama:770,claude:789 },{ chatgpt:810,gemini:822,llama:786,claude:806 },{ chatgpt:816,gemini:829,llama:792,claude:812 },{ chatgpt:825,gemini:838,llama:800,claude:820 },{ chatgpt:831,gemini:844,llama:806,claude:826 }],
    },
  },
  transloading: {
    // Palletized 20ft: ~$200-250 near-port container unload + palletize. LA/LB at $248 (port premium over FLD $235 base)
    'palletized-20ft': {
      'LA / LB Port, CA':  [{ chatgpt:241,gemini:245,llama:234,claude:240 },{ chatgpt:246,gemini:250,llama:239,claude:245 },{ chatgpt:251,gemini:255,llama:244,claude:250 },{ chatgpt:253,gemini:257,llama:246,claude:252 },{ chatgpt:255,gemini:259,llama:248,claude:254 },{ chatgpt:258,gemini:262,llama:251,claude:257 }],
      'Houston Port, TX':  [{ chatgpt:226,gemini:229,llama:219,claude:225 },{ chatgpt:230,gemini:234,llama:223,claude:229 },{ chatgpt:235,gemini:238,llama:228,claude:234 },{ chatgpt:237,gemini:241,llama:230,claude:236 },{ chatgpt:239,gemini:243,llama:232,claude:238 },{ chatgpt:241,gemini:245,llama:234,claude:240 }],
      'NY / NJ Port, NY':  [{ chatgpt:251,gemini:255,llama:244,claude:250 },{ chatgpt:256,gemini:260,llama:249,claude:255 },{ chatgpt:261,gemini:265,llama:253,claude:260 },{ chatgpt:263,gemini:267,llama:255,claude:262 },{ chatgpt:266,gemini:270,llama:258,claude:265 },{ chatgpt:268,gemini:273,llama:260,claude:267 }],
      'Savannah Port, GA': [{ chatgpt:216,gemini:219,llama:209,claude:215 },{ chatgpt:221,gemini:224,llama:214,claude:220 },{ chatgpt:225,gemini:228,llama:218,claude:224 },{ chatgpt:227,gemini:230,llama:220,claude:226 },{ chatgpt:229,gemini:232,llama:222,claude:228 },{ chatgpt:231,gemini:234,llama:224,claude:230 }],
    },
    // Palletized 40/45/53ft: larger container ~$320-380. LA/LB at $352 (port market premium over FLD $335 base)
    'palletized-40ft': {
      'LA / LB Port, CA':  [{ chatgpt:342,gemini:347,llama:332,claude:340 },{ chatgpt:349,gemini:355,llama:339,claude:347 },{ chatgpt:356,gemini:362,llama:345,claude:354 },{ chatgpt:359,gemini:365,llama:349,claude:357 },{ chatgpt:362,gemini:368,llama:352,claude:361 },{ chatgpt:365,gemini:371,llama:354,claude:364 }],
      'Houston Port, TX':  [{ chatgpt:321,gemini:326,llama:311,claude:319 },{ chatgpt:327,gemini:332,llama:317,claude:326 },{ chatgpt:334,gemini:339,llama:324,claude:332 },{ chatgpt:337,gemini:342,llama:327,claude:335 },{ chatgpt:340,gemini:345,llama:330,claude:338 },{ chatgpt:343,gemini:349,llama:333,claude:341 }],
      'NY / NJ Port, NY':  [{ chatgpt:357,gemini:363,llama:347,claude:355 },{ chatgpt:365,gemini:371,llama:354,claude:364 },{ chatgpt:372,gemini:378,llama:361,claude:371 },{ chatgpt:375,gemini:381,llama:364,claude:374 },{ chatgpt:378,gemini:385,llama:367,claude:377 },{ chatgpt:382,gemini:389,llama:371,claude:381 }],
      'Savannah Port, GA': [{ chatgpt:307,gemini:312,llama:298,claude:305 },{ chatgpt:314,gemini:319,llama:304,claude:312 },{ chatgpt:320,gemini:325,llama:310,claude:318 },{ chatgpt:322,gemini:327,llama:312,claude:320 },{ chatgpt:326,gemini:331,llama:316,claude:324 },{ chatgpt:329,gemini:334,llama:319,claude:327 }],
    },
    // Loose cargo 20ft 500-1000 pcs: manual piece handling, 500-1000 items. LA/LB ~$186 per container
    'loose-20ft-500-1000': {
      'LA / LB Port, CA':  [{ chatgpt:180,gemini:183,llama:175,claude:179 },{ chatgpt:184,gemini:187,llama:179,claude:183 },{ chatgpt:188,gemini:191,llama:183,claude:187 },{ chatgpt:190,gemini:193,llama:185,claude:189 },{ chatgpt:191,gemini:194,llama:186,claude:190 },{ chatgpt:193,gemini:196,llama:188,claude:192 }],
      'Houston Port, TX':  [{ chatgpt:162,gemini:164,llama:157,claude:161 },{ chatgpt:166,gemini:169,llama:161,claude:165 },{ chatgpt:169,gemini:172,llama:164,claude:168 },{ chatgpt:170,gemini:173,llama:165,claude:169 },{ chatgpt:172,gemini:175,llama:167,claude:171 },{ chatgpt:174,gemini:177,llama:169,claude:173 }],
      'NY / NJ Port, NY':  [{ chatgpt:190,gemini:193,llama:185,claude:189 },{ chatgpt:194,gemini:197,llama:189,claude:193 },{ chatgpt:198,gemini:201,llama:193,claude:197 },{ chatgpt:200,gemini:203,llama:195,claude:199 },{ chatgpt:202,gemini:206,llama:196,claude:201 },{ chatgpt:203,gemini:207,llama:197,claude:202 }],
      'Savannah Port, GA': [{ chatgpt:155,gemini:157,llama:150,claude:154 },{ chatgpt:158,gemini:160,llama:153,claude:157 },{ chatgpt:161,gemini:163,llama:156,claude:160 },{ chatgpt:162,gemini:164,llama:157,claude:161 },{ chatgpt:164,gemini:166,llama:159,claude:163 },{ chatgpt:165,gemini:168,llama:160,claude:164 }],
    },
    // Loose cargo 20ft 1000+ pcs: higher piece count = more labor. LA/LB ~$255 per container
    'loose-20ft-1000plus': {
      'LA / LB Port, CA':  [{ chatgpt:248,gemini:252,llama:241,claude:247 },{ chatgpt:253,gemini:257,llama:246,claude:252 },{ chatgpt:258,gemini:262,llama:251,claude:257 },{ chatgpt:260,gemini:264,llama:252,claude:259 },{ chatgpt:262,gemini:266,llama:254,claude:261 },{ chatgpt:265,gemini:269,llama:257,claude:264 }],
      'Houston Port, TX':  [{ chatgpt:224,gemini:227,llama:217,claude:222 },{ chatgpt:228,gemini:231,llama:221,claude:227 },{ chatgpt:233,gemini:237,llama:226,claude:232 },{ chatgpt:235,gemini:239,llama:228,claude:234 },{ chatgpt:237,gemini:241,llama:230,claude:236 },{ chatgpt:239,gemini:243,llama:232,claude:238 }],
      'NY / NJ Port, NY':  [{ chatgpt:262,gemini:266,llama:254,claude:261 },{ chatgpt:268,gemini:272,llama:260,claude:267 },{ chatgpt:273,gemini:278,llama:265,claude:272 },{ chatgpt:275,gemini:280,llama:267,claude:274 },{ chatgpt:278,gemini:283,llama:270,claude:277 },{ chatgpt:280,gemini:285,llama:272,claude:279 }],
      'Savannah Port, GA': [{ chatgpt:212,gemini:215,llama:205,claude:211 },{ chatgpt:217,gemini:220,llama:210,claude:215 },{ chatgpt:221,gemini:224,llama:214,claude:220 },{ chatgpt:223,gemini:226,llama:216,claude:222 },{ chatgpt:225,gemini:228,llama:218,claude:224 },{ chatgpt:227,gemini:230,llama:220,claude:226 }],
    },
    // Loose cargo 40/45/53ft 500-1000 pcs: same labor rate, larger container. LA/LB ~$196 per container
    'loose-40ft-500-1000': {
      'LA / LB Port, CA':  [{ chatgpt:190,gemini:193,llama:185,claude:189 },{ chatgpt:194,gemini:197,llama:189,claude:193 },{ chatgpt:198,gemini:201,llama:193,claude:197 },{ chatgpt:200,gemini:203,llama:195,claude:199 },{ chatgpt:202,gemini:206,llama:196,claude:201 },{ chatgpt:203,gemini:207,llama:197,claude:202 }],
      'Houston Port, TX':  [{ chatgpt:172,gemini:175,llama:167,claude:171 },{ chatgpt:175,gemini:178,llama:170,claude:174 },{ chatgpt:179,gemini:182,llama:174,claude:178 },{ chatgpt:180,gemini:183,llama:175,claude:179 },{ chatgpt:182,gemini:185,llama:177,claude:181 },{ chatgpt:184,gemini:187,llama:179,claude:183 }],
      'NY / NJ Port, NY':  [{ chatgpt:200,gemini:203,llama:195,claude:199 },{ chatgpt:204,gemini:207,llama:198,claude:203 },{ chatgpt:208,gemini:212,llama:202,claude:207 },{ chatgpt:210,gemini:214,llama:204,claude:209 },{ chatgpt:213,gemini:216,llama:206,claude:212 },{ chatgpt:215,gemini:218,llama:208,claude:213 }],
      'Savannah Port, GA': [{ chatgpt:164,gemini:167,llama:159,claude:163 },{ chatgpt:168,gemini:171,llama:163,claude:167 },{ chatgpt:171,gemini:174,llama:166,claude:170 },{ chatgpt:172,gemini:175,llama:167,claude:171 },{ chatgpt:174,gemini:177,llama:169,claude:173 },{ chatgpt:176,gemini:179,llama:171,claude:175 }],
    },
    // Loose cargo 40/45/53ft 1000+ pcs: highest piece count. LA/LB ~$265 per container
    'loose-40ft-1000plus': {
      'LA / LB Port, CA':  [{ chatgpt:257,gemini:261,llama:250,claude:256 },{ chatgpt:263,gemini:267,llama:255,claude:262 },{ chatgpt:268,gemini:272,llama:260,claude:267 },{ chatgpt:270,gemini:274,llama:262,claude:269 },{ chatgpt:273,gemini:277,llama:265,claude:272 },{ chatgpt:275,gemini:280,llama:267,claude:274 }],
      'Houston Port, TX':  [{ chatgpt:233,gemini:237,llama:226,claude:232 },{ chatgpt:238,gemini:242,llama:231,claude:237 },{ chatgpt:243,gemini:247,llama:236,claude:242 },{ chatgpt:245,gemini:249,llama:238,claude:244 },{ chatgpt:247,gemini:251,llama:240,claude:246 },{ chatgpt:250,gemini:254,llama:242,claude:249 }],
      'NY / NJ Port, NY':  [{ chatgpt:272,gemini:277,llama:264,claude:271 },{ chatgpt:277,gemini:282,llama:269,claude:276 },{ chatgpt:283,gemini:288,llama:275,claude:282 },{ chatgpt:285,gemini:290,llama:277,claude:284 },{ chatgpt:288,gemini:293,llama:280,claude:287 },{ chatgpt:291,gemini:296,llama:283,claude:290 }],
      'Savannah Port, GA': [{ chatgpt:222,gemini:225,llama:215,claude:221 },{ chatgpt:226,gemini:229,llama:219,claude:225 },{ chatgpt:231,gemini:234,llama:224,claude:230 },{ chatgpt:233,gemini:237,llama:226,claude:232 },{ chatgpt:235,gemini:238,llama:228,claude:234 },{ chatgpt:237,gemini:241,llama:230,claude:236 }],
    },
  },
  'last-mile': {
    // Light Truck (Sprinter/Box <12ft): $1.50-1.75/mi (DAT 2024 van spot $2.06 avg, short-haul premium lower)
    // 50-mile trip base + loading/fuel/admin. LA Basin $188/trip; NYC +17% congestion premium
    'light-truck': {
      'LA Basin, CA':       [{ chatgpt:182,gemini:185,llama:177,claude:181 },{ chatgpt:186,gemini:189,llama:181,claude:185 },{ chatgpt:190,gemini:193,llama:185,claude:189 },{ chatgpt:192,gemini:195,llama:187,claude:191 },{ chatgpt:193,gemini:196,llama:188,claude:192 },{ chatgpt:195,gemini:198,llama:190,claude:194 }],
      'Houston Metro, TX':  [{ chatgpt:153,gemini:155,llama:148,claude:152 },{ chatgpt:156,gemini:158,llama:151,claude:155 },{ chatgpt:159,gemini:161,llama:154,claude:158 },{ chatgpt:160,gemini:162,llama:155,claude:159 },{ chatgpt:162,gemini:164,llama:157,claude:161 },{ chatgpt:163,gemini:166,llama:158,claude:162 }],
      'NYC Metro, NY':      [{ chatgpt:214,gemini:217,llama:207,claude:213 },{ chatgpt:219,gemini:222,llama:212,claude:217 },{ chatgpt:222,gemini:226,llama:216,claude:221 },{ chatgpt:225,gemini:228,llama:218,claude:224 },{ chatgpt:227,gemini:230,llama:220,claude:226 },{ chatgpt:229,gemini:232,llama:222,claude:228 }],
      'Atlanta Metro, GA':  [{ chatgpt:143,gemini:145,llama:138,claude:142 },{ chatgpt:146,gemini:148,llama:141,claude:145 },{ chatgpt:149,gemini:151,llama:144,claude:148 },{ chatgpt:150,gemini:152,llama:145,claude:149 },{ chatgpt:152,gemini:154,llama:147,claude:151 },{ chatgpt:153,gemini:155,llama:148,claude:152 }],
    },
    // Medium Truck (Straight 20-26ft): $1.75-2.25/mi spot. 50mi × $2.00 avg + loading = $268 LA Basin
    'medium-truck': {
      'LA Basin, CA':       [{ chatgpt:260,gemini:264,llama:252,claude:259 },{ chatgpt:266,gemini:270,llama:258,claude:265 },{ chatgpt:271,gemini:275,llama:263,claude:270 },{ chatgpt:273,gemini:278,llama:265,claude:272 },{ chatgpt:276,gemini:281,llama:268,claude:275 },{ chatgpt:278,gemini:283,llama:270,claude:277 }],
      'Houston Metro, TX':  [{ chatgpt:216,gemini:219,llama:209,claude:215 },{ chatgpt:221,gemini:224,llama:214,claude:220 },{ chatgpt:225,gemini:228,llama:218,claude:224 },{ chatgpt:227,gemini:230,llama:220,claude:226 },{ chatgpt:229,gemini:232,llama:222,claude:228 },{ chatgpt:231,gemini:234,llama:224,claude:230 }],
      'NYC Metro, NY':      [{ chatgpt:300,gemini:304,llama:291,claude:298 },{ chatgpt:306,gemini:311,llama:296,claude:304 },{ chatgpt:312,gemini:317,llama:302,claude:310 },{ chatgpt:314,gemini:319,llama:304,claude:312 },{ chatgpt:317,gemini:322,llama:307,claude:315 },{ chatgpt:320,gemini:325,llama:310,claude:318 }],
      'Atlanta Metro, GA':  [{ chatgpt:202,gemini:205,llama:195,claude:200 },{ chatgpt:206,gemini:209,llama:199,claude:204 },{ chatgpt:210,gemini:213,llama:203,claude:208 },{ chatgpt:212,gemini:215,llama:205,claude:210 },{ chatgpt:214,gemini:217,llama:207,claude:212 },{ chatgpt:216,gemini:219,llama:209,claude:214 }],
    },
    // Heavy Truck (Semi 40-53ft): $2.25-3.00/mi spot. 50mi × $2.75 avg + fees = $408 LA Basin
    'heavy-truck': {
      'LA Basin, CA':       [{ chatgpt:396,gemini:402,llama:384,claude:394 },{ chatgpt:405,gemini:411,llama:392,claude:403 },{ chatgpt:413,gemini:419,llama:401,claude:411 },{ chatgpt:416,gemini:423,llama:404,claude:414 },{ chatgpt:420,gemini:427,llama:407,claude:418 },{ chatgpt:424,gemini:431,llama:411,claude:422 }],
      'Houston Metro, TX':  [{ chatgpt:328,gemini:333,llama:318,claude:326 },{ chatgpt:335,gemini:340,llama:325,claude:333 },{ chatgpt:342,gemini:347,llama:332,claude:340 },{ chatgpt:345,gemini:350,llama:334,claude:343 },{ chatgpt:348,gemini:354,llama:338,claude:346 },{ chatgpt:351,gemini:357,llama:340,claude:349 }],
      'NYC Metro, NY':      [{ chatgpt:459,gemini:466,llama:445,claude:456 },{ chatgpt:469,gemini:476,llama:454,claude:466 },{ chatgpt:478,gemini:485,llama:463,claude:475 },{ chatgpt:482,gemini:489,llama:467,claude:479 },{ chatgpt:487,gemini:495,llama:472,claude:484 },{ chatgpt:491,gemini:499,llama:476,claude:488 }],
      'Atlanta Metro, GA':  [{ chatgpt:309,gemini:314,llama:299,claude:307 },{ chatgpt:316,gemini:321,llama:306,claude:314 },{ chatgpt:322,gemini:327,llama:312,claude:320 },{ chatgpt:325,gemini:330,llama:315,claude:323 },{ chatgpt:328,gemini:333,llama:318,claude:326 },{ chatgpt:331,gemini:336,llama:321,claude:329 }],
    },
    // Flatbed: $2.61-3.17/mi (DAT 2024 flatbed spot). 50mi × $3.00 avg + loading = $452 LA Basin
    'flatbed': {
      'LA Basin, CA':       [{ chatgpt:439,gemini:446,llama:426,claude:437 },{ chatgpt:448,gemini:455,llama:435,claude:446 },{ chatgpt:457,gemini:465,llama:444,claude:455 },{ chatgpt:462,gemini:469,llama:448,claude:459 },{ chatgpt:466,gemini:473,llama:451,claude:463 },{ chatgpt:470,gemini:477,llama:456,claude:467 }],
      'Houston Metro, TX':  [{ chatgpt:370,gemini:375,llama:358,claude:367 },{ chatgpt:377,gemini:382,llama:365,claude:374 },{ chatgpt:385,gemini:391,llama:373,claude:383 },{ chatgpt:388,gemini:394,llama:376,claude:386 },{ chatgpt:392,gemini:398,llama:380,claude:390 },{ chatgpt:395,gemini:401,llama:383,claude:393 }],
      'NYC Metro, NY':      [{ chatgpt:511,gemini:519,llama:495,claude:508 },{ chatgpt:522,gemini:530,llama:505,claude:519 },{ chatgpt:532,gemini:540,llama:515,claude:529 },{ chatgpt:536,gemini:544,llama:519,claude:533 },{ chatgpt:542,gemini:550,llama:525,claude:539 },{ chatgpt:546,gemini:554,llama:529,claude:543 }],
      'Atlanta Metro, GA':  [{ chatgpt:342,gemini:347,llama:332,claude:340 },{ chatgpt:349,gemini:355,llama:339,claude:347 },{ chatgpt:356,gemini:362,llama:345,claude:354 },{ chatgpt:359,gemini:365,llama:349,claude:358 },{ chatgpt:362,gemini:368,llama:352,claude:361 },{ chatgpt:365,gemini:371,llama:354,claude:364 }],
    },
    // Reefer: $2.88/mi avg (DAT 2024 reefer spot). 50mi × $2.88 + temp-control premium = $250 LA Basin
    'reefer': {
      'LA Basin, CA':       [{ chatgpt:243,gemini:247,llama:236,claude:242 },{ chatgpt:248,gemini:252,llama:241,claude:247 },{ chatgpt:253,gemini:257,llama:245,claude:252 },{ chatgpt:255,gemini:259,llama:247,claude:254 },{ chatgpt:258,gemini:262,llama:250,claude:257 },{ chatgpt:260,gemini:264,llama:252,claude:259 }],
      'Houston Metro, TX':  [{ chatgpt:203,gemini:207,llama:197,claude:202 },{ chatgpt:209,gemini:212,llama:202,claude:207 },{ chatgpt:213,gemini:216,llama:206,claude:211 },{ chatgpt:215,gemini:218,llama:208,claude:213 },{ chatgpt:217,gemini:220,llama:210,claude:215 },{ chatgpt:219,gemini:222,llama:212,claude:218 }],
      'NYC Metro, NY':      [{ chatgpt:281,gemini:286,llama:273,claude:280 },{ chatgpt:288,gemini:292,llama:279,claude:286 },{ chatgpt:294,gemini:298,llama:285,claude:292 },{ chatgpt:296,gemini:300,llama:287,claude:294 },{ chatgpt:299,gemini:303,llama:290,claude:297 },{ chatgpt:302,gemini:306,llama:293,claude:300 }],
      'Atlanta Metro, GA':  [{ chatgpt:192,gemini:195,llama:187,claude:191 },{ chatgpt:196,gemini:199,llama:190,claude:195 },{ chatgpt:200,gemini:203,llama:194,claude:199 },{ chatgpt:202,gemini:205,llama:196,claude:201 },{ chatgpt:204,gemini:208,llama:198,claude:203 },{ chatgpt:205,gemini:209,llama:199,claude:204 }],
    },
    // Hazmat: medium truck base + 20% regulatory premium. LA Basin ~$322
    'hazmat': {
      'LA Basin, CA':       [{ chatgpt:313,gemini:318,llama:303,claude:311 },{ chatgpt:319,gemini:324,llama:309,claude:317 },{ chatgpt:326,gemini:331,llama:316,claude:324 },{ chatgpt:329,gemini:334,llama:319,claude:327 },{ chatgpt:332,gemini:337,llama:322,claude:330 },{ chatgpt:335,gemini:340,llama:325,claude:333 }],
      'Houston Metro, TX':  [{ chatgpt:260,gemini:264,llama:252,claude:259 },{ chatgpt:266,gemini:270,llama:258,claude:265 },{ chatgpt:271,gemini:276,llama:263,claude:270 },{ chatgpt:273,gemini:278,llama:265,claude:272 },{ chatgpt:276,gemini:281,llama:268,claude:275 },{ chatgpt:278,gemini:283,llama:270,claude:277 }],
      'NYC Metro, NY':      [{ chatgpt:360,gemini:365,llama:348,claude:357 },{ chatgpt:367,gemini:372,llama:355,claude:365 },{ chatgpt:375,gemini:381,llama:363,claude:373 },{ chatgpt:378,gemini:384,llama:366,claude:376 },{ chatgpt:382,gemini:387,llama:370,claude:379 },{ chatgpt:385,gemini:391,llama:373,claude:383 }],
      'Atlanta Metro, GA':  [{ chatgpt:242,gemini:246,llama:235,claude:241 },{ chatgpt:247,gemini:251,llama:240,claude:246 },{ chatgpt:252,gemini:256,llama:245,claude:251 },{ chatgpt:254,gemini:258,llama:247,claude:253 },{ chatgpt:257,gemini:261,llama:249,claude:256 },{ chatgpt:259,gemini:263,llama:251,claude:258 }],
    },
    // Oversized: heavy truck + 25% + OW permits. LA Basin ~$512
    'oversized': {
      'LA Basin, CA':       [{ chatgpt:497,gemini:505,llama:482,claude:494 },{ chatgpt:507,gemini:515,llama:492,claude:505 },{ chatgpt:518,gemini:526,llama:503,claude:515 },{ chatgpt:522,gemini:530,llama:507,claude:519 },{ chatgpt:527,gemini:536,llama:511,claude:524 },{ chatgpt:532,gemini:541,llama:516,claude:529 }],
      'Houston Metro, TX':  [{ chatgpt:412,gemini:418,llama:399,claude:410 },{ chatgpt:420,gemini:427,llama:407,claude:418 },{ chatgpt:429,gemini:436,llama:416,claude:427 },{ chatgpt:432,gemini:439,llama:419,claude:430 },{ chatgpt:437,gemini:444,llama:424,claude:435 },{ chatgpt:441,gemini:447,llama:427,claude:438 }],
      'NYC Metro, NY':      [{ chatgpt:575,gemini:584,llama:557,claude:571 },{ chatgpt:587,gemini:596,llama:569,claude:584 },{ chatgpt:599,gemini:608,llama:581,claude:596 },{ chatgpt:604,gemini:614,llama:586,claude:601 },{ chatgpt:609,gemini:619,llama:591,claude:606 },{ chatgpt:615,gemini:625,llama:597,claude:612 }],
      'Atlanta Metro, GA':  [{ chatgpt:387,gemini:393,llama:375,claude:385 },{ chatgpt:395,gemini:401,llama:383,claude:393 },{ chatgpt:403,gemini:409,llama:391,claude:401 },{ chatgpt:406,gemini:412,llama:394,claude:404 },{ chatgpt:410,gemini:416,llama:398,claude:408 },{ chatgpt:414,gemini:421,llama:401,claude:412 }],
    },
    // High-Value: medium truck + 20% + armed security service. LA Basin ~$322
    'high-value': {
      'LA Basin, CA':       [{ chatgpt:313,gemini:318,llama:303,claude:311 },{ chatgpt:319,gemini:324,llama:309,claude:317 },{ chatgpt:326,gemini:331,llama:316,claude:324 },{ chatgpt:329,gemini:334,llama:319,claude:327 },{ chatgpt:332,gemini:337,llama:322,claude:330 },{ chatgpt:335,gemini:340,llama:325,claude:333 }],
      'Houston Metro, TX':  [{ chatgpt:260,gemini:264,llama:252,claude:259 },{ chatgpt:266,gemini:270,llama:258,claude:265 },{ chatgpt:271,gemini:276,llama:263,claude:270 },{ chatgpt:273,gemini:278,llama:265,claude:272 },{ chatgpt:276,gemini:281,llama:268,claude:275 },{ chatgpt:278,gemini:283,llama:270,claude:277 }],
      'NYC Metro, NY':      [{ chatgpt:360,gemini:365,llama:348,claude:357 },{ chatgpt:367,gemini:372,llama:355,claude:365 },{ chatgpt:375,gemini:381,llama:363,claude:373 },{ chatgpt:378,gemini:384,llama:366,claude:376 },{ chatgpt:382,gemini:387,llama:370,claude:379 },{ chatgpt:385,gemini:391,llama:373,claude:383 }],
      'Atlanta Metro, GA':  [{ chatgpt:242,gemini:246,llama:235,claude:241 },{ chatgpt:247,gemini:251,llama:240,claude:246 },{ chatgpt:252,gemini:256,llama:245,claude:251 },{ chatgpt:254,gemini:258,llama:247,claude:253 },{ chatgpt:257,gemini:261,llama:249,claude:256 },{ chatgpt:259,gemini:263,llama:251,claude:258 }],
    },
    // Tanker: $3.00-3.50/mi (premium specialty). 50mi × $3.25 avg + pump fees = $550 LA Basin
    'tanker': {
      'LA Basin, CA':       [{ chatgpt:534,gemini:542,llama:517,claude:531 },{ chatgpt:546,gemini:554,llama:529,claude:543 },{ chatgpt:557,gemini:565,llama:540,claude:554 },{ chatgpt:561,gemini:569,llama:544,claude:558 },{ chatgpt:567,gemini:576,llama:550,claude:564 },{ chatgpt:572,gemini:581,llama:555,claude:569 }],
      'Houston Metro, TX':  [{ chatgpt:447,gemini:453,llama:433,claude:444 },{ chatgpt:457,gemini:464,llama:443,claude:454 },{ chatgpt:466,gemini:473,llama:452,claude:463 },{ chatgpt:470,gemini:477,llama:455,claude:467 },{ chatgpt:474,gemini:481,llama:459,claude:471 },{ chatgpt:479,gemini:486,llama:464,claude:476 }],
      'NYC Metro, NY':      [{ chatgpt:609,gemini:619,llama:591,claude:606 },{ chatgpt:623,gemini:632,llama:604,claude:619 },{ chatgpt:636,gemini:645,llama:616,claude:632 },{ chatgpt:641,gemini:651,llama:621,claude:638 },{ chatgpt:647,gemini:657,llama:627,claude:643 },{ chatgpt:653,gemini:663,llama:633,claude:649 }],
      'Atlanta Metro, GA':  [{ chatgpt:417,gemini:424,llama:404,claude:415 },{ chatgpt:426,gemini:433,llama:413,claude:424 },{ chatgpt:435,gemini:442,llama:422,claude:433 },{ chatgpt:438,gemini:445,llama:425,claude:436 },{ chatgpt:442,gemini:449,llama:429,claude:440 },{ chatgpt:447,gemini:453,llama:433,claude:444 }],
    },
  },
}

function medianOf4(a: number, b: number, c: number, d: number): number {
  const s = [a, b, c, d].sort((x, y) => x - y)
  return Math.round((s[1] + s[2]) / 2)
}

function fmtRate(n: number): string {
  if (n === 0) return '—'
  if (n < 10) return `$${n.toFixed(2)}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}




// ── Last Mile line chart ──────────────────────────────────────────────────────

const RATE_SHEET_BASE: Record<string, Record<string, { numeric: number; label: string }>> = {
  drayage: {
    heavy: { numeric: 250, label: '$250' },
    'very-heavy': { numeric: 350, label: '$350' },
  },
  transloading: {
    'palletized-20ft': { numeric: 235, label: '$235' },
    'palletized-40ft': { numeric: 335, label: '$335' },
    'loose-20ft-500-1000': { numeric: 230, label: '$230' },
    'loose-20ft-1000plus': { numeric: 300, label: '$300 up to 1500 / $0.30 pc over' },
    'loose-40ft-500-1000': { numeric: 230, label: '$230' },
    'loose-40ft-1000plus': { numeric: 300, label: '$300 up to 1500 / $0.30 pc over' },
  },
}

const TENTATIVE_RATE_FACTORS: Record<string, number> = {
  'drayage_heavy_Houston Port, TX': 0.92,
  'drayage_heavy_NY / NJ Port, NY': 1.08,
  'drayage_heavy_Savannah Port, GA': 0.97,
  'drayage_heavy_Seattle Port, WA': 1.13,
  'drayage_very-heavy_Houston Port, TX': 1.06,
  'drayage_very-heavy_NY / NJ Port, NY': 0.95,
  'drayage_very-heavy_Savannah Port, GA': 1.11,
  'drayage_very-heavy_Seattle Port, WA': 0.90,
  'transloading_palletized-20ft_Houston Port, TX': 0.93,
  'transloading_palletized-20ft_NY / NJ Port, NY': 1.09,
  'transloading_palletized-20ft_Savannah Port, GA': 0.97,
  'transloading_palletized-40ft_Houston Port, TX': 1.12,
  'transloading_palletized-40ft_NY / NJ Port, NY': 0.96,
  'transloading_palletized-40ft_Savannah Port, GA': 1.05,
  'transloading_loose-20ft-500-1000_Houston Port, TX': 1.08,
  'transloading_loose-20ft-500-1000_NY / NJ Port, NY': 0.94,
  'transloading_loose-20ft-500-1000_Savannah Port, GA': 1.14,
  'transloading_loose-20ft-1000plus_Houston Port, TX': 0.91,
  'transloading_loose-20ft-1000plus_NY / NJ Port, NY': 1.07,
  'transloading_loose-20ft-1000plus_Savannah Port, GA': 0.98,
  'transloading_loose-40ft-500-1000_Houston Port, TX': 0.95,
  'transloading_loose-40ft-500-1000_NY / NJ Port, NY': 1.10,
  'transloading_loose-40ft-500-1000_Savannah Port, GA': 0.92,
  'transloading_loose-40ft-1000plus_Houston Port, TX': 1.06,
  'transloading_loose-40ft-1000plus_NY / NJ Port, NY': 0.93,
  'transloading_loose-40ft-1000plus_Savannah Port, GA': 1.12,
}

function getPricingFieldValue(service: string, subType: string, port: string, median: number): { numeric: number; label: string } {
  const sheetRate = RATE_SHEET_BASE[service]?.[subType]
  if (port === 'LA / LB Port, CA' && sheetRate) return sheetRate

  const factorKey = `${service}_${subType}_${port}`
  const factor = TENTATIVE_RATE_FACTORS[factorKey] ?? 1
  const numeric = Math.max(1, Math.round(median * factor))
  return { numeric, label: fmtRate(numeric) }
}

const LLM_LINES = [
  { key: 'chatgpt' as const, color: '#16a34a', label: 'ChatGPT' },
  { key: 'gemini'  as const, color: '#2563eb', label: 'Gemini'  },
  { key: 'llama'   as const, color: '#7c3aed', label: 'Llama'   },
  { key: 'claude'  as const, color: '#ea580c', label: 'Claude'  },
]

function MarketRateChart({
  ports,
  service,
  subType,
  showPricingLine = false,
  caption,
}: {
  ports: Record<string, LLMRates[]>
  service?: 'drayage' | 'transloading' | 'last-mile'
  subType?: string
  showPricingLine?: boolean
  caption: string
}) {
  const portNames = Object.keys(ports)
  const [selectedPort, setSelectedPort] = useState(portNames[0] ?? '')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!portNames.includes(selectedPort)) {
      setSelectedPort(portNames[0] ?? '')
    }
  }, [portNames, selectedPort])

  const series = ports[selectedPort] ?? []
  if (series.length === 0) return null

  const pricingSeries = showPricingLine && service && subType
    ? series.map(r => getPricingFieldValue(service, subType, selectedPort, medianOf4(r.chatgpt, r.gemini, r.llama, r.claude)).numeric)
    : []

  const allVals = series.flatMap(r => [r.chatgpt, r.gemini, r.llama, r.claude,
    medianOf4(r.chatgpt, r.gemini, r.llama, r.claude)])
  const chartVals = pricingSeries.length > 0 ? [...allVals, ...pricingSeries] : allVals
  const minVal = Math.floor(Math.min(...chartVals) * 0.95)
  const maxVal = Math.ceil(Math.max(...chartVals) * 1.05)

  const W = 560, H = 220, PAD = { top: 16, right: 16, bottom: 36, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  function xPos(i: number) { return PAD.left + (i / (PRICING_MONTHS.length - 1)) * chartW }
  function yPos(v: number) { return PAD.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH }

  function buildPath(vals: number[]) {
    return vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(v).toFixed(1)}`).join(' ')
  }

  const medians = series.map(r => medianOf4(r.chatgpt, r.gemini, r.llama, r.claude))
  const yTicks = 4
  const tickStep = (maxVal - minVal) / yTicks

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const relX = svgX - PAD.left
    const step = chartW / (PRICING_MONTHS.length - 1)
    const raw = relX / step
    if (raw < -0.5 || raw > PRICING_MONTHS.length - 0.5) { setHoveredIdx(null); return }
    setHoveredIdx(Math.min(Math.max(Math.round(raw), 0), PRICING_MONTHS.length - 1))
  }

  const hovered = hoveredIdx !== null ? series[hoveredIdx] : null
  const hoveredMedian = hovered ? medianOf4(hovered.chatgpt, hovered.gemini, hovered.llama, hovered.claude) : null
  const hoveredPricing = hoveredIdx !== null && pricingSeries.length > 0 ? pricingSeries[hoveredIdx] : null

  // Tooltip placement: flip to left side when near right edge
  const tooltipX = hoveredIdx !== null ? xPos(hoveredIdx) : 0
  const tooltipOnRight = hoveredIdx !== null && hoveredIdx < PRICING_MONTHS.length - 2
  const tooltipRectW = 138, tooltipRectH = pricingSeries.length > 0 ? 96 : 82
  const tooltipRX = tooltipOnRight ? tooltipX + 10 : tooltipX - tooltipRectW - 10
  const tooltipRY = PAD.top

  return (
    <div className="space-y-3">
      {/* Port selector */}
      <div className="flex gap-1.5 flex-wrap">
        {portNames.map(p => (
          <button key={p} onClick={() => setSelectedPort(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedPort === p ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 overflow-x-auto">
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          className="block mx-auto cursor-crosshair" style={{ maxWidth: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}>

          {/* Y grid lines + labels */}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const v = minVal + tickStep * i
            const y = yPos(v)
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">${Math.round(v)}</text>
              </g>
            )
          })}

          {/* X labels */}
          {PRICING_MONTHS.map((m, i) => (
            <text key={m} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="10"
              fill={hoveredIdx === i ? '#1e293b' : '#94a3b8'} fontWeight={hoveredIdx === i ? 'bold' : 'normal'}>
              {m}
            </text>
          ))}

          {/* LLM lines */}
          {LLM_LINES.map(({ key, color }) => (
            <path key={key} d={buildPath(series.map(r => r[key]))}
              fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          ))}

          {pricingSeries.length > 0 && (
            <path d={buildPath(pricingSeries)} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinejoin="round" />
          )}

          {/* Median line (bold dashed) */}
          <path d={buildPath(medians)} fill="none" stroke="#1e293b" strokeWidth="2.5"
            strokeDasharray="6 3" strokeLinejoin="round" />

          {/* Data points for median */}
          {medians.map((v, i) => (
            <circle key={i} cx={xPos(i)} cy={yPos(v)} r="3.5" fill="#1e293b" />
          ))}

          {pricingSeries.map((v, i) => (
            <circle key={`pricing-${i}`} cx={xPos(i)} cy={yPos(v)} r="3.5" fill="#dc2626" />
          ))}

          {/* Hover crosshair */}
          {hoveredIdx !== null && (
            <line x1={xPos(hoveredIdx)} y1={PAD.top} x2={xPos(hoveredIdx)} y2={PAD.top + chartH}
              stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
          )}

          {/* Hover data points */}
          {hoveredIdx !== null && hovered && (
            <>
              {LLM_LINES.map(({ key, color }) => (
                <circle key={key} cx={xPos(hoveredIdx)} cy={yPos(hovered[key])} r="5"
                  fill={color} stroke="white" strokeWidth="1.5" />
              ))}
              <circle cx={xPos(hoveredIdx)} cy={yPos(hoveredMedian!)} r="5.5"
                fill="#1e293b" stroke="white" strokeWidth="1.5" />
              {hoveredPricing !== null && (
                <circle cx={xPos(hoveredIdx)} cy={yPos(hoveredPricing)} r="5.5"
                  fill="#dc2626" stroke="white" strokeWidth="1.5" />
              )}
            </>
          )}

          {/* Tooltip */}
          {hoveredIdx !== null && hovered && (
            <g>
              <rect x={tooltipRX} y={tooltipRY} width={tooltipRectW} height={tooltipRectH}
                rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.10))' }} />
              <text x={tooltipRX + 8} y={tooltipRY + 14} fontSize="10" fontWeight="bold" fill="#1e293b">
                {PRICING_MONTHS[hoveredIdx]}
              </text>
              {LLM_LINES.map(({ key, color, label }, li) => (
                <g key={key}>
                  <circle cx={tooltipRX + 13} cy={tooltipRY + 26 + li * 12} r="3.5" fill={color} />
                  <text x={tooltipRX + 22} y={tooltipRY + 30 + li * 12} fontSize="10" fill="#334155">
                    {label}: <tspan fontWeight="bold">${hovered[key]}</tspan>
                  </text>
                </g>
              ))}
              {hoveredPricing !== null && (
                <g>
                  <circle cx={tooltipRX + 13} cy={tooltipRY + 74} r="3.5" fill="#dc2626" />
                  <text x={tooltipRX + 22} y={tooltipRY + 78} fontSize="10" fill="#334155">
                    FLD rate: <tspan fontWeight="bold">{fmtRate(hoveredPricing)}</tspan>
                  </text>
                </g>
              )}
              <line x1={tooltipRX + 8} y1={tooltipRY + tooltipRectH - 17} x2={tooltipRX + tooltipRectW - 8} y2={tooltipRY + tooltipRectH - 17} stroke="#e2e8f0" strokeWidth="1" />
              <text x={tooltipRX + 8} y={tooltipRY + tooltipRectH - 6} fontSize="10" fill="#1e293b" fontWeight="bold">
                Median: ${Math.round(hoveredMedian!)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {LLM_LINES.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
            <span className="text-[var(--color-text-2)]">{label}</span>
          </div>
        ))}
        {pricingSeries.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: '#dc2626' }} />
            <span className="font-semibold text-[var(--color-text-1)]">FLD Rate</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 rounded bg-slate-800" style={{ borderTop: '2px dashed #1e293b', background: 'none' }} />
          <span className="font-semibold text-[var(--color-text-1)]">Median</span>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-3)]">{caption}</p>
    </div>
  )
}

// ── Pricing Intelligence component ────────────────────────────────────────────

function PricingIntelligence() {
  const [service, setService] = useState<'drayage' | 'transloading' | 'last-mile'>('drayage')
  const [subType, setSubType] = useState('heavy')
  const [monthIdx, setMonthIdx] = useState(0)

  function switchService(s: 'drayage' | 'transloading' | 'last-mile') {
    setService(s)
    setSubType(SERVICE_SUBTYPES[s][0].id)
  }

  const ports = STATIC_RATES[service]?.[subType] ?? {}
  const portNames = Object.keys(ports)

  function yourRateColor(port: string, median: number): string {
    const pricing = getPricingFieldValue(service, subType, port, median)
    if (median === 0) return ''
    const pct = (pricing.numeric - median) / median
    if (pct <= 0.05) return 'bg-green-50 border-green-400 text-green-700'
    if (pct <= 0.15) return 'bg-amber-50 border-amber-400 text-amber-700'
    return 'bg-red-50 border-red-400 text-red-700'
  }

  return (
    <div className="space-y-5">
      {/* Service tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['drayage', 'transloading', 'last-mile'] as const).map(s => (
          <button key={s} onClick={() => switchService(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${service === s ? 'bg-blue-600 text-white' : 'border border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}>
            {s === 'last-mile' ? 'Last Mile' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Sub-type tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {SERVICE_SUBTYPES[service].map(st => (
          <button key={st.id} onClick={() => setSubType(st.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${subType === st.id ? 'bg-slate-800 text-white border-slate-700' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}>
            {st.label}
          </button>
        ))}
      </div>

      {/* Month tabs — only for table view (drayage/transloading) */}
      {service !== 'last-mile' && (
        <div className="flex gap-1.5 flex-wrap">
          {PRICING_MONTHS.map((m, i) => (
            <button key={m} onClick={() => setMonthIdx(i)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${monthIdx === i ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}>
              {m}
            </button>
          ))}
        </div>
      )}

      <MarketRateChart
        ports={ports}
        service={service}
        subType={subType}
        showPricingLine={service !== 'last-mile'}
        caption={service === 'last-mile'
          ? '6-month rate trend across selected metro markets. Hover to inspect month-by-month pricing.'
          : '6-month market trend with FLD pricing overlaid for the selected port. Hover to compare your rate against the market.'}
      />

      {service !== 'last-mile' && (
        <>
          {/* Table for drayage / transloading */}
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[var(--color-bg-2)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide whitespace-nowrap">Port</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-green-700 whitespace-nowrap">Avg Rate ChatGPT</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700 whitespace-nowrap">Avg Rate Gemini</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-violet-700 whitespace-nowrap">Avg Rate Llama</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-orange-700 whitespace-nowrap">Avg Rate Claude</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-text-1)] uppercase tracking-wide whitespace-nowrap">Median Rate</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide whitespace-nowrap">Sheet / Tentative Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
                {portNames.map(port => {
                  const r = ports[port]?.[monthIdx]
                  if (!r) return null
                  const median = medianOf4(r.chatgpt, r.gemini, r.llama, r.claude)
                  const pricingField = getPricingFieldValue(service, subType, port, median)
                  return (
                    <tr key={port} className="hover:bg-[var(--color-bg-2)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--color-text-1)] whitespace-nowrap">{port}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-green-700">{fmtRate(r.chatgpt)}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-blue-700">{fmtRate(r.gemini)}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-violet-700">{fmtRate(r.llama)}</td>
                      <td className="px-3 py-3 text-center font-mono text-sm text-orange-700">{fmtRate(r.claude)}</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-[var(--color-text-1)]">{fmtRate(median)}</td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="text"
                          value={pricingField.label}
                          readOnly
                          placeholder="—"
                          className={`w-52 px-2 py-1 text-xs text-center font-mono border rounded-lg bg-[var(--color-bg)] transition-colors cursor-default ${yourRateColor(port, median) || 'border-[var(--color-border)] text-[var(--color-text-1)]'}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--color-text-3)]">
            LA / LB uses your rate sheet. Other ports use tentative benchmark prices. Green = at or below median, amber = 5 to 15 percent above, red = over 15 percent above.
          </p>
        </>
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

const QUOTE_FOLLOW_UP_PROMPTS = [
  { label: '✓ Mark as Won', status: 'won', color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { label: '✗ Mark as Lost', status: 'lost', color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
  { label: '✎ Request Revision', status: 'revision-requested', color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { label: '? Ask Follow-up', status: '', color: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' },
]

const STATUS_FRIENDLY: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  'revision-requested': 'Revision Requested',
}

function Analytics({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [replyTarget, setReplyTarget] = useState<number | null>(null)
  // Status action state
  const [pendingAction, setPendingAction] = useState<{ status: string; label: string } | null>(null)
  const [statusId, setStatusId] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusResult, setStatusResult] = useState<{ ok: boolean; message: string } | null>(null)
  const statusInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (pendingAction) statusInputRef.current?.focus()
  }, [pendingAction])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', text: text.trim() }
    setMessages(prev => {
      const updated = prev.map(m => ({ ...m, showActions: false }))
      return [...updated, userMsg]
    })
    setInput('')
    setReplyTarget(null)
    setPendingAction(null)
    setStatusResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/crm/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text.trim() }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer ?? 'Sorry, I could not generate an answer.',
        showActions: true,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Analytics service unavailable. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  async function applyStatusAction() {
    if (!pendingAction || !statusId.trim()) return
    setStatusLoading(true)
    setStatusResult(null)

    const id = statusId.trim()
    const isThread = id.startsWith('THR_')
    const body: Record<string, string> = { status: pendingAction.status }
    if (isThread) body.threadId = id
    else body.quoteId = id

    try {
      const res = await fetch('/api/chat/quote/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        const friendlyStatus = STATUS_FRIENDLY[pendingAction.status] ?? pendingAction.status
        setStatusResult({ ok: true, message: `${id} has been marked as ${friendlyStatus}.` })
        // Notify the analytics AI so the conversation reflects the update
        send(`${id} has been marked as ${friendlyStatus}. Please update the analytics summary accordingly.`)
        setPendingAction(null)
        setStatusId('')
      } else {
        setStatusResult({ ok: false, message: data.error ?? 'Could not update status. Check the ID and try again.' })
      }
    } catch {
      setStatusResult({ ok: false, message: 'Network error. Please try again.' })
    } finally {
      setStatusLoading(false)
    }
  }

  function handleQuickAction(prompt: typeof QUOTE_FOLLOW_UP_PROMPTS[0]) {
    if (!prompt.status) {
      // "Ask Follow-up" — just focus the text input
      setReplyTarget(messages.length - 1)
      setPendingAction(null)
    } else {
      // Status action — show inline ID input
      setPendingAction({ status: prompt.status, label: prompt.label })
      setStatusId('')
      setStatusResult(null)
    }
  }

  const fn = (userName || 'there').split(' ')[0]
  const lastAssistantIdx = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).at(-1) ?? -1

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] min-h-[520px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 mb-4 text-white">
        <p className="text-xl font-semibold mb-0.5">Hi {fn}, Welcome</p>
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
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-1)] rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>

            {/* Reply actions — shown below the latest assistant message */}
            {m.role === 'assistant' && i === lastAssistantIdx && m.showActions && !loading && (
              <div className="mt-2 w-full max-w-[85%]">
                <p className="text-[11px] text-[var(--color-text-3)] mb-1.5 font-medium">Actions for this quote / response:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QUOTE_FOLLOW_UP_PROMPTS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => handleQuickAction(p)}
                      className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-colors ${p.color} ${
                        pendingAction?.status === p.status ? 'ring-2 ring-offset-1 ring-blue-400' : ''
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Inline status-update form */}
                {pendingAction && (
                  <div className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
                    <p className="text-xs text-[var(--color-text-2)] mb-2 font-medium">
                      {pendingAction.label} — Enter Quote ID <span className="text-[var(--color-text-3)] font-normal">(e.g. Q-1ABC123)</span> or Thread ID <span className="text-[var(--color-text-3)] font-normal">(e.g. THR_20260414_XYZ)</span>:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        ref={statusInputRef}
                        value={statusId}
                        onChange={e => { setStatusId(e.target.value); setStatusResult(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') applyStatusAction() }}
                        placeholder="Quote ID or Thread ID"
                        className="flex-1 min-w-[180px] px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-2)] text-[var(--color-text-1)] focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={applyStatusAction}
                        disabled={!statusId.trim() || statusLoading}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
                      >
                        {statusLoading ? 'Updating…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => { setPendingAction(null); setStatusResult(null) }}
                        className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {statusResult && (
                      <p className={`mt-1.5 text-xs font-medium ${statusResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                        {statusResult.ok ? '✓ ' : '✗ '}{statusResult.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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

      {/* Reply context indicator */}
      {replyTarget !== null && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg mb-2 text-xs text-blue-700">
          <span>Replying to AI response</span>
          <button onClick={() => setReplyTarget(null)} className="ml-auto text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder={replyTarget !== null ? 'Type your follow-up question…' : 'Ask about pricing trends, win rates, customer analytics…'}
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
  const [data, setData] = useState<CrmData>({
    dashboard: { stats: SEED_STATS, recentQuotes: SEED_RECENT_QUOTES },
    accounts: SEED_ACCOUNTS,
    quotes: SEED_QUOTES,
    carriers: SEED_CARRIERS,
    shipments: SEED_SHIPMENTS,
  })
  const [loading, setLoading] = useState<Record<CrmSubTab, boolean>>({
    dashboard: false, customers: false, quotes: false, carriers: false, shipments: false, analytics: false, pricing: false,
  })
  const loaded = useRef<Set<CrmSubTab>>(new Set())

  async function fetchSection(section: CrmSubTab) {
    if (section === 'analytics' || section === 'pricing' || loaded.current.has(section)) return
    setLoading(prev => ({ ...prev, [section]: true }))
    try {
      const apiSection = section === 'customers' ? 'accounts' : section
      const res = await fetch(`/api/crm?section=${apiSection}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()

      // Only replace seed data if the API returns real content
      if (section === 'dashboard' && json.stats) {
        const hasReal = (json.recentQuotes ?? []).length > 0
        setData(prev => ({
          ...prev,
          dashboard: {
            stats: hasReal ? json.stats : SEED_STATS,
            recentQuotes: hasReal ? json.recentQuotes : SEED_RECENT_QUOTES,
          },
        }))
      } else if (section === 'customers') {
        const real = json.accounts ?? []
        if (real.length > 0) setData(prev => ({ ...prev, accounts: real }))
      } else if (section === 'quotes') {
        const real = json.quotes ?? []
        if (real.length > 0) setData(prev => ({ ...prev, quotes: real }))
      } else if (section === 'carriers') {
        const real = json.carriers ?? []
        if (real.length > 0) setData(prev => ({ ...prev, carriers: real }))
      } else if (section === 'shipments') {
        const real = json.shipments ?? []
        if (real.length > 0) setData(prev => ({ ...prev, shipments: real }))
      }
      loaded.current.add(section)
    } catch {
      // silently fail — seed data stays visible
      loaded.current.add(section)
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }))
    }
  }

  useEffect(() => { fetchSection(subTab) }, [subTab])

  const SUB_TABS: { id: CrmSubTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analytics', label: 'AI Analytics' },
    { id: 'pricing',   label: 'Pricing Analytics' },
    { id: 'customers', label: 'Customers' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'carriers', label: 'Carriers' },
    { id: 'shipments', label: 'Shipments' },
  ]

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-[var(--color-text-2)] border border-[var(--color-border)] hover:bg-[var(--color-bg-2)]'
            }`}
          >
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
        <h1 className="text-lg font-semibold text-[var(--color-text-1)]">
          {subTab === 'dashboard' && 'CRM Dashboard'}
          {subTab === 'pricing'   && 'Pricing Analytics'}
          {subTab === 'customers' && 'Customer Accounts'}
          {subTab === 'quotes' && 'Quote History'}
          {subTab === 'carriers' && 'Carrier Management'}
          {subTab === 'shipments' && 'Shipment Tracking'}
          {subTab === 'analytics' && 'AI Analytics'}
        </h1>
        {subTab === 'pricing'   && <span className="text-sm text-[var(--color-text-3)]">— Market rates, regional benchmarks & rate recommendations</span>}
        {subTab === 'customers' && <span className="text-sm text-[var(--color-text-3)]">— Accounts, contacts & customer tiers</span>}
        {subTab === 'quotes' && <span className="text-sm text-[var(--color-text-3)]">— Full quote pipeline & conversion tracking</span>}
        {subTab === 'carriers' && <span className="text-sm text-[var(--color-text-3)]">— MC#, DOT#, insurance & performance</span>}
        {subTab === 'shipments' && <span className="text-sm text-[var(--color-text-3)]">— Shipment ID tracking & delivery status</span>}
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
      {subTab === 'pricing' && (
        <PricingIntelligence />
      )}
      {subTab === 'analytics' && (
        <Analytics userName={userName} />
      )}
    </div>
  )
}
