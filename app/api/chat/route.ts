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
  'regular': 'regular', 'standard': 'regular', 'regular container': 'regular',
  'oversize': 'oversize', 'over-size': 'oversize', 'large': 'oversize',
  'loose': 'loose-cargo', 'loose cargo': 'loose-cargo', 'bulk': 'loose-cargo',
  'straight': 'straight-truck', 'straight truck': 'straight-truck', 'straight-truck': 'straight-truck',
  'box': 'box-truck', 'box truck': 'box-truck', 'box-truck': 'box-truck',
  'sprinter': 'sprinter', 'van': 'sprinter', 'sprinter van': 'sprinter',
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are QuoteonAI's customer support assistant. Your name is "Quoty". You help customers understand the platform and generate instant freight quotes.

QuoteonAI is an AI-powered freight logistics platform offering:

1. **Drayage** — Port-to-warehouse container moves. Container sizes: 20ft, 40ft, or 45ft. Pricing is all-in (fuel surcharge, chassis, pier pass). Available ports: LA/LB Port CA, Houston Port TX, NY/NJ Port NY, Savannah Port GA, Seattle Port WA.

2. **Transloading** — Container unloading and warehouse storage near port. Types: Regular Container, Oversize Container, or Loose Cargo. Priced per pallet/month (regular/oversize) or per container (loose). Available ports: LA/LB Port CA, Houston Port TX, NY/NJ Port NY, Savannah Port GA.

3. **Last Mile** — Local delivery from warehouse to final destination. Vehicle types: Straight Truck, Box Truck, or Sprinter Van. Priced per trip. Regions: LA Basin CA, Houston Metro TX, NYC Metro NY, Atlanta Metro GA.

When a customer wants a quote, collect this information conversationally (one or two questions at a time):
1. Service type (drayage, transloading, or last-mile)
2. Port or region (see per-service notes below)
3. Container/vehicle type (be specific — offer options if unsure)
4. Quantity (number of containers, pallets, or trips)
5. Customer's full name
6. Customer's email address

Per-service field guidance — IMPORTANT:
- Drayage: needs the PORT of origin (e.g. LA/LB, Houston, NY/NJ, Savannah, Seattle). No destination city needed — we deliver to any warehouse.
- Transloading: needs the PORT/WAREHOUSE location only. Do NOT ask for a destination city — transloading is warehouse work at the port location.
- Last Mile: needs the METRO REGION for delivery (LA Basin CA, Houston Metro TX, NYC Metro NY, Atlanta Metro GA).

Once you have ALL 6 items confirmed, call the generate_quote function immediately — do not ask for confirmation first.

