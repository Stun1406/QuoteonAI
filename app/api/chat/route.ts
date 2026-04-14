import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { createMessageThread, generateThreadId } from '@/lib/db/tables/thread'
import { addArtifactToThread } from '@/lib/db/services/thread-service'

// ── Base rates (midpoint of static data) ──────────────────────────────────────

const RATES: Record<string, Record<string, Record<string, number>>> = {
  drayage: {
    '40ft': {
      'LA / LB Port, CA': 502, 'Houston Port, TX': 424,
      'NY / NJ Port, NY': 541, 'Savannah Port, GA': 375, 'Seattle Port, WA': 453,
    },
    '20ft': {
      'LA / LB Port, CA': 377, 'Houston Port, TX': 318,
      'NY / NJ Port, NY': 405, 'Savannah Port, GA': 281, 'Seattle Port, WA': 340,
    },
    '45ft': {
      'LA / LB Port, CA': 578, 'Houston Port, TX': 485,
      'NY / NJ Port, NY': 622, 'Savannah Port, GA': 431, 'Seattle Port, WA': 522,
    },
  },
  transloading: {
    'regular':     { 'LA / LB Port, CA': 15, 'Houston Port, TX': 12, 'NY / NJ Port, NY': 17, 'Savannah Port, GA': 12 },
    'oversize':    { 'LA / LB Port, CA': 23, 'Houston Port, TX': 19, 'NY / NJ Port, NY': 26, 'Savannah Port, GA': 17 },
    'loose-cargo': { 'LA / LB Port, CA': 497, 'Houston Port, TX': 431, 'NY / NJ Port, NY': 549, 'Savannah Port, GA': 391 },
  },
  'last-mile': {
    'straight-truck': { 'LA Basin, CA': 436, 'Houston Metro, TX': 370, 'NYC Metro, NY': 493, 'Atlanta Metro, GA': 350 },
    'box-truck':      { 'LA Basin, CA': 325, 'Houston Metro, TX': 282, 'NYC Metro, NY': 363, 'Atlanta Metro, GA': 266 },
    'sprinter':       { 'LA Basin, CA': 226, 'Houston Metro, TX': 195, 'NYC Metro, NY': 252, 'Atlanta Metro, GA': 183 },
  },
}

const PORT_MAP: Record<string, string> = {
  'la': 'LA / LB Port, CA', 'los angeles': 'LA / LB Port, CA', 'long beach': 'LA / LB Port, CA',
  'la/lb': 'LA / LB Port, CA', 'la lb': 'LA / LB Port, CA', 'southern california': 'LA / LB Port, CA',
  'houston': 'Houston Port, TX', 'texas': 'Houston Port, TX', 'tx': 'Houston Port, TX',
  'new york': 'NY / NJ Port, NY', 'ny': 'NY / NJ Port, NY', 'nj': 'NY / NJ Port, NY',
  'new jersey': 'NY / NJ Port, NY', 'ny/nj': 'NY / NJ Port, NY', 'east coast': 'NY / NJ Port, NY',
  'savannah': 'Savannah Port, GA', 'georgia': 'Savannah Port, GA', 'ga': 'Savannah Port, GA',
  'seattle': 'Seattle Port, WA', 'washington': 'Seattle Port, WA', 'wa': 'Seattle Port, WA', 'pacific northwest': 'Seattle Port, WA',
  // last-mile regions
  'la basin': 'LA Basin, CA', 'los angeles basin': 'LA Basin, CA', 'la metro': 'LA Basin, CA',
  'houston metro': 'Houston Metro, TX', 'houston area': 'Houston Metro, TX',
  'nyc': 'NYC Metro, NY', 'new york city': 'NYC Metro, NY', 'nyc metro': 'NYC Metro, NY',
  'atlanta': 'Atlanta Metro, GA', 'atlanta metro': 'Atlanta Metro, GA',
}

