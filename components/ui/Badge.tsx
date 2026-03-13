import type { MessageIntent } from '@/lib/types/preprocessor'

const INTENT_STYLES: Record<string, string> = {
  drayage: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  warehousing: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
  transloading: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
  'last-mile': 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
  hybrid: 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200',
  'general-inquiry': 'bg-green-100 text-green-800 ring-1 ring-green-200',
  complaint: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  other: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

const TIER_STYLES: Record<string, string> = {
  unranked: 'bg-gray-100 text-gray-600',
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
}

interface BadgeProps {
  intent?: string
  tier?: string
  label?: string
  className?: string
}

export function IntentBadge({ intent, className = '' }: { intent: string; className?: string }) {
  const style = INTENT_STYLES[intent] ?? INTENT_STYLES.other
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${style} ${className}`}>
      {intent}
    </span>
  )
}

export function TierBadge({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.unranked
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${style}`}>
      {tier}
    </span>
  )
}

export function FwdBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 ring-1 ring-gray-200">
      FWD
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    won: 'bg-green-50 text-green-700',
    lost: 'bg-red-50 text-red-700',
    stale: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${styles[status] ?? styles.open}`}>
      {status}
    </span>
  )
}