General rules:
- Keep replies short (2-4 sentences). Be warm, professional, and efficient.
- If asked general questions about pricing, give rough ranges but say exact quotes are generated based on specifics.
- Never invent or estimate rates in conversation — always use generate_quote for official numbers.
- If customer input is ambiguous (e.g. "LA" for last-mile), ask whether they mean the port or the metro region.`

// ── Tool definition ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_quote',
      description: 'Generate and email a freight quote to the customer. Call this only once ALL required fields are confirmed.',
      parameters: {
        type: 'object',
        properties: {
          customer_name:  { type: 'string', description: 'Full name of the customer' },
          customer_email: { type: 'string', description: 'Email address to send the quote to' },
          service:        { type: 'string', enum: ['drayage', 'transloading', 'last-mile'] },
          sub_type:       { type: 'string', description: 'e.g. 40ft, 20ft, 45ft, regular, oversize, loose-cargo, straight-truck, box-truck, sprinter' },
          port:           { type: 'string', description: 'Port or region name as provided by the customer' },
          quantity:       { type: 'number', description: 'Number of containers, pallets, or trips' },
          quantity_unit:  { type: 'string', description: 'containers, pallets, or trips' },
        },
        required: ['customer_name', 'customer_email', 'service', 'sub_type', 'port', 'quantity', 'quantity_unit'],
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
  quantity: number
  quantity_unit: string
}

async function handleGenerateQuote(args: QuoteArgs) {
  // Normalize sub_type and port
  const subTypeKey = SUBTYPE_MAP[args.sub_type.toLowerCase()] ?? args.sub_type.toLowerCase().replace(/\s+/g, '-')
  const portKey = PORT_MAP[args.port.toLowerCase()] ?? args.port

  const serviceRates = RATES[args.service]?.[subTypeKey]
  const baseRate = serviceRates?.[portKey] ?? serviceRates?.[Object.keys(serviceRates ?? {})[0]] ?? 400

  const subtotal = Math.round(baseRate * args.quantity)
  const fuelSurcharge = args.service === 'drayage' ? Math.round(subtotal * 0.12) : 0
  const portFees = args.service === 'drayage' ? Math.round(subtotal * 0.08) : 0
  const total = subtotal + fuelSurcharge + portFees

  const quoteId = `Q-${Date.now().toString(36).toUpperCase()}`
  const serviceLabel = args.service === 'last-mile' ? 'Last Mile' : args.service.charAt(0).toUpperCase() + args.service.slice(1)
  const unitSingular = args.quantity_unit.replace(/s$/, '')

  const quote = {
    id: quoteId,
    customer_name: args.customer_name,
    customer_email: args.customer_email,
    service: args.service,
    service_label: serviceLabel,
    sub_type: subTypeKey,
    port: portKey || args.port,
    quantity: args.quantity,
    quantity_unit: args.quantity_unit,
    base_rate: baseRate,
    subtotal,
    fuel_surcharge: fuelSurcharge,
    port_fees: portFees,
    total,
    valid_days: 30,
  }

  // Fire-and-forget: send email + create inbox thread record
  sendQuoteEmail(quote, unitSingular).catch(e => console.error('[chat email]', e))
  createInboxRecord(quote).catch(e => console.error('[chat inbox]', e))

  const lines = [
    `I've generated your quote and sent it to **${args.customer_email}**! Here's a summary:`,
    '',
    `**Quote ${quoteId}**`,
    `• Service: ${serviceLabel} — ${args.sub_type}`,
    `• Port / Region: ${quote.port}`,
    `• Quantity: ${args.quantity} ${args.quantity_unit}`,
    `• Base rate: $${baseRate.toLocaleString()} per ${unitSingular}`,
    ...(fuelSurcharge ? [`• Fuel surcharge: $${fuelSurcharge.toLocaleString()}`] : []),
    ...(portFees ? [`• Port fees: $${portFees.toLocaleString()}`] : []),
    `• **Total: $${total.toLocaleString()}**`,
    '',
    `We have sent the quote to your inbox. Please **reply to that email** to confirm you'd like to move forward — our team will proceed once we receive your confirmation.`,
  ]

  return { message: lines.join('\n'), quote }
}

async function createInboxRecord(quote: {
  id: string; customer_name: string; customer_email: string
  service: string; service_label: string; sub_type: string; port: string
  quantity: number; quantity_unit: string; base_rate: number
  subtotal: number; fuel_surcharge: number; port_fees: number; total: number
}) {
  try {
    const tenantId = process.env.TENANT_ID
    const projectId = process.env.PROJECT_ID
    if (!tenantId || !projectId) return

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
        port: quote.port,
        quantity: quote.quantity,
        quantityUnit: quote.quantity_unit,
        baseRate: quote.base_rate,
        subtotal: quote.subtotal,
        fuelSurcharge: quote.fuel_surcharge,
        portFees: quote.port_fees,
        total: quote.total,
        source: 'chatbot',
        status: 'awaiting-confirmation',
      },
    })
  } catch {
    // Silently fail — inbox is secondary to the customer email
  }
}