const SUBTYPE_MAP: Record<string, string> = {
  '40': '40ft', '40ft': '40ft', '40 ft': '40ft', 'forty': '40ft',
  '20': '20ft', '20ft': '20ft', '20 ft': '20ft', 'twenty': '20ft',
  '45': '45ft', '45ft': '45ft', '53': '45ft', '53ft': '45ft',
  'regular container (20\')': 'regular',
  'regular container (40\')': 'regular',
  'oversize container (20\')': 'oversize',
  'oversize container (40\')': 'oversize',
  'loose cargo (20\')': 'loose-cargo',
  'loose cargo (40\')': 'loose-cargo',
  'regular': 'regular', 'standard': 'regular', 'regular container': 'regular',
  'oversize': 'oversize', 'over-size': 'oversize', 'large': 'oversize',
  'loose': 'loose-cargo', 'loose cargo': 'loose-cargo', 'bulk': 'loose-cargo',
  'straight': 'straight-truck', 'straight truck': 'straight-truck', 'straight-truck': 'straight-truck',
  'box': 'box-truck', 'box truck': 'box-truck', 'box-truck': 'box-truck',
  'sprinter': 'sprinter', 'van': 'sprinter', 'sprinter van': 'sprinter',
}

function formatQuotedSubtype(service: string, subType: string): string {
  const key = SUBTYPE_MAP[subType.toLowerCase()] ?? subType.toLowerCase()

  if (service === 'transloading') {
    if (key === 'regular') return 'Regular Container'
    if (key === 'oversize') return 'Oversize Container'
    if (key === 'loose-cargo') return 'Loose Cargo'
  }

  if (service === 'drayage') {
    if (key === '20ft') return "Regular Container (20')"
    if (key === '40ft') return "Regular Container (40')"
    if (key === '45ft') return "Regular Container (45'/53')"
  }

  if (service === 'last-mile') {
    if (key === 'straight-truck') return 'Straight Truck'
    if (key === 'box-truck') return 'Box Truck'
    if (key === 'sprinter') return 'Sprinter Van'
  }

  return subType
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are QuoteonAI's customer support assistant. Your name is "Quoty". You help customers understand the platform and generate freight quotes in a polished, professional way.

QuoteonAI service guidance:
1. Drayage: port-to-destination container moves. Offer clear cargo options such as Regular Container (20'), Regular Container (40'), and Regular Container (45'/53').
2. Transloading: warehouse unload / palletization work. Offer clear cargo options such as Regular Container (20'), Regular Container (40'), Oversize Container (20'), Oversize Container (40'), Loose Cargo (20'), and Loose Cargo (40').
3. Last Mile: local final delivery. Vehicle options are Straight Truck, Box Truck, or Sprinter Van.

Conversation rules:
- Ask one clear question at a time unless you are listing customer options.
- Do not ask for the customer's name or email until AFTER you summarize the request and the customer confirms it is correct.
- After the customer confirms the recap, ask for their full name and best email address.
- Only call generate_quote after the customer has confirmed the recap and provided their contact details.
- Keep the tone warm, courteous, and professional.

Transloading flow:
1. Ask for the port / warehouse location.
2. Ask which cargo option they need, using the exact labels with size in brackets.
3. Ask: "How many containers do you need for the transloading service?"
4. Then ask: "How many pallets do you need for the transloading service?"
5. Then courteously ask whether they need add-on services such as shrink wrap, BOL, and seal.
6. Summarize the full request clearly and ask the customer to confirm it.
7. After confirmation, ask for full name and email.

Drayage flow:
1. Ask for the port of origin.
2. Ask which cargo option / container size they need, using explicit size labels in brackets.
3. After container size is selected, ask for the container weight and offer options such as Regular (up to 43K lbs), Heavy, and Very Heavy.
4. Ask for the end destination city, for example Carson or Ontario.
5. Courteously ask whether they need additional elements such as TCF, prepaid pier pass, chassis split, or similar accessorials.
6. Summarize the full request clearly and ask the customer to confirm it.
7. After confirmation, ask for full name and email.

Last Mile flow:
1. Ask for the metro region.
2. Immediately after that, ask for the end destination city.
3. Ask which vehicle type they need, and present all options: Straight Truck, Box Truck, or Sprinter Van.
4. Ask for special conditions such as reefer, hazmat, or oversize handling.
5. Courteously ask whether they need additional services such as insurance.
6. Ask for the number of trips.
7. Summarize the full request clearly and ask the customer to confirm it.
8. After confirmation, ask for full name and email.

General rules:
- If a customer asks broad pricing questions, give only high-level guidance and explain that final pricing is sent after details are confirmed.
- Never invent unofficial exact rates in conversation. Use generate_quote for the final quote.
- If something is ambiguous, ask a short clarifying question.
- In the confirmation recap, include every key detail the customer has provided so far.
- After the quote is generated, thank the customer and ask them to review the email and reply with their confirmation or any revisions.`

// ── Tool definition ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_quote',
      description: 'Generate and email a freight quote to the customer. Call this only after the customer has confirmed the summarized request and provided full contact details.',
      parameters: {
        type: 'object',
        properties: {
          customer_name:  { type: 'string', description: 'Full name of the customer' },
          customer_email: { type: 'string', description: 'Email address to send the quote to' },
          service:        { type: 'string', enum: ['drayage', 'transloading', 'last-mile'] },
          sub_type:       { type: 'string', description: "Customer-facing cargo or vehicle type, such as Regular Container (20'), Regular Container (40'), Loose Cargo (20'), Straight Truck, Box Truck, or Sprinter Van" },
          port:           { type: 'string', description: 'Port or region name as provided by the customer' },
          destination_city: { type: 'string', description: 'Destination city for drayage or last mile, if provided' },
          container_weight: { type: 'string', description: 'Container weight selection or note for drayage, if provided' },
          quantity:       { type: 'number', description: 'Primary billable quantity used for the quote' },
          quantity_unit:  { type: 'string', description: 'containers, pallets, or trips' },
          container_count: { type: 'number', description: 'Number of containers requested, if applicable' },
          pallet_count:   { type: 'number', description: 'Number of pallets requested, if applicable' },
          add_on_services: { type: 'array', items: { type: 'string' }, description: 'Requested add-on or accessorial services such as shrink wrap, BOL, seal, TCF, prepaid pier pass, chassis split, or insurance' },
          special_conditions: { type: 'array', items: { type: 'string' }, description: 'Special handling notes such as reefer, hazmat, or oversize' },
          customer_confirmed: { type: 'boolean', description: 'True only if the customer explicitly confirmed the summarized request before the function was called' },
        },
        required: ['customer_name', 'customer_email', 'service', 'sub_type', 'port', 'quantity', 'quantity_unit', 'customer_confirmed'],
      },
    },
  },
]

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: { role: string; content: string }[] }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ content: 'Chat is not configured yet. Please contact support.' })
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const data = await res.json()
    const choice = data.choices?.[0]

    // Tool call → generate quote + send email
    if (choice?.finish_reason === 'tool_calls') {
      const call = choice.message?.tool_calls?.[0]
      if (call?.function?.name === 'generate_quote') {
        const args = JSON.parse(call.function.arguments)
        const result = await handleGenerateQuote(args)
        return NextResponse.json({ content: result.message, quote: result.quote })
      }
    }

    return NextResponse.json({ content: choice?.message?.content ?? 'Sorry, I could not process that.' })
  } catch (err) {
    console.error('[chat]', err)
    return NextResponse.json({ content: 'Something went wrong. Please try again.' })
  }
}

// ── Quote generation ───────────────────────────────────────────────────────────

interface QuoteArgs {
  customer_name: string
  customer_email: string
  service: string
  sub_type: string
  port: string
  destination_city?: string
  container_weight?: string
  quantity: number
  quantity_unit: string
  container_count?: number
  pallet_count?: number
  add_on_services?: string[]
  special_conditions?: string[]
  customer_confirmed: boolean
}

function cleanList(values?: string[]): string[] {
  return (values ?? [])
    .map(v => v.trim())
    .filter(Boolean)
}

function formatServiceLabel(service: string): string {
  return service === 'last-mile' ? 'Last Mile' : service.charAt(0).toUpperCase() + service.slice(1)
}

function buildRequestSummary(quote: {
  service: string
  sub_type_label: string
  port: string
  destination_city?: string
  container_weight?: string
  quantity: number
  quantity_unit: string
  container_count?: number
  pallet_count?: number
  add_on_services: string[]
  special_conditions: string[]
}): string[] {
  const details = [
    `Service: ${formatServiceLabel(quote.service)}`,
    `Cargo / Vehicle: ${quote.sub_type_label}`,
    `Port / Region: ${quote.port}`,
    quote.destination_city ? `Destination city: ${quote.destination_city}` : '',
    quote.container_weight ? `Container weight: ${quote.container_weight}` : '',
    quote.container_count != null ? `Containers: ${quote.container_count}` : '',
    quote.pallet_count != null ? `Pallets: ${quote.pallet_count}` : '',
    `Billable quantity: ${quote.quantity} ${quote.quantity_unit}`,
    quote.special_conditions.length > 0 ? `Special conditions: ${quote.special_conditions.join(', ')}` : '',
    quote.add_on_services.length > 0 ? `Add-on services: ${quote.add_on_services.join(', ')}` : '',
  ]

  return details.filter(Boolean)
}

async function handleGenerateQuote(args: QuoteArgs) {
  if (!args.customer_confirmed) {
    return {
      message: 'Please confirm the summarized request details first, and then I can prepare and email the quote.',
      quote: null,
    }
  }

  // Normalize sub_type and port
  const subTypeKey = SUBTYPE_MAP[args.sub_type.toLowerCase()] ?? args.sub_type.toLowerCase().replace(/\s+/g, '-')
  const portKey = PORT_MAP[args.port.toLowerCase()] ?? args.port
  const subTypeLabel = formatQuotedSubtype(args.service, args.sub_type)
  const addOnServices = cleanList(args.add_on_services)
  const specialConditions = cleanList(args.special_conditions)

  const serviceRates = RATES[args.service]?.[subTypeKey]
  const baseRate = serviceRates?.[portKey] ?? serviceRates?.[Object.keys(serviceRates ?? {})[0]] ?? 400

  const subtotal = Math.round(baseRate * args.quantity)
  const fuelSurcharge = args.service === 'drayage' ? Math.round(subtotal * 0.12) : 0
  const portFees = args.service === 'drayage' ? Math.round(subtotal * 0.08) : 0
  const total = subtotal + fuelSurcharge + portFees

  const quoteId = `Q-${Date.now().toString(36).toUpperCase()}`
  const serviceLabel = formatServiceLabel(args.service)
  const unitSingular = args.quantity_unit.replace(/s$/, '')

  const quote = {
    id: quoteId,
    customer_name: args.customer_name,
    customer_email: args.customer_email,
    service: args.service,
    service_label: serviceLabel,
    sub_type: subTypeKey,
    sub_type_label: subTypeLabel,
    port: portKey || args.port,
    destination_city: args.destination_city?.trim() || '',
    container_weight: args.container_weight?.trim() || '',
    quantity: args.quantity,
    quantity_unit: args.quantity_unit,
    container_count: args.container_count,
    pallet_count: args.pallet_count,
    add_on_services: addOnServices,
    special_conditions: specialConditions,
    base_rate: baseRate,
    subtotal,
    fuel_surcharge: fuelSurcharge,
    port_fees: portFees,
    total,
    valid_days: 30,
  }

  // Send email and create inbox thread (get thread ID back)
  const [threadId] = await Promise.all([
    createInboxRecord(quote).catch(e => { console.error('[chat inbox]', e); return null }),
    sendQuoteEmail(quote, unitSingular).catch(e => console.error('[chat email]', e)),
  ])

  const requestSummary = buildRequestSummary(quote)

  const lines = [
    `Thank you, ${args.customer_name}! Your quote has been prepared and sent to **${args.customer_email}**.`,
    '',
    `**Quote Reference: ${quoteId}**`,
    threadId ? `**Thread ID: ${threadId}**` : '',
    '',
    `**Request Summary:**`,
    ...requestSummary.map(line => `- ${line}`),
    '',
    `**Pricing Breakdown:**`,
    `- Base rate: $${baseRate.toLocaleString()} per ${unitSingular}`,
    ...(fuelSurcharge ? [`- Fuel surcharge (12%): $${fuelSurcharge.toLocaleString()}`] : []),
    ...(portFees ? [`- Port fees (8%): $${portFees.toLocaleString()}`] : []),
    `- **Total: $${total.toLocaleString()}**`,
    '',
    `A detailed quote has been sent to your email. Please review and reply with your **confirmation**, or let us know if you'd like any **revisions**. We look forward to supporting your shipment!`,
  ].filter(line => line !== null)

  return { message: lines.join('\n'), quote: { ...quote, thread_id: threadId } }
}

