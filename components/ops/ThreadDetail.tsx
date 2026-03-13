'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ThreadDetailResult } from '@/lib/db/queries/thread-detail'
import { IntentBadge, FwdBadge, TierBadge, StatusPill } from '@/components/ui/Badge'
import { ArtifactPill } from '@/components/ui/ArtifactPill'

function formatCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="text-[11px] text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function DrayageLineItems({ data }: { data: Record<string, unknown> }) {
  const responseData = (data as { responseData?: { type?: string; quote?: { lineItems?: Array<{ code: string; description: string; amount: number }>; subtotal?: number; city?: string; containerSize?: string } } }).responseData
  if (responseData?.type !== 'drayage' || !responseData.quote) return null
  const { lineItems, subtotal, city, containerSize } = responseData.quote
  return (
    <div className="mt-2">
      <div className="text-xs text-gray-500 mb-1.5">Destination: <strong>{city}</strong> · Container: <strong>{containerSize}ft</strong></div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1 font-medium text-gray-500">Code</th>
            <th className="text-left py-1 font-medium text-gray-500">Description</th>
            <th className="text-right py-1 font-medium text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems?.map(item => (
            <tr key={item.code} className="border-b border-gray-100">
              <td className="py-1 font-mono text-gray-600">{item.code}</td>
              <td className="py-1 text-gray-700">{item.description}</td>
              <td className="py-1 text-right font-mono text-gray-700">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="py-1.5 font-semibold text-gray-700 text-right">Subtotal</td>
            <td className="py-1.5 font-mono font-semibold text-gray-900 text-right">{formatCurrency(subtotal ?? 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ArtifactContent({ artifact }: { artifact: { artifact_type: string; artifact_data: Record<string, unknown> } }) {
  const [showRaw, setShowRaw] = useState(false)
  const data = artifact.artifact_data

  if (showRaw) {
    return (
      <div>
        <pre className="text-xs font-mono bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-80 whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
        <button onClick={() => setShowRaw(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">Hide JSON</button>
      </div>
    )
  }

  switch (artifact.artifact_type) {
    case 'inbound': {
      const msg = (data as { rawMessage?: string }).rawMessage ?? ''
      return (
        <div>
          <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap font-mono overflow-auto max-h-60">{msg}</pre>
          <div className="mt-2 flex gap-2">
            <CopyButton text={msg} />
            <button onClick={() => setShowRaw(true)} className="text-[11px] text-gray-400 hover:text-gray-600">View JSON</button>
          </div>
        </div>
      )
    }
    case 'preprocessed': {
      const contact = (data as { contactInfo?: Record<string, string | null> }).contactInfo
      const intent = (data as { intent?: string }).intent
      const confidence = (data as { confidence?: number }).confidence ?? 0
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Intent:</span>
            <IntentBadge intent={intent ?? 'other'} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Confidence:</span>
            <div className="flex-1 max-w-32 bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${confidence * 100}%` }}></div>
            </div>
            <span className="text-xs font-mono text-gray-600">{(confidence * 100).toFixed(0)}%</span>
          </div>
          {contact && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              {Object.entries(contact).filter(([,v]) => v).map(([k, v]) => (
                <div key={k}><span className="text-gray-500">{k}:</span> <span className="text-gray-800">{String(v)}</span></div>
              ))}
            </div>
          )}
          <button onClick={() => setShowRaw(true)} className="text-[11px] text-gray-400 hover:text-gray-600">View JSON</button>
        </div>
      )
    }
    case 'processed': {
      const processorType = (data as { processorType?: string }).processorType
      return (
        <div>
          <div className="text-xs text-gray-500 mb-2">Processor: <strong>{processorType}</strong></div>
          {processorType === 'drayage' && <DrayageLineItems data={data as Record<string, unknown>} />}
          <div className="mt-2 flex gap-2">
            <button onClick={() => setShowRaw(true)} className="text-[11px] text-gray-400 hover:text-gray-600">View JSON</button>
          </div>
        </div>
      )
    }
    case 'markdown': {
      const content = (data as { content?: string }).content ?? ''
      return (
        <div>
          <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap font-mono overflow-auto max-h-80">{content}</pre>
          <div className="mt-2 flex gap-2">
            <CopyButton text={content} />
            <button onClick={() => setShowRaw(true)} className="text-[11px] text-gray-400 hover:text-gray-600">View JSON</button>
          </div>
        </div>
      )
    }
    case 'html': {
      const htmlContent = (data as { content?: string }).content ?? ''
      return (
        <div>
          <iframe
            srcDoc={htmlContent}
            className="w-full border border-gray-200 rounded"
            style={{ height: '300px' }}
            sandbox="allow-same-origin"
            title="Email preview"
          />
          <div className="mt-2 flex gap-2">
            <CopyButton text={htmlContent} />
            <button onClick={() => setShowRaw(true)} className="text-[11px] text-gray-400 hover:text-gray-600">View JSON</button>
          </div>
        </div>
      )
    }
    case 'email_sent': {
      const recipient = (data as { to?: string }).to ?? ''
      const sentAt = (data as { sentAt?: string }).sentAt ?? ''
      return (
        <div className="text-xs space-y-1">
          <div><span className="text-gray-500">Recipient:</span> <span className="font-mono text-gray-700">{recipient}</span></div>
          {sentAt && <div><span className="text-gray-500">Sent at:</span> <span className="font-mono text-gray-700">{formatTs(sentAt)}</span></div>}
          <button onClick={() => setShowRaw(true)} className="text-[11px] text-gray-400 hover:text-gray-600 mt-1">View JSON</button>
        </div>
      )
    }
    default:
      return (
        <div>
          <pre className="text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )
  }
}

function ArtifactCard({ artifact, index }: { artifact: ThreadDetailResult['artifacts'][0]; index: number }) {
  const [expanded, setExpanded] = useState(index < 2)

  return (
    <div className="relative pl-8">
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200"></div>
      {/* Timeline dot */}
      <div className="absolute left-2 top-4 w-2 h-2 rounded-full bg-white border-2 border-gray-300"></div>

      <div className="bg-white border border-gray-200 rounded-lg mb-3">
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="text-xs font-mono text-gray-400 w-5 text-center">{index + 1}</span>
          <ArtifactPill type={artifact.artifact_type} />
          <span className="font-mono text-xs text-gray-400 ml-auto">{formatTs(artifact.created_at)}</span>
          <span className="text-gray-400 text-xs ml-2">{expanded ? '▲' : '▼'}</span>
        </div>
        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <ArtifactContent artifact={artifact} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ThreadDetail({ detail }: { detail: ThreadDetailResult }) {
  const { thread, contact, company, artifacts, llmCalls } = detail
  const tier = (thread as { metadata?: { customerTier?: string } }).metadata?.customerTier ?? 'unranked'

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
        <Link href="/ops/activity" className="hover:text-gray-700">Activity</Link>
        <span>›</span>
        <span className="font-mono">{thread.thread_id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-700 text-sm font-semibold">{getInitials(contact?.name ?? null)}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{contact?.name ?? 'Unknown'}</span>
            <span className="text-sm text-gray-500">{company?.business_name ?? ''}</span>
            <IntentBadge intent={thread.intent} />
            {thread.is_forwarded && <FwdBadge />}
            <StatusPill status={thread.status ?? 'open'} />
            <TierBadge tier={tier} />
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">{formatTs(thread.created_at)}</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-gray-500">Quote Value</div>
          <div className="text-lg font-semibold font-mono text-gray-900 mt-1">
            {thread.quote_value ? formatCurrency(Number(thread.quote_value)) : '—'}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-gray-500">Processing Time</div>
          <div className="text-lg font-semibold font-mono text-gray-900 mt-1">
            {thread.processing_time_ms ? `${(thread.processing_time_ms / 1000).toFixed(1)}s` : '—'}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-gray-500">Total Tokens</div>
          <div className="text-lg font-semibold font-mono text-gray-900 mt-1">
            {thread.tokens_total?.toLocaleString() ?? '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Artifact timeline */}
        <div className="col-span-2">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-4">
            Artifact Timeline ({artifacts.length})
          </div>
          <div className="relative">
            {artifacts.map((artifact, i) => (
              <ArtifactCard key={artifact.id} artifact={artifact} index={i} />
            ))}
            {artifacts.length === 0 && (
              <div className="text-sm text-gray-400">No artifacts yet.</div>
            )}
          </div>

          {/* LLM Calls */}
          {llmCalls.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
                LLM Calls ({llmCalls.length})
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Stage</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Prompt</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Completion</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Total</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {llmCalls.map(call => (
                      <tr key={call.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-mono text-gray-600">{call.call_type}</td>
                        <td className="px-3 py-2 text-gray-500">{call.call_stage}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600">{call.prompt_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600">{call.completion_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-gray-700">{call.total_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{call.response_time_ms ? `${(call.response_time_ms / 1000).toFixed(1)}s` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Contact panel */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Contact</div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-xs">
            {contact?.name && <div><span className="text-gray-500">Name:</span> <span className="text-gray-800 font-medium">{contact.name}</span></div>}
            {contact?.email && <div><span className="text-gray-500">Email:</span> <span className="font-mono text-gray-700">{contact.email}</span></div>}
            {contact?.phone && <div><span className="text-gray-500">Phone:</span> <span className="font-mono text-gray-700">{contact.phone}</span></div>}
            {contact?.title && <div><span className="text-gray-500">Title:</span> <span className="text-gray-700">{contact.title}</span></div>}
            {company?.business_name && (
              <>
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <span className="text-gray-500">Company:</span> <span className="text-gray-800 font-medium">{company.business_name}</span>
                </div>
                {company.email_domain && <div><span className="text-gray-500">Domain:</span> <span className="font-mono text-gray-600">{company.email_domain}</span></div>}
              </>
            )}
            {!contact && <div className="text-gray-400">No contact info</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
