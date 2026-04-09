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
    const matchSearch = !q || s.id?.toLowerCase().includes(q) || s.customer_company?.toLowerCase().includes(q) || s.origin?.toLowerCase().includes(q) || s.destination?.toLowerCase().includes(q)
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
              <TD><span className="font-mono text-xs">{s.id}</span></TD>
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
    { id: 'overweight',label: 'Overweight (over 50,000 lbs)' },
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
// Drayage: all-in rate per container move by weight (base + weight surcharge from rate sheet)
// Transloading: per-container charge based on FLD rate sheet
// Last Mile: per-trip rate (50-mile baseline) based on $/mile rate sheet
const STATIC_RATES: Record<string, Record<string, Record<string, LLMRates[]>>> = {
  drayage: {
    // Heavy (43k–47k lbs) — base + $250 surcharge per rate sheet — [Oct,Nov,Dec,Jan,Feb,Mar]
    'heavy': {
      'LA / LB Port, CA':  [{ chatgpt:718,gemini:728,llama:710,claude:722 },{ chatgpt:725,gemini:735,llama:717,claude:729 },{ chatgpt:732,gemini:742,llama:724,claude:736 },{ chatgpt:738,gemini:748,llama:730,claude:742 },{ chatgpt:746,gemini:756,llama:738,claude:750 },{ chatgpt:754,gemini:765,llama:746,claude:759 }],
      'Houston Port, TX':  [{ chatgpt:648,gemini:640,llama:656,claude:646 },{ chatgpt:655,gemini:647,llama:663,claude:653 },{ chatgpt:662,gemini:654,llama:670,claude:660 },{ chatgpt:667,gemini:659,llama:675,claude:665 },{ chatgpt:673,gemini:665,llama:681,claude:671 },{ chatgpt:679,gemini:671,llama:688,claude:677 }],
      'NY / NJ Port, NY':  [{ chatgpt:759,gemini:767,llama:752,claude:763 },{ chatgpt:766,gemini:774,llama:759,claude:770 },{ chatgpt:773,gemini:781,llama:766,claude:777 },{ chatgpt:779,gemini:788,llama:772,claude:783 },{ chatgpt:789,gemini:798,llama:782,claude:793 },{ chatgpt:799,gemini:810,llama:792,claude:804 }],
      'Savannah Port, GA': [{ chatgpt:598,gemini:605,llama:590,claude:601 },{ chatgpt:605,gemini:612,llama:597,claude:608 },{ chatgpt:612,gemini:619,llama:604,claude:615 },{ chatgpt:617,gemini:624,llama:608,claude:620 },{ chatgpt:623,gemini:630,llama:614,claude:626 },{ chatgpt:629,gemini:637,llama:620,claude:633 }],
      'Seattle Port, WA':  [{ chatgpt:678,gemini:687,llama:670,claude:683 },{ chatgpt:685,gemini:694,llama:677,claude:690 },{ chatgpt:692,gemini:701,llama:684,claude:697 },{ chatgpt:697,gemini:706,llama:688,claude:702 },{ chatgpt:703,gemini:712,llama:694,claude:708 },{ chatgpt:709,gemini:719,llama:700,claude:714 }],
    },
    // Very heavy (47k–50k lbs) — base + $350 surcharge
    'very-heavy': {
      'LA / LB Port, CA':  [{ chatgpt:818,gemini:829,llama:809,claude:823 },{ chatgpt:825,gemini:836,llama:816,claude:830 },{ chatgpt:832,gemini:843,llama:823,claude:837 },{ chatgpt:839,gemini:850,llama:830,claude:844 },{ chatgpt:847,gemini:858,llama:838,claude:852 },{ chatgpt:855,gemini:867,llama:846,claude:861 }],
      'Houston Port, TX':  [{ chatgpt:748,gemini:739,llama:757,claude:745 },{ chatgpt:755,gemini:746,llama:764,claude:752 },{ chatgpt:762,gemini:753,llama:771,claude:759 },{ chatgpt:767,gemini:758,llama:776,claude:764 },{ chatgpt:774,gemini:765,llama:783,claude:771 },{ chatgpt:780,gemini:771,llama:790,claude:777 }],
      'NY / NJ Port, NY':  [{ chatgpt:859,gemini:868,llama:851,claude:864 },{ chatgpt:866,gemini:875,llama:858,claude:871 },{ chatgpt:873,gemini:882,llama:865,claude:878 },{ chatgpt:879,gemini:889,llama:871,claude:884 },{ chatgpt:889,gemini:899,llama:881,claude:894 },{ chatgpt:900,gemini:911,llama:892,claude:906 }],
      'Savannah Port, GA': [{ chatgpt:698,gemini:706,llama:689,claude:702 },{ chatgpt:705,gemini:713,llama:696,claude:709 },{ chatgpt:712,gemini:720,llama:703,claude:716 },{ chatgpt:717,gemini:725,llama:708,claude:721 },{ chatgpt:723,gemini:731,llama:714,claude:727 },{ chatgpt:729,gemini:738,llama:720,claude:734 }],
      'Seattle Port, WA':  [{ chatgpt:779,gemini:788,llama:770,claude:784 },{ chatgpt:786,gemini:795,llama:777,claude:791 },{ chatgpt:793,gemini:802,llama:784,claude:798 },{ chatgpt:798,gemini:807,llama:788,claude:803 },{ chatgpt:804,gemini:813,llama:794,claude:809 },{ chatgpt:810,gemini:820,llama:800,claude:816 }],
    },
    // Overweight (over 50k lbs) — base + $400 surcharge
    'overweight': {
      'LA / LB Port, CA':  [{ chatgpt:868,gemini:880,llama:858,claude:873 },{ chatgpt:875,gemini:887,llama:865,claude:880 },{ chatgpt:882,gemini:894,llama:872,claude:887 },{ chatgpt:889,gemini:901,llama:879,claude:894 },{ chatgpt:897,gemini:909,llama:887,claude:902 },{ chatgpt:906,gemini:919,llama:895,claude:912 }],
      'Houston Port, TX':  [{ chatgpt:798,gemini:788,llama:808,claude:795 },{ chatgpt:805,gemini:795,llama:815,claude:802 },{ chatgpt:812,gemini:802,llama:822,claude:809 },{ chatgpt:817,gemini:807,llama:827,claude:814 },{ chatgpt:823,gemini:813,llama:834,claude:820 },{ chatgpt:830,gemini:820,llama:841,claude:827 }],
      'NY / NJ Port, NY':  [{ chatgpt:908,gemini:918,llama:899,claude:913 },{ chatgpt:915,gemini:925,llama:906,claude:920 },{ chatgpt:922,gemini:932,llama:913,claude:927 },{ chatgpt:929,gemini:939,llama:919,claude:934 },{ chatgpt:939,gemini:950,llama:929,claude:944 },{ chatgpt:950,gemini:962,llama:940,claude:956 }],
      'Savannah Port, GA': [{ chatgpt:748,gemini:757,llama:738,claude:752 },{ chatgpt:755,gemini:764,llama:745,claude:759 },{ chatgpt:762,gemini:771,llama:752,claude:766 },{ chatgpt:767,gemini:776,llama:757,claude:771 },{ chatgpt:773,gemini:782,llama:763,claude:777 },{ chatgpt:780,gemini:790,llama:770,claude:785 }],
      'Seattle Port, WA':  [{ chatgpt:829,gemini:839,llama:819,claude:834 },{ chatgpt:836,gemini:846,llama:826,claude:841 },{ chatgpt:843,gemini:853,llama:833,claude:848 },{ chatgpt:848,gemini:858,llama:838,claude:853 },{ chatgpt:854,gemini:865,llama:844,claude:860 },{ chatgpt:861,gemini:872,llama:851,claude:867 }],
    },
  },
  transloading: {
    // Palletized 20ft — $235 base per rate sheet — [Oct,Nov,Dec,Jan,Feb,Mar]
    'palletized-20ft': {
      'LA / LB Port, CA':  [{ chatgpt:232,gemini:236,llama:228,claude:234 },{ chatgpt:235,gemini:239,llama:231,claude:237 },{ chatgpt:238,gemini:242,llama:234,claude:240 },{ chatgpt:240,gemini:244,llama:236,claude:242 },{ chatgpt:242,gemini:247,llama:238,claude:244 },{ chatgpt:245,gemini:250,llama:240,claude:247 }],
      'Houston Port, TX':  [{ chatgpt:222,gemini:226,llama:218,claude:224 },{ chatgpt:225,gemini:229,llama:221,claude:227 },{ chatgpt:228,gemini:232,llama:224,claude:230 },{ chatgpt:230,gemini:234,llama:226,claude:232 },{ chatgpt:232,gemini:236,llama:228,claude:234 },{ chatgpt:235,gemini:239,llama:231,claude:237 }],
      'NY / NJ Port, NY':  [{ chatgpt:238,gemini:243,llama:234,claude:240 },{ chatgpt:241,gemini:246,llama:237,claude:243 },{ chatgpt:244,gemini:249,llama:240,claude:246 },{ chatgpt:246,gemini:251,llama:242,claude:248 },{ chatgpt:249,gemini:254,llama:245,claude:251 },{ chatgpt:252,gemini:258,llama:248,claude:254 }],
      'Savannah Port, GA': [{ chatgpt:216,gemini:220,llama:212,claude:218 },{ chatgpt:219,gemini:223,llama:215,claude:221 },{ chatgpt:222,gemini:226,llama:218,claude:224 },{ chatgpt:224,gemini:228,llama:220,claude:226 },{ chatgpt:226,gemini:230,llama:222,claude:228 },{ chatgpt:228,gemini:233,llama:224,claude:230 }],
    },
    // Palletized 40/45/53ft — $335 base per rate sheet
    'palletized-40ft': {
      'LA / LB Port, CA':  [{ chatgpt:330,gemini:336,llama:324,claude:332 },{ chatgpt:334,gemini:340,llama:328,claude:336 },{ chatgpt:338,gemini:344,llama:332,claude:340 },{ chatgpt:341,gemini:347,llama:335,claude:343 },{ chatgpt:345,gemini:351,llama:339,claude:347 },{ chatgpt:349,gemini:355,llama:343,claude:351 }],
      'Houston Port, TX':  [{ chatgpt:316,gemini:322,llama:310,claude:318 },{ chatgpt:320,gemini:326,llama:314,claude:322 },{ chatgpt:324,gemini:330,llama:318,claude:326 },{ chatgpt:327,gemini:333,llama:321,claude:329 },{ chatgpt:330,gemini:336,llama:324,claude:332 },{ chatgpt:333,gemini:339,llama:327,claude:335 }],
      'NY / NJ Port, NY':  [{ chatgpt:336,gemini:342,llama:330,claude:338 },{ chatgpt:340,gemini:346,llama:334,claude:342 },{ chatgpt:344,gemini:350,llama:338,claude:346 },{ chatgpt:347,gemini:353,llama:341,claude:349 },{ chatgpt:351,gemini:357,llama:345,claude:353 },{ chatgpt:355,gemini:362,llama:349,claude:358 }],
      'Savannah Port, GA': [{ chatgpt:310,gemini:316,llama:304,claude:312 },{ chatgpt:314,gemini:320,llama:308,claude:316 },{ chatgpt:318,gemini:324,llama:312,claude:320 },{ chatgpt:321,gemini:327,llama:315,claude:323 },{ chatgpt:324,gemini:330,llama:318,claude:326 },{ chatgpt:327,gemini:333,llama:321,claude:329 }],
    },
    // Loose cargo 20ft 500-1000 pcs — $170 base
    'loose-20ft-500-1000': {
      'LA / LB Port, CA':  [{ chatgpt:166,gemini:169,llama:163,claude:167 },{ chatgpt:169,gemini:172,llama:166,claude:170 },{ chatgpt:172,gemini:175,llama:169,claude:173 },{ chatgpt:173,gemini:176,llama:170,claude:174 },{ chatgpt:175,gemini:178,llama:172,claude:176 },{ chatgpt:177,gemini:180,llama:174,claude:178 }],
      'Houston Port, TX':  [{ chatgpt:159,gemini:162,llama:156,claude:160 },{ chatgpt:162,gemini:165,llama:159,claude:163 },{ chatgpt:165,gemini:168,llama:162,claude:166 },{ chatgpt:166,gemini:169,llama:163,claude:167 },{ chatgpt:168,gemini:171,llama:165,claude:169 },{ chatgpt:170,gemini:173,llama:167,claude:171 }],
      'NY / NJ Port, NY':  [{ chatgpt:170,gemini:173,llama:167,claude:171 },{ chatgpt:173,gemini:176,llama:170,claude:174 },{ chatgpt:176,gemini:179,llama:173,claude:177 },{ chatgpt:178,gemini:181,llama:175,claude:179 },{ chatgpt:180,gemini:183,llama:177,claude:181 },{ chatgpt:182,gemini:185,llama:179,claude:183 }],
      'Savannah Port, GA': [{ chatgpt:156,gemini:159,llama:153,claude:157 },{ chatgpt:159,gemini:162,llama:156,claude:160 },{ chatgpt:162,gemini:165,llama:159,claude:163 },{ chatgpt:163,gemini:166,llama:160,claude:164 },{ chatgpt:165,gemini:168,llama:162,claude:166 },{ chatgpt:167,gemini:170,llama:164,claude:168 }],
    },
    // Loose cargo 20ft 1000+ pcs — $230 base
    'loose-20ft-1000plus': {
      'LA / LB Port, CA':  [{ chatgpt:225,gemini:229,llama:221,claude:226 },{ chatgpt:229,gemini:233,llama:225,claude:230 },{ chatgpt:233,gemini:237,llama:229,claude:234 },{ chatgpt:235,gemini:239,llama:231,claude:236 },{ chatgpt:238,gemini:242,llama:234,claude:239 },{ chatgpt:241,gemini:245,llama:237,claude:242 }],
      'Houston Port, TX':  [{ chatgpt:216,gemini:220,llama:212,claude:217 },{ chatgpt:220,gemini:224,llama:216,claude:221 },{ chatgpt:224,gemini:228,llama:220,claude:225 },{ chatgpt:226,gemini:230,llama:222,claude:227 },{ chatgpt:228,gemini:232,llama:224,claude:229 },{ chatgpt:230,gemini:234,llama:226,claude:231 }],
      'NY / NJ Port, NY':  [{ chatgpt:230,gemini:234,llama:226,claude:231 },{ chatgpt:234,gemini:238,llama:230,claude:235 },{ chatgpt:238,gemini:242,llama:234,claude:239 },{ chatgpt:240,gemini:244,llama:236,claude:241 },{ chatgpt:243,gemini:247,llama:239,claude:244 },{ chatgpt:246,gemini:250,llama:242,claude:247 }],
      'Savannah Port, GA': [{ chatgpt:212,gemini:216,llama:208,claude:213 },{ chatgpt:216,gemini:220,llama:212,claude:217 },{ chatgpt:220,gemini:224,llama:216,claude:221 },{ chatgpt:222,gemini:226,llama:218,claude:223 },{ chatgpt:224,gemini:228,llama:220,claude:225 },{ chatgpt:226,gemini:230,llama:222,claude:227 }],
    },
    // Loose cargo 40/45/53ft 500-1000 pcs — $170 base
    'loose-40ft-500-1000': {
      'LA / LB Port, CA':  [{ chatgpt:168,gemini:171,llama:165,claude:169 },{ chatgpt:171,gemini:174,llama:168,claude:172 },{ chatgpt:174,gemini:177,llama:171,claude:175 },{ chatgpt:175,gemini:178,llama:172,claude:176 },{ chatgpt:177,gemini:180,llama:174,claude:178 },{ chatgpt:179,gemini:182,llama:176,claude:180 }],
      'Houston Port, TX':  [{ chatgpt:161,gemini:164,llama:158,claude:162 },{ chatgpt:164,gemini:167,llama:161,claude:165 },{ chatgpt:167,gemini:170,llama:164,claude:168 },{ chatgpt:168,gemini:171,llama:165,claude:169 },{ chatgpt:170,gemini:173,llama:167,claude:171 },{ chatgpt:172,gemini:175,llama:169,claude:173 }],
      'NY / NJ Port, NY':  [{ chatgpt:172,gemini:175,llama:169,claude:173 },{ chatgpt:175,gemini:178,llama:172,claude:176 },{ chatgpt:178,gemini:181,llama:175,claude:179 },{ chatgpt:180,gemini:183,llama:177,claude:181 },{ chatgpt:182,gemini:185,llama:179,claude:183 },{ chatgpt:184,gemini:187,llama:181,claude:185 }],
      'Savannah Port, GA': [{ chatgpt:158,gemini:161,llama:155,claude:159 },{ chatgpt:161,gemini:164,llama:158,claude:162 },{ chatgpt:164,gemini:167,llama:161,claude:165 },{ chatgpt:165,gemini:168,llama:162,claude:166 },{ chatgpt:167,gemini:170,llama:164,claude:168 },{ chatgpt:169,gemini:172,llama:166,claude:170 }],
    },
    // Loose cargo 40/45/53ft 1000+ pcs — $230 base
    'loose-40ft-1000plus': {
      'LA / LB Port, CA':  [{ chatgpt:227,gemini:231,llama:223,claude:228 },{ chatgpt:231,gemini:235,llama:227,claude:232 },{ chatgpt:235,gemini:239,llama:231,claude:236 },{ chatgpt:237,gemini:241,llama:233,claude:238 },{ chatgpt:240,gemini:244,llama:236,claude:241 },{ chatgpt:243,gemini:247,llama:239,claude:244 }],
      'Houston Port, TX':  [{ chatgpt:218,gemini:222,llama:214,claude:219 },{ chatgpt:222,gemini:226,llama:218,claude:223 },{ chatgpt:226,gemini:230,llama:222,claude:227 },{ chatgpt:228,gemini:232,llama:224,claude:229 },{ chatgpt:230,gemini:234,llama:226,claude:231 },{ chatgpt:232,gemini:236,llama:228,claude:233 }],
      'NY / NJ Port, NY':  [{ chatgpt:232,gemini:236,llama:228,claude:233 },{ chatgpt:236,gemini:240,llama:232,claude:237 },{ chatgpt:240,gemini:244,llama:236,claude:241 },{ chatgpt:242,gemini:246,llama:238,claude:243 },{ chatgpt:245,gemini:249,llama:241,claude:246 },{ chatgpt:248,gemini:252,llama:244,claude:249 }],
      'Savannah Port, GA': [{ chatgpt:214,gemini:218,llama:210,claude:215 },{ chatgpt:218,gemini:222,llama:214,claude:219 },{ chatgpt:222,gemini:226,llama:218,claude:223 },{ chatgpt:224,gemini:228,llama:220,claude:225 },{ chatgpt:226,gemini:230,llama:222,claude:227 },{ chatgpt:228,gemini:232,llama:224,claude:229 }],
    },
  },
  'last-mile': {
    // Light Truck (Sprinter/Box <12ft) — $1.25/mi × 50mi baseline — [Oct,Nov,Dec,Jan,Feb,Mar]
    'light-truck': {
      'LA Basin, CA':       [{ chatgpt:171,gemini:178,llama:165,claude:173 },{ chatgpt:174,gemini:181,llama:168,claude:176 },{ chatgpt:178,gemini:185,llama:172,claude:180 },{ chatgpt:180,gemini:187,llama:174,claude:182 },{ chatgpt:183,gemini:190,llama:177,claude:185 },{ chatgpt:186,gemini:193,llama:180,claude:188 }],
      'Houston Metro, TX':  [{ chatgpt:145,gemini:151,llama:140,claude:147 },{ chatgpt:148,gemini:154,llama:143,claude:150 },{ chatgpt:152,gemini:158,llama:147,claude:154 },{ chatgpt:154,gemini:160,llama:149,claude:156 },{ chatgpt:156,gemini:162,llama:151,claude:158 },{ chatgpt:158,gemini:164,llama:153,claude:160 }],
      'NYC Metro, NY':      [{ chatgpt:191,gemini:198,llama:185,claude:193 },{ chatgpt:194,gemini:201,llama:188,claude:196 },{ chatgpt:198,gemini:205,llama:192,claude:200 },{ chatgpt:200,gemini:207,llama:194,claude:202 },{ chatgpt:203,gemini:210,llama:197,claude:205 },{ chatgpt:206,gemini:213,llama:200,claude:208 }],
      'Atlanta Metro, GA':  [{ chatgpt:137,gemini:143,llama:132,claude:139 },{ chatgpt:140,gemini:146,llama:135,claude:142 },{ chatgpt:144,gemini:150,llama:139,claude:146 },{ chatgpt:146,gemini:152,llama:141,claude:148 },{ chatgpt:148,gemini:154,llama:143,claude:150 },{ chatgpt:150,gemini:156,llama:145,claude:152 }],
    },
    // Medium Truck (Straight 20-26ft) — $1.75/mi baseline
    'medium-truck': {
      'LA Basin, CA':       [{ chatgpt:240,gemini:250,llama:232,claude:244 },{ chatgpt:244,gemini:254,llama:236,claude:248 },{ chatgpt:248,gemini:258,llama:240,claude:252 },{ chatgpt:251,gemini:261,llama:243,claude:255 },{ chatgpt:255,gemini:265,llama:247,claude:259 },{ chatgpt:259,gemini:269,llama:251,claude:263 }],
      'Houston Metro, TX':  [{ chatgpt:204,gemini:212,llama:197,claude:207 },{ chatgpt:208,gemini:216,llama:201,claude:211 },{ chatgpt:212,gemini:220,llama:205,claude:215 },{ chatgpt:214,gemini:222,llama:207,claude:217 },{ chatgpt:217,gemini:225,llama:210,claude:220 },{ chatgpt:220,gemini:228,llama:213,claude:223 }],
      'NYC Metro, NY':      [{ chatgpt:266,gemini:276,llama:258,claude:270 },{ chatgpt:270,gemini:280,llama:262,claude:274 },{ chatgpt:274,gemini:284,llama:266,claude:278 },{ chatgpt:277,gemini:287,llama:269,claude:281 },{ chatgpt:281,gemini:291,llama:273,claude:285 },{ chatgpt:285,gemini:296,llama:277,claude:289 }],
      'Atlanta Metro, GA':  [{ chatgpt:190,gemini:198,llama:184,claude:193 },{ chatgpt:194,gemini:202,llama:188,claude:197 },{ chatgpt:198,gemini:206,llama:192,claude:201 },{ chatgpt:200,gemini:208,llama:194,claude:203 },{ chatgpt:203,gemini:211,llama:197,claude:206 },{ chatgpt:206,gemini:214,llama:200,claude:209 }],
    },
    // Heavy Truck (Semi 40-53ft) — $2.25/mi baseline
    'heavy-truck': {
      'LA Basin, CA':       [{ chatgpt:311,gemini:323,llama:301,claude:315 },{ chatgpt:315,gemini:327,llama:305,claude:319 },{ chatgpt:320,gemini:332,llama:310,claude:324 },{ chatgpt:324,gemini:336,llama:314,claude:328 },{ chatgpt:329,gemini:341,llama:319,claude:333 },{ chatgpt:334,gemini:347,llama:324,claude:338 }],
      'Houston Metro, TX':  [{ chatgpt:263,gemini:273,llama:255,claude:267 },{ chatgpt:267,gemini:277,llama:259,claude:271 },{ chatgpt:272,gemini:282,llama:264,claude:276 },{ chatgpt:275,gemini:285,llama:267,claude:279 },{ chatgpt:279,gemini:289,llama:271,claude:283 },{ chatgpt:283,gemini:293,llama:275,claude:287 }],
      'NYC Metro, NY':      [{ chatgpt:344,gemini:357,llama:333,claude:349 },{ chatgpt:348,gemini:361,llama:337,claude:353 },{ chatgpt:353,gemini:366,llama:342,claude:358 },{ chatgpt:357,gemini:370,llama:346,claude:362 },{ chatgpt:362,gemini:375,llama:351,claude:367 },{ chatgpt:367,gemini:381,llama:356,claude:372 }],
      'Atlanta Metro, GA':  [{ chatgpt:247,gemini:257,llama:239,claude:251 },{ chatgpt:251,gemini:261,llama:243,claude:255 },{ chatgpt:256,gemini:266,llama:248,claude:260 },{ chatgpt:259,gemini:269,llama:251,claude:263 },{ chatgpt:263,gemini:273,llama:255,claude:267 },{ chatgpt:267,gemini:277,llama:259,claude:271 }],
    },
    // Flatbed — $2.75/mi baseline
    'flatbed': {
      'LA Basin, CA':       [{ chatgpt:380,gemini:395,llama:368,claude:385 },{ chatgpt:385,gemini:400,llama:373,claude:390 },{ chatgpt:390,gemini:405,llama:378,claude:395 },{ chatgpt:395,gemini:410,llama:383,claude:400 },{ chatgpt:401,gemini:416,llama:389,claude:406 },{ chatgpt:407,gemini:422,llama:395,claude:412 }],
      'Houston Metro, TX':  [{ chatgpt:322,gemini:334,llama:311,claude:327 },{ chatgpt:327,gemini:339,llama:316,claude:332 },{ chatgpt:332,gemini:344,llama:321,claude:337 },{ chatgpt:336,gemini:348,llama:325,claude:341 },{ chatgpt:340,gemini:352,llama:329,claude:345 },{ chatgpt:344,gemini:357,llama:333,claude:349 }],
      'NYC Metro, NY':      [{ chatgpt:420,gemini:436,llama:407,claude:426 },{ chatgpt:425,gemini:441,llama:412,claude:431 },{ chatgpt:430,gemini:446,llama:417,claude:436 },{ chatgpt:435,gemini:451,llama:422,claude:441 },{ chatgpt:441,gemini:457,llama:428,claude:447 },{ chatgpt:447,gemini:464,llama:434,claude:453 }],
      'Atlanta Metro, GA':  [{ chatgpt:302,gemini:314,llama:292,claude:307 },{ chatgpt:307,gemini:319,llama:297,claude:312 },{ chatgpt:312,gemini:324,llama:302,claude:317 },{ chatgpt:315,gemini:327,llama:305,claude:320 },{ chatgpt:319,gemini:331,llama:309,claude:324 },{ chatgpt:323,gemini:335,llama:313,claude:328 }],
    },
    // Reefer (Temp Controlled) — Light Truck base + $0.30/mi
    'reefer': {
      'LA Basin, CA':       [{ chatgpt:217,gemini:225,llama:210,claude:220 },{ chatgpt:220,gemini:228,llama:213,claude:223 },{ chatgpt:224,gemini:232,llama:217,claude:227 },{ chatgpt:227,gemini:235,llama:220,claude:230 },{ chatgpt:230,gemini:238,llama:223,claude:233 },{ chatgpt:233,gemini:241,llama:226,claude:236 }],
      'Houston Metro, TX':  [{ chatgpt:185,gemini:192,llama:179,claude:188 },{ chatgpt:188,gemini:195,llama:182,claude:191 },{ chatgpt:192,gemini:199,llama:186,claude:195 },{ chatgpt:194,gemini:201,llama:188,claude:197 },{ chatgpt:197,gemini:204,llama:191,claude:200 },{ chatgpt:200,gemini:207,llama:194,claude:203 }],
      'NYC Metro, NY':      [{ chatgpt:241,gemini:250,llama:234,claude:245 },{ chatgpt:244,gemini:253,llama:237,claude:248 },{ chatgpt:248,gemini:257,llama:241,claude:252 },{ chatgpt:251,gemini:260,llama:244,claude:255 },{ chatgpt:255,gemini:264,llama:248,claude:259 },{ chatgpt:259,gemini:268,llama:252,claude:263 }],
      'Atlanta Metro, GA':  [{ chatgpt:175,gemini:182,llama:169,claude:178 },{ chatgpt:178,gemini:185,llama:172,claude:181 },{ chatgpt:182,gemini:189,llama:176,claude:185 },{ chatgpt:184,gemini:191,llama:178,claude:187 },{ chatgpt:187,gemini:194,llama:181,claude:190 },{ chatgpt:190,gemini:197,llama:184,claude:193 }],
    },
    // Hazmat — Medium Truck base + 20%
    'hazmat': {
      'LA Basin, CA':       [{ chatgpt:289,gemini:301,llama:279,claude:293 },{ chatgpt:293,gemini:305,llama:283,claude:297 },{ chatgpt:298,gemini:310,llama:288,claude:302 },{ chatgpt:301,gemini:313,llama:291,claude:305 },{ chatgpt:306,gemini:318,llama:296,claude:310 },{ chatgpt:311,gemini:323,llama:301,claude:315 }],
      'Houston Metro, TX':  [{ chatgpt:246,gemini:255,llama:237,claude:249 },{ chatgpt:250,gemini:259,llama:241,claude:253 },{ chatgpt:255,gemini:264,llama:246,claude:258 },{ chatgpt:257,gemini:266,llama:248,claude:260 },{ chatgpt:261,gemini:270,llama:252,claude:264 },{ chatgpt:265,gemini:274,llama:256,claude:268 }],
      'NYC Metro, NY':      [{ chatgpt:320,gemini:332,llama:310,claude:325 },{ chatgpt:324,gemini:336,llama:314,claude:329 },{ chatgpt:329,gemini:341,llama:319,claude:334 },{ chatgpt:333,gemini:345,llama:323,claude:338 },{ chatgpt:338,gemini:350,llama:328,claude:343 },{ chatgpt:343,gemini:356,llama:333,claude:348 }],
      'Atlanta Metro, GA':  [{ chatgpt:229,gemini:238,llama:221,claude:233 },{ chatgpt:233,gemini:242,llama:225,claude:237 },{ chatgpt:238,gemini:247,llama:230,claude:242 },{ chatgpt:240,gemini:249,llama:232,claude:244 },{ chatgpt:244,gemini:253,llama:236,claude:248 },{ chatgpt:248,gemini:257,llama:240,claude:252 }],
    },
    // Oversized/Overweight — Heavy Truck base + 25%
    'oversized': {
      'LA Basin, CA':       [{ chatgpt:390,gemini:405,llama:378,claude:395 },{ chatgpt:395,gemini:410,llama:383,claude:400 },{ chatgpt:400,gemini:415,llama:388,claude:405 },{ chatgpt:405,gemini:420,llama:393,claude:410 },{ chatgpt:412,gemini:427,llama:400,claude:417 },{ chatgpt:419,gemini:434,llama:407,claude:424 }],
      'Houston Metro, TX':  [{ chatgpt:331,gemini:344,llama:320,claude:336 },{ chatgpt:336,gemini:349,llama:325,claude:341 },{ chatgpt:341,gemini:354,llama:330,claude:346 },{ chatgpt:345,gemini:358,llama:334,claude:350 },{ chatgpt:350,gemini:363,llama:339,claude:355 },{ chatgpt:355,gemini:368,llama:344,claude:360 }],
      'NYC Metro, NY':      [{ chatgpt:432,gemini:448,llama:418,claude:438 },{ chatgpt:437,gemini:453,llama:423,claude:443 },{ chatgpt:442,gemini:458,llama:428,claude:448 },{ chatgpt:447,gemini:463,llama:433,claude:453 },{ chatgpt:454,gemini:470,llama:440,claude:460 },{ chatgpt:461,gemini:477,llama:447,claude:467 }],
      'Atlanta Metro, GA':  [{ chatgpt:311,gemini:323,llama:301,claude:316 },{ chatgpt:316,gemini:328,llama:306,claude:321 },{ chatgpt:321,gemini:333,llama:311,claude:326 },{ chatgpt:325,gemini:337,llama:315,claude:330 },{ chatgpt:330,gemini:342,llama:320,claude:335 },{ chatgpt:335,gemini:347,llama:325,claude:340 }],
    },
    // High-Value Cargo — Medium Truck + 20% + security
    'high-value': {
      'LA Basin, CA':       [{ chatgpt:289,gemini:301,llama:279,claude:293 },{ chatgpt:293,gemini:305,llama:283,claude:297 },{ chatgpt:298,gemini:310,llama:288,claude:302 },{ chatgpt:301,gemini:313,llama:291,claude:305 },{ chatgpt:305,gemini:317,llama:295,claude:309 },{ chatgpt:309,gemini:321,llama:299,claude:313 }],
      'Houston Metro, TX':  [{ chatgpt:246,gemini:255,llama:237,claude:249 },{ chatgpt:250,gemini:259,llama:241,claude:253 },{ chatgpt:255,gemini:264,llama:246,claude:258 },{ chatgpt:257,gemini:266,llama:248,claude:260 },{ chatgpt:261,gemini:270,llama:252,claude:264 },{ chatgpt:265,gemini:274,llama:256,claude:268 }],
      'NYC Metro, NY':      [{ chatgpt:320,gemini:332,llama:310,claude:325 },{ chatgpt:324,gemini:336,llama:314,claude:329 },{ chatgpt:329,gemini:341,llama:319,claude:334 },{ chatgpt:333,gemini:345,llama:323,claude:338 },{ chatgpt:337,gemini:349,llama:327,claude:342 },{ chatgpt:341,gemini:354,llama:331,claude:346 }],
      'Atlanta Metro, GA':  [{ chatgpt:229,gemini:238,llama:221,claude:233 },{ chatgpt:233,gemini:242,llama:225,claude:237 },{ chatgpt:238,gemini:247,llama:230,claude:242 },{ chatgpt:240,gemini:249,llama:232,claude:244 },{ chatgpt:244,gemini:253,llama:236,claude:248 },{ chatgpt:248,gemini:257,llama:240,claude:252 }],
    },
    // Tanker (Liquid Cargo) — $3.00/mi baseline + pump fees
    'tanker': {
      'LA Basin, CA':       [{ chatgpt:418,gemini:434,llama:405,claude:423 },{ chatgpt:423,gemini:439,llama:410,claude:428 },{ chatgpt:428,gemini:444,llama:415,claude:433 },{ chatgpt:433,gemini:449,llama:420,claude:438 },{ chatgpt:439,gemini:455,llama:426,claude:444 },{ chatgpt:445,gemini:461,llama:432,claude:450 }],
      'Houston Metro, TX':  [{ chatgpt:353,gemini:367,llama:342,claude:358 },{ chatgpt:358,gemini:372,llama:347,claude:363 },{ chatgpt:363,gemini:377,llama:352,claude:368 },{ chatgpt:367,gemini:381,llama:356,claude:372 },{ chatgpt:372,gemini:386,llama:361,claude:377 },{ chatgpt:377,gemini:391,llama:366,claude:382 }],
      'NYC Metro, NY':      [{ chatgpt:460,gemini:477,llama:446,claude:466 },{ chatgpt:465,gemini:482,llama:451,claude:471 },{ chatgpt:470,gemini:487,llama:456,claude:476 },{ chatgpt:475,gemini:492,llama:461,claude:481 },{ chatgpt:482,gemini:499,llama:468,claude:488 },{ chatgpt:489,gemini:506,llama:475,claude:495 }],
      'Atlanta Metro, GA':  [{ chatgpt:331,gemini:344,llama:320,claude:336 },{ chatgpt:336,gemini:349,llama:325,claude:341 },{ chatgpt:341,gemini:354,llama:330,claude:346 },{ chatgpt:345,gemini:358,llama:334,claude:350 },{ chatgpt:350,gemini:363,llama:339,claude:355 },{ chatgpt:355,gemini:368,llama:344,claude:360 }],
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

const LLM_LINES = [
  { key: 'chatgpt' as const, color: '#16a34a', label: 'ChatGPT' },
  { key: 'gemini'  as const, color: '#2563eb', label: 'Gemini'  },
  { key: 'llama'   as const, color: '#7c3aed', label: 'Llama'   },
  { key: 'claude'  as const, color: '#ea580c', label: 'Claude'  },
]

function LastMileChart({ ports }: { ports: Record<string, LLMRates[]> }) {
  const portNames = Object.keys(ports)
  const [selectedPort, setSelectedPort] = useState(portNames[0] ?? '')

  const series = ports[selectedPort] ?? []
  if (series.length === 0) return null

  const allVals = series.flatMap(r => [r.chatgpt, r.gemini, r.llama, r.claude,
    medianOf4(r.chatgpt, r.gemini, r.llama, r.claude)])
  const minVal = Math.floor(Math.min(...allVals) * 0.95)
  const maxVal = Math.ceil(Math.max(...allVals) * 1.05)

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
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block mx-auto" style={{ maxWidth: '100%' }}>
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
            <text key={m} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{m}</text>
          ))}

          {/* LLM lines */}
          {LLM_LINES.map(({ key, color }) => (
            <path key={key} d={buildPath(series.map(r => r[key]))}
              fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          ))}

          {/* Median line (bold dashed) */}
          <path d={buildPath(medians)} fill="none" stroke="#1e293b" strokeWidth="2.5"
            strokeDasharray="6 3" strokeLinejoin="round" />

          {/* Data points for median */}
          {medians.map((v, i) => (
            <circle key={i} cx={xPos(i)} cy={yPos(v)} r="3.5" fill="#1e293b" />
          ))}
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
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 rounded bg-slate-800" style={{ borderTop: '2px dashed #1e293b', background: 'none' }} />
          <span className="font-semibold text-[var(--color-text-1)]">Median</span>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-3)]">6-month rate trend · Oct 2024 – Mar 2025 · per trip (50-mile baseline)</p>
    </div>
  )
}

// ── Pricing Intelligence component ────────────────────────────────────────────

function PricingIntelligence() {
  const [service, setService] = useState<'drayage' | 'transloading' | 'last-mile'>('drayage')
  const [subType, setSubType] = useState('heavy')
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

      {/* Last Mile: SVG line chart (6-month trend) */}
      {service === 'last-mile' ? (
        <LastMileChart ports={ports} />
      ) : (
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