async function createInboxRecord(quote: {
  id: string; customer_name: string; customer_email: string
  service: string; service_label: string; sub_type: string; port: string
  quantity: number; quantity_unit: string; base_rate: number
  subtotal: number; fuel_surcharge: number; port_fees: number; total: number
}): Promise<string | null> {
  try {
    const tenantId = process.env.TENANT_ID
    const projectId = process.env.PROJECT_ID
    if (!tenantId || !projectId) return null

    const threadId = generateThreadId()
    const thread = await createMessageThread({
      tenantId,
      projectId,
      threadId,
      intent: quote.service,
      processorType: quote.service,
      confidenceScore: 1.0,
    })

    await addArtifactToThread({
      threadId: thread.id,
      tenantId,
      projectId,
      type: 'chatbot-quote',
      data: {
        quoteId: quote.id,
        customerName: quote.customer_name,
        customerEmail: quote.customer_email,
        service: quote.service,
        serviceLabel: quote.service_label,
        subType: quote.sub_type,
        subTypeLabel: (quote as { sub_type_label?: string }).sub_type_label,
        port: quote.port,
        destinationCity: (quote as { destination_city?: string }).destination_city,
        containerWeight: (quote as { container_weight?: string }).container_weight,
        quantity: quote.quantity,
        quantityUnit: quote.quantity_unit,
        containerCount: (quote as { container_count?: number }).container_count,
        palletCount: (quote as { pallet_count?: number }).pallet_count,
        addOnServices: (quote as { add_on_services?: string[] }).add_on_services,
        specialConditions: (quote as { special_conditions?: string[] }).special_conditions,
        baseRate: quote.base_rate,
        subtotal: quote.subtotal,
        fuelSurcharge: quote.fuel_surcharge,
        portFees: quote.port_fees,
        total: quote.total,
        source: 'chatbot',
        status: 'awaiting-confirmation',
      },
    })

    return threadId
  } catch {
    // Silently fail — inbox is secondary to the customer email
    return null
  }
}