async function sendQuoteEmail(quote: {
  id: string; customer_name: string; customer_email: string
  service_label: string; sub_type: string; port: string
  quantity: number; quantity_unit: string; base_rate: number
  subtotal: number; fuel_surcharge: number; port_fees: number; total: number; valid_days: number
}, unitSingular: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:0}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.hdr{background:#1e40af;padding:28px 32px}
.hdr h1{color:#fff;margin:0;font-size:20px;font-weight:700}
.hdr p{color:#bfdbfe;margin:4px 0 0;font-size:13px}
.body{padding:28px 32px}
.qid{font-size:12px;color:#64748b;margin-bottom:16px}
.intro{font-size:15px;color:#1e293b;margin:0 0 22px}
.sec-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 10px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.row:last-child{border-bottom:none}
.lbl{color:#64748b}.val{font-weight:500;color:#1e293b}
.total-box{background:#f8fafc;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;margin-top:14px}
.total-lbl{font-weight:600;color:#1e293b;font-size:15px}
.total-val{font-weight:700;color:#1e40af;font-size:20px}
.badge{display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;font-weight:500;padding:4px 12px;border-radius:20px;margin-top:18px}
.ftr{padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0}
.ftr p{font-size:12px;color:#94a3b8;margin:0}
</style></head>
<body><div class="wrap">
  <div class="hdr"><h1>Your Freight Quote is Ready</h1><p>QuoteonAI · AI-Powered Logistics</p></div>
  <div class="body">
    <p class="qid">Quote ID: <strong>${quote.id}</strong></p>
    <p class="intro">Hi ${quote.customer_name}, here is your freight quote from QuoteonAI.</p>
    <p class="sec-title">Service Details</p>
    <div class="row"><span class="lbl">Service</span><span class="val">${quote.service_label} — ${quote.sub_type}</span></div>
    <div class="row"><span class="lbl">Port / Region</span><span class="val">${quote.port}</span></div>
    <div class="row" style="margin-bottom:20px"><span class="lbl">Quantity</span><span class="val">${quote.quantity} ${quote.quantity_unit}</span></div>
    <p class="sec-title" style="margin-top:20px">Pricing Breakdown</p>
    <div class="row"><span class="lbl">Base rate (${quote.quantity} × $${quote.base_rate.toLocaleString()} per ${unitSingular})</span><span class="val">$${quote.subtotal.toLocaleString()}</span></div>
    ${quote.fuel_surcharge ? `<div class="row"><span class="lbl">Fuel surcharge (12%)</span><span class="val">$${quote.fuel_surcharge.toLocaleString()}</span></div>` : ''}
    ${quote.port_fees ? `<div class="row"><span class="lbl">Port fees (8%)</span><span class="val">$${quote.port_fees.toLocaleString()}</span></div>` : ''}
    <div class="total-box"><span class="total-lbl">Total</span><span class="total-val">$${quote.total.toLocaleString()}</span></div>
    <span class="badge">Valid for ${quote.valid_days} days</span>
  </div>
  <div class="ftr">
    <p>This quote was generated by QuoteonAI. For questions, reply to this email or contact our team.</p>
    <p style="margin-top:8px">© ${new Date().getFullYear()} QuoteonAI. All rights reserved.</p>
  </div>
</div></body></html>`

  await sendEmail({
    to: quote.customer_email,
    subject: `Your QuoteonAI Freight Quote — ${quote.id}`,
    html,
    text: `Hi ${quote.customer_name},\n\nHere is your freight quote from QuoteonAI.\n\nQuote ID: ${quote.id}\nService: ${quote.service_label} — ${quote.sub_type}\nPort: ${quote.port}\nQuantity: ${quote.quantity} ${quote.quantity_unit}\nBase rate: $${quote.base_rate.toLocaleString()} per ${unitSingular}\n${quote.fuel_surcharge ? `Fuel surcharge: $${quote.fuel_surcharge.toLocaleString()}\n` : ''}${quote.port_fees ? `Port fees: $${quote.port_fees.toLocaleString()}\n` : ''}Total: $${quote.total.toLocaleString()}\n\nValid for ${quote.valid_days} days.\n\nThank you for using QuoteonAI.`,
  })
}
