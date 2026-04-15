import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { createMessageThread, generateThreadId, updateThreadProcessorType } from '@/lib/db/tables/thread'
import { addArtifactToThread } from '@/lib/db/services/thread-service'
import { createEmailThread, insertEmailMessage, normalizeSubject } from '@/lib/db/tables/email-thread'
import { textToHtml } from '@/lib/llm/formatter'
import { formatCurrency } from '@/lib/utils/currency'

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
    // Preserve the container size from the original label, e.g. "Regular Container (40')"
    const sizeMatch = subType.match(/\((\d+)'?\)/)
    const sizeSuffix = sizeMatch ? ` (${sizeMatch[1]}')` : ''
    if (key === 'regular') return `Regular Container${sizeSuffix}`
    if (key === 'oversize') return `Oversize Container${sizeSuffix}`
    if (key === 'loose-cargo') return `Loose Cargo${sizeSuffix}`
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
1. Ask: "Could you please provide the metro region for the delivery pick-up?"
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
- After the quote is generated, thank the customer and ask them to review the email and reply with their confirmation or any revisions.

Post-quote rules:
- Once generate_quote has been called, the conversation is complete. Do NOT ask any follow-up questions.
- If the customer accepts, confirms, acknowledges, or thanks you after the quote is generated, reply ONLY with a short warm closing message such as: "Wonderful! Your quote has been confirmed and the details are on their way to your inbox. Our team at FL Distribution will be in touch shortly. Thank you for choosing QuoteonAI!" Then stop — do not ask anything further.`

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

// ── Line-item builder ──────────────────────────────────────────────────────────

interface LineItem {
  category: string
  description: string
  amount: number
}

function buildLineItems(args: QuoteArgs, baseRate: number, subtotal: number, subTypeLabel: string): LineItem[] {
  const items: LineItem[] = []

  if (args.service === 'drayage') {
    const city = args.destination_city?.trim().toUpperCase() || args.port
    items.push({ category: 'Base Rate', description: `Base Rate — ${city}`, amount: baseRate })

    const weight = (args.container_weight ?? '').toLowerCase()
    if (/very\s*heavy|super\s*heavy/.test(weight)) {
      items.push({ category: 'Surcharge', description: 'Container Weight Surcharge (Very Heavy, 47,001+ lbs)', amount: 500 })
    } else if (/\bheavy\b/.test(weight)) {
      items.push({ category: 'Surcharge', description: 'Container Weight Surcharge (Heavy, 43,001–47,000 lbs)', amount: 250 })
    }

    for (const svc of (args.add_on_services ?? [])) {
      const s = svc.toLowerCase()
      if (/tcf|terminal.?clean/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Terminal Clean Fuel (TCF)', amount: 20 })
      } else if (/pier.?pass|prepaid/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Prepaid Pier Pass', amount: 80 })
      } else if (/chassis.?split|chassis/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Chassis Split', amount: 100 })
      } else {
        items.push({ category: 'Accessorial', description: svc, amount: 50 })
      }
    }
  } else if (args.service === 'transloading') {
    const qtyLabel = args.pallet_count != null
      ? `${args.pallet_count} pallets`
      : args.container_count != null
      ? `${args.container_count} containers`
      : `${args.quantity} ${args.quantity_unit}`
    items.push({ category: 'Transloading', description: `${subTypeLabel} — ${qtyLabel} @ $${baseRate}/unit`, amount: subtotal })

    for (const svc of (args.add_on_services ?? [])) {
      const s = svc.toLowerCase()
      if (/shrink.?wrap|shrink/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Shrink Wrap', amount: 150 })
      } else if (/bol|bill.?of.?lading/.test(s)) {
        items.push({ category: 'Documentation', description: 'BOL Preparation', amount: 35 })
      } else if (/seal/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Container Seal', amount: 25 })
      } else {
        items.push({ category: 'Accessorial', description: svc, amount: 50 })
      }
    }
  } else if (args.service === 'last-mile') {
    const tripLabel = args.quantity === 1 ? '1 trip' : `${args.quantity} trips`
    items.push({ category: 'Delivery', description: `${subTypeLabel} — ${tripLabel} @ $${baseRate}`, amount: subtotal })

    for (const cond of (args.special_conditions ?? [])) {
      const s = cond.toLowerCase()
      if (/reefer|refriger|temp.?control/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Temperature Control (Reefer)', amount: 200 })
      } else if (/hazmat|hazardous/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Hazmat Handling', amount: 150 })
      } else if (/oversize|over.?size/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Oversize Handling', amount: 175 })
      } else {
        items.push({ category: 'Accessorial', description: cond, amount: 75 })
      }
    }
    for (const svc of (args.add_on_services ?? [])) {
      const s = svc.toLowerCase()
      if (/insurance/.test(s)) {
        items.push({ category: 'Accessorial', description: 'Cargo Insurance', amount: 75 })
      } else {
        items.push({ category: 'Accessorial', description: svc, amount: 50 })
      }
    }
  }

  return items
}

function buildQuoteEmailBody(quote: {
  id: string; customer_name: string; service: string; service_label: string
  sub_type_label: string; port: string; destination_city: string; container_weight: string
  quantity: number; quantity_unit: string; container_count?: number; pallet_count?: number
  add_on_services: string[]; special_conditions: string[]
}, lineItems: LineItem[], total: number): string {
  const fn = quote.customer_name.split(' ')[0] || quote.customer_name
  const portDisplay = quote.port

  // Service-specific intro
  let intro: string
  if (quote.service === 'drayage') {
    const sizeMatch = quote.sub_type_label.match(/\d+/)
    const size = sizeMatch ? `${sizeMatch[0]}-foot` : ''
    const dest = (quote.destination_city || quote.port).toUpperCase()
    const weightNote = quote.container_weight ? `, with a cargo weight of ${quote.container_weight}` : ''
    intro = `We are pleased to provide you with a drayage quote for your ${size} container to ${dest}${weightNote}. Below is a detailed summary of the pricing for your request.`
  } else if (quote.service === 'transloading') {
    const qty = quote.pallet_count != null
      ? `${quote.pallet_count} pallets`
      : quote.container_count != null ? `${quote.container_count} containers` : `${quote.quantity} ${quote.quantity_unit}`
    intro = `We are pleased to provide you with a transloading quote for ${qty} (${quote.sub_type_label}) at ${portDisplay}. Below is a detailed summary of the pricing.`
  } else {
    const tripLabel = quote.quantity === 1 ? '1 trip' : `${quote.quantity} trips`
    intro = `We are pleased to provide you with a last-mile delivery quote for ${tripLabel} using a ${quote.sub_type_label} in the ${portDisplay} area. Below is a detailed summary of the pricing.`
  }

  // Table rows
  const tableRows = lineItems
    .map(item => `| ${item.category} | ${item.description} | ${formatCurrency(item.amount)} |`)
    .join('\n')

  // Basis for quote bullets
  let basisBullets: string
  if (quote.service === 'drayage') {
    basisBullets = [
      `Base rate includes standard port pickup from ${portDisplay} terminals.`,
      `Container size: ${quote.sub_type_label}.`,
      `Destination: ${(quote.destination_city || quote.port).toUpperCase()}.`,
      ...(quote.container_weight ? [`Container weight: ${quote.container_weight}.`] : []),
    ].map(b => `- ${b}`).join('\n')
  } else if (quote.service === 'transloading') {
    const qty = quote.pallet_count != null ? `${quote.pallet_count} pallet(s)` : quote.container_count != null ? `${quote.container_count} container(s)` : `${quote.quantity} ${quote.quantity_unit}`
    const addOns = quote.add_on_services.length > 0 ? quote.add_on_services.join(', ') : 'None'
    basisBullets = [
      `Quote covers ${quote.sub_type_label} transloading at ${portDisplay}.`,
      `Quantity: ${qty}.`,
      `Add-on services included: ${addOns}.`,
    ].map(b => `- ${b}`).join('\n')
  } else {
    const tripLabel = quote.quantity === 1 ? '1 trip' : `${quote.quantity} trips`
    const conds = quote.special_conditions.length > 0 ? quote.special_conditions.join(', ') : 'None'
    basisBullets = [
      `Quote covers ${tripLabel} in the ${portDisplay} area using a ${quote.sub_type_label}.`,
      `Special conditions: ${conds}.`,
      ...(quote.add_on_services.length > 0 ? [`Additional services: ${quote.add_on_services.join(', ')}.`] : []),
    ].map(b => `- ${b}`).join('\n')
  }

  const notesAndAssumptions = [
    'Quote is based on standard port pickup from the terminal complex.',
    'Rates are valid at the time of quotation and subject to change.',
    'Any additional accessorials not listed above will be invoiced separately.',
  ].map(n => `- ${n}`).join('\n')

  return `Hi ${fn},

Thank you for reaching out. ${intro}

Quote Summary:

| Category | Item | Amount (USD) |
|---|---|---|
${tableRows}
| **Total** | | **${formatCurrency(total)}** |

Total
The grand total for this ${quote.service_label.toLowerCase()} service is ${formatCurrency(total)} USD. This amount reflects the sum of all line items listed in the table above.

Basis for Quote
${basisBullets}

Notes & Assumptions
${notesAndAssumptions}

If you have any further questions or need additional services, please feel free to reach out.

Best Regards,

Jacob Hernandez
Operations Lead
FL Distribution
(424) 555-0187`
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

  // For transloading regular/oversize the rate is per pallet, not per container.
  // Loose cargo uses a flat per-container rate so falls back to args.quantity.
  const billingQty = (
    args.service === 'transloading' &&
    (subTypeKey === 'regular' || subTypeKey === 'oversize') &&
    args.pallet_count != null
  ) ? args.pallet_count : args.quantity

  const subtotal = Math.round(baseRate * billingQty)
  const serviceLabel = formatServiceLabel(args.service)
  const quoteId = `Q-${Date.now().toString(36).toUpperCase()}`

  // Display quantity shown on the QuoteCard: for transloading show pallets, not containers
  const displayQty = billingQty
  const displayQtyUnit = (
    args.service === 'transloading' &&
    (subTypeKey === 'regular' || subTypeKey === 'oversize') &&
    args.pallet_count != null
  ) ? 'pallets' : args.quantity_unit

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
    quantity: displayQty,
    quantity_unit: displayQtyUnit,
    container_count: args.container_count,
    pallet_count: args.pallet_count,
    add_on_services: addOnServices,
    special_conditions: specialConditions,
    base_rate: baseRate,
    subtotal,
    valid_days: 30,
  }

  // Build line items and derive total from them
  const lineItems = buildLineItems({ ...args, add_on_services: addOnServices, special_conditions: specialConditions }, baseRate, subtotal, subTypeLabel)
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0)

  // Build standardised email body (same format as regular quote emails)
  const emailBody = buildQuoteEmailBody(quote, lineItems, total)
  const emailHtml = textToHtml(emailBody)
  const subject = `${serviceLabel} Quote – ${quote.id} – FL Distribution`

  // Send email and create inbox records (both email_threads and message_threads)
  const [threadId] = await Promise.all([
    createInboxRecord(quote, total, emailBody, emailHtml, subject).catch(e => { console.error('[chat inbox]', e); return null }),
    sendEmail({ to: quote.customer_email, subject, html: emailHtml, text: emailBody }).catch(e => console.error('[chat email]', e)),
  ])

  // Chat summary lines
  const lineItemLines = lineItems.map(item => `- ${item.category}: ${item.description} — **${formatCurrency(item.amount)}**`)
  const lines = [
    `Thank you, ${args.customer_name}! Your quote has been prepared and sent to **${args.customer_email}**.`,
    '',
    `**Quote: ${quoteId}**${threadId ? `  |  Thread: ${threadId}` : ''}`,
    '',
    `**Pricing Summary:**`,
    ...lineItemLines,
    `- **Total: ${formatCurrency(total)}**`,
    '',
    `A detailed quote email has been sent. Please review and reply with your **confirmation** or any **revisions**. We look forward to supporting your shipment!`,
  ]

  return { message: lines.join('\n'), quote: { ...quote, total, thread_id: threadId } }
}

async function createInboxRecord(
  quote: {
    id: string; customer_name: string; customer_email: string
    service: string; service_label: string; sub_type: string; sub_type_label?: string; port: string
    destination_city?: string; container_weight?: string
    quantity: number; quantity_unit: string; base_rate: number; subtotal: number
    container_count?: number; pallet_count?: number
    add_on_services?: string[]; special_conditions?: string[]
  },
  total: number,
  emailBodyText: string,
  emailBodyHtml: string,
  subject: string,
): Promise<string | null> {
  try {
    const tenantId = process.env.TENANT_ID
    const projectId = process.env.PROJECT_ID
    const fromEmail = process.env.FROM_EMAIL ?? 'quote-agent@quotify.cc'
    if (!tenantId || !projectId) return null

    const threadId = generateThreadId()

    // Normalize processor type so 'transloading' matches 'warehousing' in CRM analytics queries
    const analyticsProcessorType = quote.service === 'transloading' ? 'warehousing' : quote.service

    // Create message_thread record
    const thread = await createMessageThread({
      tenantId,
      projectId,
      threadId,
      intent: quote.service,
      processorType: analyticsProcessorType,
      confidenceScore: 1.0,
    })

    // Set quote_value so win-rate and revenue analytics are correctly calculated
    await updateThreadProcessorType(thread.id, analyticsProcessorType, total)

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
        subTypeLabel: quote.sub_type_label,
        port: quote.port,
        destinationCity: quote.destination_city,
        containerWeight: quote.container_weight,
        quantity: quote.quantity,
        quantityUnit: quote.quantity_unit,
        containerCount: quote.container_count,
        palletCount: quote.pallet_count,
        addOnServices: quote.add_on_services,
        specialConditions: quote.special_conditions,
        baseRate: quote.base_rate,
        subtotal: quote.subtotal,
        total,
        source: 'chatbot',
        status: 'awaiting-confirmation',
      },
    })

    // Also create an email_thread + two messages so it appears in the Message Inbox
    const requestSummary = [
      `Service: ${quote.service_label}`,
      `Cargo / Vehicle: ${quote.sub_type_label ?? quote.sub_type}`,
      `Port / Region: ${quote.port}`,
      quote.destination_city ? `Destination: ${quote.destination_city}` : '',
      quote.container_weight ? `Container weight: ${quote.container_weight}` : '',
      quote.container_count != null ? `Containers: ${quote.container_count}` : '',
      quote.pallet_count != null ? `Pallets: ${quote.pallet_count}` : '',
      `Quantity: ${quote.quantity} ${quote.quantity_unit}`,
      (quote.add_on_services?.length ?? 0) > 0 ? `Add-ons: ${quote.add_on_services!.join(', ')}` : '',
      (quote.special_conditions?.length ?? 0) > 0 ? `Special conditions: ${quote.special_conditions!.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const inboundBody = `[QuotyAI Chatbot Quote Request — ${quote.id}]\n\nCustomer: ${quote.customer_name} <${quote.customer_email}>\n\n${requestSummary}`

    const emailThread = await createEmailThread({
      subject,
      subjectNorm: normalizeSubject(subject),
      participantFrom: quote.customer_email,
      participantTo: fromEmail,
      status: 'new',
    })

    // Inbound = customer's chatbot request
    await insertEmailMessage({
      threadId: emailThread.id,
      direction: 'inbound',
      fromEmail: quote.customer_email,
      toEmail: fromEmail,
      subject,
      bodyText: inboundBody,
      bodyHtml: null,
    })

    // Outbound = our generated quote response
    await insertEmailMessage({
      threadId: emailThread.id,
      direction: 'outbound',
      fromEmail,
      toEmail: quote.customer_email,
      subject,
      bodyText: emailBodyText,
      bodyHtml: emailBodyHtml,
    })

    return threadId
  } catch {
    // Silently fail — inbox is secondary to the customer email
    return null
  }
}

