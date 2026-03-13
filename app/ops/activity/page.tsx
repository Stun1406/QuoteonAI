import { getTenantProjectContext } from '@/lib/db/context'
import { getActivityFeed, getActivityFeedStats } from '@/lib/db/queries/activity-feed'
import { ActivityTable } from '@/components/ops/ActivityTable'

export default async function ActivityPage() {
  let threads: Awaited<ReturnType<typeof getActivityFeed>> = []
  let stats = { total: 0, totalQuoteValue: 0, avgProcessingTimeMs: 0, totalTokens: 0 }

  try {
    const { tenantId } = getTenantProjectContext()
    ;[threads, stats] = await Promise.all([
      getActivityFeed(tenantId, 200),
      getActivityFeedStats(tenantId),
    ])
  } catch (e) {
    console.error('Activity page error:', e)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Activity Stream</h1>
        <p className="text-sm text-gray-500 mt-0.5">All processed email threads</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Threads', value: stats.total.toLocaleString() },
          { label: 'Total Quote Value', value: stats.totalQuoteValue > 0 ? `$${stats.totalQuoteValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' },
          { label: 'Avg Processing', value: stats.avgProcessingTimeMs > 0 ? `${(stats.avgProcessingTimeMs / 1000).toFixed(1)}s` : '—' },
          { label: 'Total Tokens', value: stats.totalTokens > 0 ? stats.totalTokens.toLocaleString() : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
            <div className="text-lg font-semibold text-gray-900 font-mono mt-1">{value}</div>
          </div>
        ))}
      </div>

      <ActivityTable threads={threads} />
    </div>
  )
}
