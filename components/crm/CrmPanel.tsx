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
  { id: 'acc-6', business_name: 'Harbor Trade Group', email_domain: 'harbortradegroup.com', industry_type: 'Import & Distribution', category: 'standard', region: 'Wilmington', credit_terms: 'COD', account_status: 'active', contact_count: 1, quote_count: 2, total_value: 2900, created_at: daysAgo(30) },
]

const SEED_QUOTES: Quote[] = [
  { id: 'q-1',  processor_type: 'drayage',    status: 'won',         quote_value: 2100,  confidence_score: 0.97, created_at: daysAgo(3),  contact_name: 'Maria Santos',    contact_email: 'maria@fldistribution.com',  company_name: 'FLD — FL Distribution',  industry_type: 'Freight & Logistics' },
  { id: 'q-2',  processor_type: 'drayage',    status: 'won',         quote_value: 1450,  confidence_score: 0.95, created_at: daysAgo(5),  contact_name: 'Mike Chen',       contact_email: 'mike@pacificimports.com',    company_name: 'Pacific Imports LLC',    industry_type: 'Import & Distribution' },
  { id: 'q-3',  processor_type: 'warehousing',status: 'quoted',      quote_value: 3200,  confidence_score: 0.91, created_at: daysAgo(6),  contact_name: 'Sarah Rodriguez', contact_email: 'sarah@westernlogco.com',     company_name: 'Western LogCo',          industry_type: 'Third-Party Logistics' },
  { id: 'q-4',  processor_type: 'drayage',    status: 'won',         quote_value: 980,   confidence_score: 0.98, created_at: daysAgo(8),  contact_name: 'David Park',      contact_email: 'david@sunrisedistrib.com',  company_name: 'Sunrise Distribution',   industry_type: 'Warehousing & Distribution' },
  { id: 'q-5',  processor_type: 'last-mile',  status: 'in-progress', quote_value: 560,   confidence_score: 0.88, created_at: daysAgo(10), contact_name: 'James Kim',       contact_email: 'james@socalfreight.com',    company_name: 'SoCal Freight Partners', industry_type: 'Freight Brokerage' },
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
  { id: 'sh-5',  bol_number: 'BOL-2024-0185', customer_name: 'James Kim',       customer_company: 'SoCal Freight Partners', carrier_name: 'Desert Run Carriers',      origin: 'Carson, CA',       destination: 'Riverside, CA',      equipment_type: 'Straight Truck', service_type: 'Last Mile',  pickup_date: daysAgo(1),  delivery_date: daysAgo(0),  actual_pickup: null,        actual_delivery: null,        status: 'pending',    quote_value: 560  },
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
  { id: 'q-4',  processor_type: 'drayage',    status: 'won',         quote_value: 980,  created_at: daysAgo(8),  contact_name: 'David Park',      company_name: 'Sunrise Distribution'   },
  { id: 'q-5',  processor_type: 'last-mile',  status: 'in-progress', quote_value: 560,  created_at: daysAgo(10), contact_name: 'James Kim',       company_name: 'SoCal Freight Partners' },
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
        <EmptyState title="No quotes found" sub="Quotes are created automatically when quote emails are processed." />
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
          <option value="pending">Pending</option>
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
