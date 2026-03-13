const ARTIFACT_STYLES: Record<string, string> = {
  inbound: 'bg-gray-100 text-gray-600',
  preprocessed: 'bg-amber-50 text-amber-700',
  processed: 'bg-blue-50 text-blue-700',
  markdown: 'bg-violet-50 text-violet-700',
  html: 'bg-indigo-50 text-indigo-700',
  email_sent: 'bg-green-50 text-green-700',
}

export function ArtifactPill({ type }: { type: string }) {
  const style = ARTIFACT_STYLES[type] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${style}`}>
      {type.replace('_', ' ')}
    </span>
  )
}
