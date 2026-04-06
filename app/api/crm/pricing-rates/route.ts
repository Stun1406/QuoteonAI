import { NextRequest, NextResponse } from 'next/server'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RateRange { low: number; high: number }
type PortRates = Record<string, Record<string, RateRange>>

export interface ProviderResult {
  provider: 'openai' | 'gemini' | 'perplexity'
  model: string
  rates: PortRates | null
  reasoning: string
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  error: string | null
  latencyMs: number
}

export interface PricingRatesResponse {
  providers: ProviderResult[]
  median: PortRates
  portLabels: Record<string, string>
  meta: {
    service: string
    subType: string
    months: string[]
    projectedMonths: string[]
    fetchedAt: string
    successCount: number
    confidence: 'high' | 'medium' | 'low'
  }
}

// ── Port definitions ───────────────────────────────────────────────────────────

const DRAYAGE_PORTS: Record<string, string> = {
  la_lb_ca:    'LA / LB Port, CA',
  houston_tx:  'Houston Port, TX',
  ny_nj:       'NY / NJ Port, NY',
  savannah_ga: 'Savannah Port, GA',
  seattle_wa:  'Seattle Port, WA',
}

const TRANSLOADING_PORTS: Record<string, string> = {
  la_lb_ca:    'LA / LB Port, CA',
  houston_tx:  'Houston Port, TX',
  ny_nj:       'NY / NJ Port, NY',
  savannah_ga: 'Savannah Port, GA',
}

const LAST_MILE_PORTS: Record<string, string> = {
  la_basin_ca:       'LA Basin, CA',
  houston_metro_tx:  'Houston Metro, TX',
  nyc_metro_ny:      'NYC Metro, NY',
  atlanta_metro_ga:  'Atlanta Metro, GA',
}

function getPorts(service: string): Record<string, string> {
  if (service === 'transloading') return TRANSLOADING_PORTS
  if (service === 'last-mile') return LAST_MILE_PORTS
  return DRAYAGE_PORTS
}

// ── Service unit descriptions ──────────────────────────────────────────────────

const SERVICE_UNITS: Record<string, Record<string, string>> = {
  drayage: {
    '40ft':  'per 40ft container move, port to warehouse, all-in (fuel, chassis, pier pass)',
    '20ft':  'per 20ft container move, port to warehouse, all-in',
    '45ft':  'per 45ft/53ft container move, port to warehouse, all-in',
  },
  transloading: {
    'regular':     'per pallet per month, normal-size pallet, SoCal-style warehouse near port',
    'oversize':    'per oversize pallet per month, warehouse storage near port',
    'loose-cargo': 'per container handled, loose cargo (not palletized)',
  },
  'last-mile': {
    'straight-truck': 'per mile driven, straight truck, local last-mile delivery',
    'box-truck':      'per mile driven, box truck, local last-mile delivery',
    'sprinter':       'per mile driven, sprinter van, local last-mile delivery',
  },
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  service: string,
  subType: string,
  ports: Record<string, string>,
  months: string[],
  projectedMonths: Set<string>,
): string {
  const unit = SERVICE_UNITS[service]?.[subType] ?? `${service} ${subType}`
  const portLines = Object.entries(ports)
    .map(([id, label]) => `  "${id}": ${label}`)
    .join('\n')
  const monthLines = months
    .map(m => {
      const d = new Date(m + '-01')
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const tag = projectedMonths.has(m) ? '[FORECAST — project based on current trends]' : '[HISTORICAL — actual market rates]'
      return `  ${m} (${label}) ${tag}`
    })
    .join('\n')

  return `You are a freight logistics market rate analyst. Research current market rate data for US freight services.

SERVICE: ${service.toUpperCase()} — ${subType}
UNIT: ${unit}

PORTS / REGIONS (use these exact IDs as JSON keys):
${portLines}

TIME PERIODS (use YYYY-MM format as JSON keys):
${monthLines}

Provide your best rate range estimates for each port and month combination based on available market data, industry reports, DAT, Freightos, or other freight rate sources you can access.

Return ONLY a valid JSON object in this exact structure:
{
  "rates": {
    "<port_id>": {
      "<YYYY-MM>": { "low": <number>, "high": <number> }
    }
  },
  "reasoning": "<2-3 sentences on your data sources and how you estimated these rates>",
  "sources": ["<source name or URL>", ...]
}

Rules:
- All numbers are plain USD values (no $ signs, no commas, no units)
- Include ALL port IDs and ALL months — no omissions
- For forecasted months, base estimates on current trend trajectory
- If a specific port/month combination is uncertain, widen the range rather than omitting it
- Return only the JSON object, nothing else`
}

// ── JSON extractor ─────────────────────────────────────────────────────────────

function extractParsed(text: string): { rates: PortRates; reasoning: string; sources: string[] } | null {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!parsed.rates || typeof parsed.rates !== 'object') return null
    return {
      rates: parsed.rates as PortRates,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    }
  } catch {
    return null
  }
}