async function sendQuoteEmail(quote: {
  id: string; customer_name: string; customer_email: string
  service: string; service_label: string; sub_type: string; sub_type_label: string; port: string
  destination_city: string; container_weight: string
  quantity: number; quantity_unit: string; container_count?: number; pallet_count?: number
  add_on_services: string[]; special_conditions: string[]
  base_rate: number; subtotal: number; fuel_surcharge: number; port_fees: number; total: number; valid_days: number
}, unitSingular: string) {
  const requestSummary = buildRequestSummary(quote)
  const summaryRows = requestSummary
    .map(line => {
      const colonIdx = line.indexOf(':')
      const lbl = colonIdx > -1 ? line.slice(0, colonIdx).trim() : 'Detail'
      const val = colonIdx > -1 ? line.slice(colonIdx + 1).trim() : line
      return `<div class="row"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`
    })
    .join('')

  const serviceIcon = quote.service === 'drayage' ? '🚢' : quote.service === 'transloading' ? '🏭' : '🚚'

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;margin:0;padding:24px 0}
.wrap{max-width:660px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.1)}
.hdr{background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%);padding:32px 36px}
.hdr-top{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.hdr-icon{width:44px;height:44px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}
.hdr h1{color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:-.3px}
.hdr-sub{color:#bfdbfe;font-size:13px;margin:0}
.qid-bar{background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 36px;display:flex;align-items:center;gap:16px}
.qid-bar span{font-size:12px;color:#3b82f6;font-weight:600;font-family:monospace}
.qid-bar .sep{color:#bfdbfe}
.body{padding:30px 36px}
.greeting{font-size:16px;color:#0f172a;margin:0 0 6px;font-weight:600}
.intro-text{font-size:14px;color:#475569;line-height:1.7;margin:0 0 28px}
.section{margin-bottom:24px}
.sec-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8}
.sec-line{flex:1;height:1px;background:#e2e8f0}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
.row{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:13.5px}
.row:last-child{border-bottom:none}
.lbl{color:#64748b;font-weight:400;min-width:130px}
.val{font-weight:600;color:#0f172a;text-align:right}
.pricing-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
.p-row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #e2e8f0;font-size:13.5px}
.p-row:last-child{border-bottom:none}
.p-lbl{color:#64748b}.p-val{font-weight:500;color:#1e293b}
.total-box{background:linear-gradient(135deg,#1e3a8a,#1d4ed8);border-radius:12px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:16px}
.total-lbl{font-weight:600;color:#bfdbfe;font-size:14px}
.total-val{font-weight:800;color:#fff;font-size:26px;letter-spacing:-.5px}
.validity{display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#15803d;font-size:12px;font-weight:600;padding:5px 14px;border-radius:999px;margin-top:14px}
.cta-box{margin-top:24px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px}
.cta-title{font-size:14px;font-weight:700;color:#92400e;margin:0 0 6px}
.cta-text{font-size:13px;color:#78350f;line-height:1.6;margin:0}
.ftr{padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center}
.ftr p{font-size:12px;color:#94a3b8;margin:0 0 4px}
</style></head>
<body><div class="wrap">
  <div class="hdr">
    <div class="hdr-top">
      <div class="hdr-icon">${serviceIcon}</div>
      <div>
        <h1>Freight Quote Ready — ${quote.service_label}</h1>
        <p class="hdr-sub">QuoteonAI &nbsp;|&nbsp; Professional Logistics Quoting Platform</p>
      </div>
    </div>
  </div>

  <div class="qid-bar">
    <span>Quote: ${quote.id}</span>
    <span class="sep">|</span>
    <span>Service: ${quote.service_label}</span>
    <span class="sep">|</span>
    <span>Valid: ${quote.valid_days} days</span>
  </div>

  <div class="body">
    <p class="greeting">Hi ${quote.customer_name},</p>
    <p class="intro-text">
      Thank you for choosing QuoteonAI. Your freight quote has been prepared and is outlined below. Please review the full details and pricing breakdown, then reply to confirm or request any adjustments.
    </p>

    <div class="section">
      <div class="sec-header"><span class="sec-title">Request Summary</span><div class="sec-line"></div></div>
      <div class="card">${summaryRows}</div>
    </div>

    <div class="section">
      <div class="sec-header"><span class="sec-title">Pricing Breakdown</span><div class="sec-line"></div></div>
      <div class="pricing-card">
        <div class="p-row"><span class="p-lbl">Base rate</span><span class="p-val">$${quote.base_rate.toLocaleString()} per ${unitSingular}</span></div>
        <div class="p-row"><span class="p-lbl">Billable quantity</span><span class="p-val">${quote.quantity} ${quote.quantity_unit}</span></div>
        <div class="p-row"><span class="p-lbl">Subtotal</span><span class="p-val">$${quote.subtotal.toLocaleString()}</span></div>
        ${quote.fuel_surcharge ? `<div class="p-row"><span class="p-lbl">Fuel surcharge (12%)</span><span class="p-val">$${quote.fuel_surcharge.toLocaleString()}</span></div>` : ''}
        ${quote.port_fees ? `<div class="p-row"><span class="p-lbl">Port fees (8%)</span><span class="p-val">$${quote.port_fees.toLocaleString()}</span></div>` : ''}
      </div>
      <div class="total-box">
        <span class="total-lbl">Total Quote Amount</span>
        <span class="total-val">$${quote.total.toLocaleString()}</span>
      </div>
      <div><span class="validity">&#10003; Valid for ${quote.valid_days} days from today</span></div>
    </div>

    <div class="cta-box">
      <p class="cta-title">Next Steps</p>
      <p class="cta-text">
        Please <strong>reply to this email</strong> with one of the following:
        <br>&#10003; <strong>Confirm</strong> — to accept this quote and proceed with booking
        <br>&#9998; <strong>Request Revision</strong> — if you need changes to scope or services
        <br>&#10007; <strong>Decline</strong> — if you are not proceeding at this time
      </p>
    </div>
  </div>

  <div class="ftr">
    <p>This quote was prepared by QuoteonAI on behalf of FL Distribution.</p>
    <p>Please respond directly to this email. &copy; ${new Date().getFullYear()} QuoteonAI. All rights reserved.</p>
  </div>
</div></body></html>`

  const text = [
    `Hi ${quote.customer_name},`,
    '',
    'Thank you for reaching out. Please find your quote below.',
    '',
    `Quote ID: ${quote.id}`,
    '',
    'Request Summary:',
    ...requestSummary.map(line => `- ${line}`),
    '',
    'Pricing Breakdown:',
    `- Base rate: $${quote.base_rate.toLocaleString()} per ${unitSingular}`,
    `- Billable quantity: ${quote.quantity} ${quote.quantity_unit}`,
    `- Subtotal: $${quote.subtotal.toLocaleString()}`,
    ...(quote.fuel_surcharge ? [`- Fuel surcharge: $${quote.fuel_surcharge.toLocaleString()}`] : []),
    ...(quote.port_fees ? [`- Port fees: $${quote.port_fees.toLocaleString()}`] : []),
    `- Total Quote: $${quote.total.toLocaleString()}`,
    '',
    `This quote is valid for ${quote.valid_days} days.`,
    '',
    'Thank you for the opportunity to support your shipment. Please reply to this email with your confirmation or let us know if you would like any revisions to the quoted scope.',
  ].join('\n')

  await sendEmail({
    to: quote.customer_email,
    subject: `Your QuoteonAI Freight Quote - ${quote.id}`,
    html,
    text,
  })
}
