'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ActivityFeedRow } from '@/lib/db/queries/activity-feed'
import { IntentBadge, FwdBadge, StatusPill } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ops/EmptyState'

type SortKey = 'created_at' | 'tokens_total' | 'quote_value' | 'processing_time_ms'
type SortDir = 'asc' | 'desc'

function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }
}

function formatCurrency(v: number | null) {
  if (v == null) return '—'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMs(ms: number | null) {
  if (ms == null) return '—'
  return (ms / 1000).toFixed(1) + 's'
}

const PAGE_SIZE = 50

interface ActivityTableProps {
  threads: ActivityFeedRow[]
}

export function ActivityTable({ threads: initialThreads }: ActivityTableProps) {
  const router = useRouter()
  const [threads, setThreads] = useState(initialThreads)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000)
    return () => clearInterval(interval)
  }, [router])

  useEffect(() => {
    setThreads(initialThreads)
  }, [initialThreads])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sorted = [...threads].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <th
      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => handleSort(sortField)}
    >
      {label} {sortKey === sortField ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  if (threads.length === 0) {
    return <EmptyState title="No threads yet" description="Processed emails will appear here." />
  }

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <SortHeader label="Received" sortField="created_at" />
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intent</th>
              <SortHeader label="Tokens" sortField="tokens_total" />
              <SortHeader label="Quote" sortField="quote_value" />
              <SortHeader label="Time" sortField="processing_time_ms" />
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(row => {
              const { date, time } = formatDate(row.created_at)
              return (
                <tr
                  key={row.id}
                  className="bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-75"
                  onClick={() => router.push(`/ops/threads/${row.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-gray-700">{date}</div>
                    <div className="font-mono text-xs text-gray-400">{time}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 text-sm">{row.contact_name ?? '—'}</div>
                    <div className="text-xs text-gray-500">{row.company_name ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-500">{row.contact_email ?? '—'}</span>
                      {row.is_forwarded && <FwdBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <IntentBadge intent={row.intent} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{row.tokens_total?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{formatCurrency(row.quote_value)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{formatMs(row.processing_time_ms)}</td>
                  <td className="px-4 py-3"><StatusPill status={row.status ?? 'open'} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-gray-200 rounded text-xs disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-gray-200 rounded text-xs disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