// ── LLM callers ────────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string): Promise<ProviderResult> {
  const t0 = Date.now()
  const model = 'gpt-4o-mini'
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1400,
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? ''
    const parsed = extractParsed(text)
    if (!parsed) throw new Error('Could not parse JSON from response')

    return {
      provider: 'openai', model,
      rates: parsed.rates,
      reasoning: parsed.reasoning,
      sources: parsed.sources,
      confidence: 'medium',
      error: null,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      provider: 'openai', model,
      rates: null, reasoning: '', sources: [],
      confidence: 'low',
      error: err instanceof Error ? err.message : 'Failed',
      latencyMs: Date.now() - t0,
    }
  }
}

async function callGemini(prompt: string): Promise<ProviderResult> {
  const t0 = Date.now()
  const model = 'gemini-2.0-flash'
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1400 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    )

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Pull Google Search grounding citations
    const groundingChunks: Array<{ web?: { uri?: string; title?: string } }> =
      data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
    const groundingSources = groundingChunks
      .map(c => c.web?.title ?? c.web?.uri ?? '')
      .filter(Boolean)
      .slice(0, 5)

    const parsed = extractParsed(text)
    if (!parsed) throw new Error('Could not parse JSON from response')

    return {
      provider: 'gemini', model,
      rates: parsed.rates,
      reasoning: parsed.reasoning,
      sources: [...groundingSources, ...parsed.sources].slice(0, 6),
      confidence: 'medium',
      error: null,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      provider: 'gemini', model,
      rates: null, reasoning: '', sources: [],
      confidence: 'low',
      error: err instanceof Error ? err.message : 'Failed',
      latencyMs: Date.now() - t0,
    }
  }
}

async function callPerplexity(prompt: string): Promise<ProviderResult> {
  const t0 = Date.now()
  const model = 'sonar'
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY not configured')

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1400,
        return_citations: true,
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) throw new Error(`Perplexity HTTP ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? ''
    const citations: string[] = data.citations ?? []
    const parsed = extractParsed(text)
    if (!parsed) throw new Error('Could not parse JSON from response')

    return {
      provider: 'perplexity', model,
      rates: parsed.rates,
      reasoning: parsed.reasoning,
      sources: [...citations, ...parsed.sources].slice(0, 6),
      confidence: 'medium',
      error: null,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      provider: 'perplexity', model,
      rates: null, reasoning: '', sources: [],
      confidence: 'low',
      error: err instanceof Error ? err.message : 'Failed',
      latencyMs: Date.now() - t0,
    }
  }
}

// ── Median merge ───────────────────────────────────────────────────────────────

function med(vals: number[]): number {
  if (!vals.length) return 0
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m]
}

function buildMedian(results: ProviderResult[], portIds: string[], months: string[]): PortRates {
  const ok = results.filter(r => r.rates !== null)
  const out: PortRates = {}
  for (const port of portIds) {
    out[port] = {}
    for (const month of months) {
      const lows = ok.map(r => r.rates![port]?.[month]?.low).filter((v): v is number => typeof v === 'number')
      const highs = ok.map(r => r.rates![port]?.[month]?.high).filter((v): v is number => typeof v === 'number')
      out[port][month] = { low: med(lows), high: med(highs) }
    }
  }
  return out
}

function calcConfidence(results: ProviderResult[], portIds: string[], months: string[]): 'high' | 'medium' | 'low' {
  const ok = results.filter(r => r.rates !== null)
  if (ok.length < 2) return 'low'
  let totalSpread = 0, count = 0
  for (const port of portIds) {
    for (const month of months) {
      const mids = ok.map(r => {
        const range = r.rates![port]?.[month]
        return range ? (range.low + range.high) / 2 : null
      }).filter((v): v is number => v !== null)
      if (mids.length >= 2) {
        const avg = mids.reduce((a, b) => a + b, 0) / mids.length
        if (avg > 0) { totalSpread += (Math.max(...mids) - Math.min(...mids)) / avg; count++ }
      }
    }
  }
  const avg = count > 0 ? totalSpread / count : 1
  return avg < 0.1 ? 'high' : avg < 0.25 ? 'medium' : 'low'
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      service: string
      subType: string
      months: string[]
      projectedMonths: string[]
    }
    const { service, subType, months, projectedMonths = [] } = body

    if (!service || !subType || !months?.length) {
      return NextResponse.json({ error: 'service, subType, and months are required' }, { status: 400 })
    }

    const ports = getPorts(service)
    const portIds = Object.keys(ports)
    const projectedSet = new Set(projectedMonths)
    const prompt = buildPrompt(service, subType, ports, months, projectedSet)

    const [openaiResult, geminiResult, perplexityResult] = await Promise.all([
      callOpenAI(prompt),
      callGemini(prompt),
      callPerplexity(prompt),
    ])

    const all = [openaiResult, geminiResult, perplexityResult]
    const successCount = all.filter(r => r.rates !== null).length
    const confidence = calcConfidence(all, portIds, months)
    all.forEach(r => { if (r.rates) r.confidence = confidence })

    return NextResponse.json({
      providers: all,
      median: buildMedian(all, portIds, months),
      portLabels: ports,
      meta: { service, subType, months, projectedMonths, fetchedAt: new Date().toISOString(), successCount, confidence },
    } satisfies PricingRatesResponse)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
