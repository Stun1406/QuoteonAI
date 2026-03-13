import Link from 'next/link'

export default function OpsPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Operations Center</h1>
        <p className="text-sm text-gray-500 mt-0.5">FL Distribution</p>
      </div>

      {/* Quoton agent panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Quoton</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">AI Agent</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-[11px] text-gray-500">Active</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Quoton automatically processes inbound customer emails — extracting contact info, classifying intent, calculating prices from the rate sheet, and sending professional quote responses.
            </p>
            <Link
              href="/ops/activity"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              View Activity Stream →
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href="/ops/activity" className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors block">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Activity Stream</div>
          <div className="text-sm text-gray-700">View all processed email threads, quotes, and pipeline artifacts.</div>
          <div className="text-xs text-blue-600 mt-3">View →</div>
        </Link>
        <div className="bg-white border border-gray-200 rounded-lg p-5 opacity-60">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Win/Loss Tracker</div>
          <div className="text-sm text-gray-500">Track quote outcomes and revenue performance.</div>
          <div className="text-xs text-gray-400 mt-3">Coming soon</div>
        </div>
      </div>

      {/* Customer leaderboard placeholder */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-4">Customer Leaderboard</div>
        <p className="text-sm text-gray-400 text-center py-6">Customer rankings coming soon</p>
      </div>
    </div>
  )
}
