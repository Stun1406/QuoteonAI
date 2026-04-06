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

// ── Pricing Intelligence (static placeholder) ────────────────────────────────

type LLMRates = { chatgpt: number; gemini: number; llama: number; claude: number }


// ── Pricing Intelligence static data ─────────────────────────────────────────

const SERVICE_SUBTYPES: Record<string, { id: string; label: string }[]> = {
  drayage:       [{ id: '40ft', label: '40ft Container' }, { id: '20ft', label: '20ft Container' }, { id: '45ft', label: '45ft Container' }],
  transloading:  [{ id: 'regular', label: 'Regular Container' }, { id: 'oversize', label: 'Oversize Container' }, { id: 'loose-cargo', label: 'Loose Cargo' }],
  'last-mile':   [{ id: 'straight-truck', label: 'Straight Truck' }, { id: 'box-truck', label: 'Box Truck' }, { id: 'sprinter', label: 'Sprinter Van' }],
}

const PRICING_MONTHS = ['Dec 2024', 'Jan 2025', 'Feb 2025', 'Mar 2025']

// Static rates: service → subType → portName → [month0…month3]
const STATIC_RATES: Record<string, Record<string, Record<string, LLMRates[]>>> = {
  drayage: {
    '40ft': {
      'LA / LB Port, CA':   [{ chatgpt:485,gemini:492,llama:478,claude:488 },{ chatgpt:490,gemini:498,llama:482,claude:493 },{ chatgpt:502,gemini:508,llama:495,claude:504 },{ chatgpt:515,gemini:520,llama:508,claude:512 }],
      'Houston Port, TX':   [{ chatgpt:415,gemini:408,llama:420,claude:412 },{ chatgpt:418,gemini:412,llama:425,claude:416 },{ chatgpt:425,gemini:420,llama:432,claude:423 },{ chatgpt:432,gemini:428,llama:440,claude:430 }],
      'NY / NJ Port, NY':   [{ chatgpt:525,gemini:532,llama:518,claude:528 },{ chatgpt:530,gemini:540,llama:522,claude:534 },{ chatgpt:545,gemini:552,llama:538,claude:548 },{ chatgpt:558,gemini:565,llama:550,claude:560 }],
      'Savannah Port, GA':  [{ chatgpt:365,gemini:370,llama:358,claude:368 },{ chatgpt:368,gemini:375,llama:362,claude:372 },{ chatgpt:375,gemini:382,llama:368,claude:378 },{ chatgpt:382,gemini:390,llama:376,claude:385 }],
      'Seattle Port, WA':   [{ chatgpt:445,gemini:452,llama:438,claude:448 },{ chatgpt:448,gemini:455,llama:442,claude:450 },{ chatgpt:455,gemini:462,llama:448,claude:458 },{ chatgpt:462,gemini:470,llama:456,claude:466 }],
    },
    '20ft': {
      'LA / LB Port, CA':   [{ chatgpt:365,gemini:370,llama:358,claude:368 },{ chatgpt:368,gemini:375,llama:362,claude:372 },{ chatgpt:378,gemini:382,llama:372,claude:380 },{ chatgpt:388,gemini:392,llama:382,claude:390 }],
      'Houston Port, TX':   [{ chatgpt:312,gemini:308,llama:318,claude:310 },{ chatgpt:315,gemini:310,llama:320,claude:313 },{ chatgpt:320,gemini:316,llama:326,claude:318 },{ chatgpt:325,gemini:322,llama:330,claude:324 }],
      'NY / NJ Port, NY':   [{ chatgpt:395,gemini:400,llama:388,claude:396 },{ chatgpt:398,gemini:406,llama:392,claude:400 },{ chatgpt:410,gemini:416,llama:404,claude:412 },{ chatgpt:420,gemini:425,llama:414,claude:421 }],
      'Savannah Port, GA':  [{ chatgpt:275,gemini:278,llama:270,claude:276 },{ chatgpt:278,gemini:282,llama:274,claude:280 },{ chatgpt:282,gemini:288,llama:276,claude:285 },{ chatgpt:288,gemini:294,llama:282,claude:290 }],
      'Seattle Port, WA':   [{ chatgpt:334,gemini:340,llama:328,claude:336 },{ chatgpt:336,gemini:342,llama:330,claude:338 },{ chatgpt:342,gemini:348,llama:336,claude:344 },{ chatgpt:348,gemini:354,llama:342,claude:350 }],
    },
    '45ft': {
      'LA / LB Port, CA':   [{ chatgpt:558,gemini:565,llama:550,claude:561 },{ chatgpt:564,gemini:572,llama:554,claude:566 },{ chatgpt:577,gemini:584,llama:569,claude:579 },{ chatgpt:592,gemini:598,llama:584,claude:589 }],
      'Houston Port, TX':   [{ chatgpt:477,gemini:469,llama:483,claude:474 },{ chatgpt:481,gemini:474,llama:489,claude:478 },{ chatgpt:489,gemini:483,llama:497,claude:486 },{ chatgpt:497,gemini:492,llama:506,claude:495 }],
      'NY / NJ Port, NY':   [{ chatgpt:604,gemini:612,llama:596,claude:607 },{ chatgpt:610,gemini:621,llama:600,claude:614 },{ chatgpt:627,gemini:635,llama:619,claude:630 },{ chatgpt:642,gemini:650,llama:633,claude:644 }],
      'Savannah Port, GA':  [{ chatgpt:420,gemini:426,llama:412,claude:423 },{ chatgpt:423,gemini:432,llama:416,claude:428 },{ chatgpt:431,gemini:439,llama:423,claude:434 },{ chatgpt:439,gemini:449,llama:433,claude:443 }],
      'Seattle Port, WA':   [{ chatgpt:512,gemini:520,llama:504,claude:515 },{ chatgpt:515,gemini:524,llama:508,claude:518 },{ chatgpt:523,gemini:531,llama:515,claude:527 },{ chatgpt:531,gemini:541,llama:524,claude:536 }],
    },
  },
  transloading: {
    'regular': {
      'LA / LB Port, CA':   [{ chatgpt:14,gemini:15,llama:13,claude:14 },{ chatgpt:14,gemini:15,llama:14,claude:15 },{ chatgpt:15,gemini:16,llama:14,claude:15 },{ chatgpt:15,gemini:16,llama:15,claude:16 }],
      'Houston Port, TX':   [{ chatgpt:12,gemini:12,llama:11,claude:12 },{ chatgpt:12,gemini:13,llama:11,claude:12 },{ chatgpt:12,gemini:13,llama:12,claude:13 },{ chatgpt:13,gemini:13,llama:12,claude:13 }],
      'NY / NJ Port, NY':   [{ chatgpt:16,gemini:17,llama:15,claude:16 },{ chatgpt:16,gemini:17,llama:15,claude:17 },{ chatgpt:17,gemini:18,llama:16,claude:17 },{ chatgpt:17,gemini:18,llama:17,claude:18 }],
      'Savannah Port, GA':  [{ chatgpt:11,gemini:12,llama:11,claude:11 },{ chatgpt:11,gemini:12,llama:11,claude:12 },{ chatgpt:12,gemini:12,llama:11,claude:12 },{ chatgpt:12,gemini:13,llama:12,claude:12 }],
    },
    'oversize': {
      'LA / LB Port, CA':   [{ chatgpt:22,gemini:23,llama:21,claude:22 },{ chatgpt:22,gemini:23,llama:21,claude:23 },{ chatgpt:23,gemini:24,llama:22,claude:23 },{ chatgpt:23,gemini:25,llama:23,claude:24 }],
      'Houston Port, TX':   [{ chatgpt:18,gemini:19,llama:17,claude:18 },{ chatgpt:18,gemini:19,llama:18,claude:19 },{ chatgpt:19,gemini:20,llama:18,claude:19 },{ chatgpt:19,gemini:20,llama:19,claude:20 }],
      'NY / NJ Port, NY':   [{ chatgpt:25,gemini:26,llama:24,claude:25 },{ chatgpt:25,gemini:26,llama:24,claude:26 },{ chatgpt:26,gemini:27,llama:25,claude:26 },{ chatgpt:26,gemini:28,llama:26,claude:27 }],
      'Savannah Port, GA':  [{ chatgpt:16,gemini:17,llama:15,claude:16 },{ chatgpt:16,gemini:17,llama:16,claude:17 },{ chatgpt:17,gemini:18,llama:16,claude:17 },{ chatgpt:17,gemini:18,llama:17,claude:18 }],
    },
    'loose-cargo': {
      'LA / LB Port, CA':   [{ chatgpt:485,gemini:495,llama:475,claude:490 },{ chatgpt:490,gemini:500,llama:480,claude:495 },{ chatgpt:498,gemini:508,llama:488,claude:502 },{ chatgpt:505,gemini:515,llama:495,claude:510 }],
      'Houston Port, TX':   [{ chatgpt:420,gemini:428,llama:412,claude:422 },{ chatgpt:425,gemini:432,llama:415,claude:428 },{ chatgpt:432,gemini:440,llama:422,claude:435 },{ chatgpt:438,gemini:448,llama:428,claude:442 }],
      'NY / NJ Port, NY':   [{ chatgpt:535,gemini:545,llama:525,claude:538 },{ chatgpt:540,gemini:552,llama:530,claude:544 },{ chatgpt:548,gemini:560,llama:538,claude:552 },{ chatgpt:555,gemini:568,llama:545,claude:558 }],
      'Savannah Port, GA':  [{ chatgpt:382,gemini:390,llama:375,claude:385 },{ chatgpt:386,gemini:394,llama:378,claude:388 },{ chatgpt:392,gemini:400,llama:384,claude:395 },{ chatgpt:398,gemini:408,llama:390,claude:401 }],
    },
  },
  'last-mile': {
    'straight-truck': {
      'LA Basin, CA':        [{ chatgpt:425,gemini:440,llama:415,claude:430 },{ chatgpt:430,gemini:445,llama:420,claude:435 },{ chatgpt:435,gemini:450,llama:425,claude:440 },{ chatgpt:440,gemini:455,llama:430,claude:445 }],
      'Houston Metro, TX':   [{ chatgpt:365,gemini:375,llama:355,claude:368 },{ chatgpt:368,gemini:378,llama:358,claude:372 },{ chatgpt:372,gemini:382,llama:362,claude:376 },{ chatgpt:376,gemini:386,llama:366,claude:380 }],
      'NYC Metro, NY':       [{ chatgpt:485,gemini:500,llama:470,claude:488 },{ chatgpt:490,gemini:505,llama:475,claude:492 },{ chatgpt:495,gemini:510,llama:480,claude:498 },{ chatgpt:500,gemini:515,llama:485,claude:503 }],
      'Atlanta Metro, GA':   [{ chatgpt:345,gemini:355,llama:336,claude:348 },{ chatgpt:348,gemini:358,llama:338,claude:352 },{ chatgpt:352,gemini:362,llama:342,claude:356 },{ chatgpt:356,gemini:366,llama:346,claude:360 }],
    },
    'box-truck': {
      'LA Basin, CA':        [{ chatgpt:315,gemini:325,llama:308,claude:318 },{ chatgpt:318,gemini:328,llama:310,claude:322 },{ chatgpt:322,gemini:332,llama:314,claude:326 },{ chatgpt:326,gemini:336,llama:318,claude:330 }],
      'Houston Metro, TX':   [{ chatgpt:275,gemini:282,llama:268,claude:278 },{ chatgpt:278,gemini:285,llama:270,claude:280 },{ chatgpt:282,gemini:288,llama:274,claude:284 },{ chatgpt:285,gemini:292,llama:278,claude:288 }],
      'NYC Metro, NY':       [{ chatgpt:355,gemini:365,llama:346,claude:358 },{ chatgpt:358,gemini:368,llama:348,claude:362 },{ chatgpt:362,gemini:372,llama:352,claude:366 },{ chatgpt:366,gemini:376,llama:356,claude:370 }],
      'Atlanta Metro, GA':   [{ chatgpt:260,gemini:268,llama:252,claude:262 },{ chatgpt:262,gemini:270,llama:254,claude:264 },{ chatgpt:265,gemini:273,llama:257,claude:267 },{ chatgpt:268,gemini:276,llama:260,claude:270 }],
    },
    'sprinter': {
      'LA Basin, CA':        [{ chatgpt:220,gemini:228,llama:214,claude:222 },{ chatgpt:222,gemini:230,llama:216,claude:224 },{ chatgpt:225,gemini:233,llama:218,claude:227 },{ chatgpt:228,gemini:236,llama:221,claude:230 }],
      'Houston Metro, TX':   [{ chatgpt:192,gemini:198,llama:186,claude:194 },{ chatgpt:194,gemini:200,llama:188,claude:196 },{ chatgpt:196,gemini:202,llama:190,claude:198 },{ chatgpt:198,gemini:204,llama:192,claude:200 }],
      'NYC Metro, NY':       [{ chatgpt:245,gemini:254,llama:238,claude:248 },{ chatgpt:248,gemini:257,llama:240,claude:250 },{ chatgpt:250,gemini:260,llama:243,claude:253 },{ chatgpt:253,gemini:263,llama:246,claude:256 }],
      'Atlanta Metro, GA':   [{ chatgpt:178,gemini:185,llama:172,claude:180 },{ chatgpt:180,gemini:187,llama:174,claude:182 },{ chatgpt:182,gemini:189,llama:176,claude:184 },{ chatgpt:184,gemini:191,llama:178,claude:186 }],
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




// ── Pricing Intelligence component ────────────────────────────────────────────

function PricingIntelligence() {
  const [service, setService] = useState<'drayage' | 'transloading' | 'last-mile'>('drayage')
  const [subType, setSubType] = useState('40ft')
  const [monthIdx, setMonthIdx] = useState(0)
  const [yourRates, setYourRates] = useState<Record<string, string>>({})

  function switchService(s: 'drayage' | 'transloading' | 'last-mile') {
    setService(s)
    setSubType(SERVICE_SUBTYPES[s][0].id)
  }

  const ports = STATIC_RATES[service]?.[subType] ?? {}
  const portNames = Object.keys(ports)

  function yourRateKey(port: string) { return `${service}_${subType}_${port}` }

  function yourRateColor(port: string, median: number): string {
    const your = parseFloat(yourRates[yourRateKey(port)] ?? '')
    if (isNaN(your) || median === 0) return ''
    const pct = (your - median) / median
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

      {/* Month tabs */}
      <div className="flex gap-1.5">
        {PRICING_MONTHS.map((m, i) => (
          <button key={m} onClick={() => setMonthIdx(i)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${monthIdx === i ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--color-border)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Table */}
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
              <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wide whitespace-nowrap">Your Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
            {portNames.map(port => {
              const r = ports[port]?.[monthIdx]
              if (!r) return null
              const median = medianOf4(r.chatgpt, r.gemini, r.llama, r.claude)
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
                      type="number"
                      value={yourRates[yourRateKey(port)] ?? ''}
                      onChange={e => setYourRates(prev => ({ ...prev, [yourRateKey(port)]: e.target.value }))}
                      placeholder="—"
                      className={`w-24 px-2 py-1 text-xs text-center font-mono border rounded-lg focus:outline-none focus:border-blue-400 bg-[var(--color-bg)] transition-colors ${yourRateColor(port, median) || 'border-[var(--color-border)] text-[var(--color-text-1)]'}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-text-3)]">
        Your Rate: green = at/below median · amber = 5–15% above · red = &gt;15% above
      </p>
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
      {subTab === 'pricing' && (
        <PricingIntelligence />
      )}
      {subTab === 'analytics' && (
        <Analytics userName={userName} />
      )}
    </div>
  )
}
