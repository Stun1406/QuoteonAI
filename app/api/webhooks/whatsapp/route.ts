import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getMessages, push, reset } from '@/lib/whatsapp/session'
import { sendEmail } from '@/lib/email/send'
import { createMessageThread, generateThreadId, updateThreadProcessorType } from '@/lib/db/tables/thread'
import { addArtifactToThread } from '@/lib/db/services/thread-service'
import { createEmailThread, insertEmailMessage, normalizeSubject } from '@/lib/db/tables/email-thread'
import { sql } from '@/lib/db/client'
import { textToHtml } from '@/lib/llm/formatter'
import { formatCurrency } from '@/lib/utils/currency'

// ── Pricing tables (mirrors app/api/chat/route.ts) ────────────────────────────

const TRANSLOADING_CONTAINER_RATES: Record<string, number> = {
  '20': 235, '40': 335, '45': 335, '53': 335,
}

const RATES: Record<string, Record<string, Record<string, number>>> = {
  drayage: {
    '40ft': { 'LA / LB Port, CA': 502, 'Houston Port, TX': 424, 'NY / NJ Port, NY': 541, 'Savannah Port, GA': 375, 'Seattle Port, WA': 453 },
    '20ft': { 'LA / LB Port, CA': 377, 'Houston Port, TX': 318, 'NY / NJ Port, NY': 405, 'Savannah Port, GA': 281, 'Seattle Port, WA': 340 },
    '45ft': { 'LA / LB Port, CA': 578, 'Houston Port, TX': 485, 'NY / NJ Port, NY': 622, 'Savannah Port, GA': 431, 'Seattle Port, WA': 522 },
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
  'seattle': 'Seattle Port, WA', 'washington': 'Seattle Port, WA', 'wa': 'Seattle Port, WA',
  'la basin': 'LA Basin, CA', 'los angeles basin': 'LA Basin, CA',
  'houston metro': 'Houston Metro, TX', 'houston area': 'Houston Metro, TX',
  'nyc': 'NYC Metro, NY', 'new york city': 'NYC Metro, NY',
  'atlanta': 'Atlanta Metro, GA', 'atlanta metro': 'Atlanta Metro, GA',
}

const SUBTYPE_MAP: Record<string, string> = {
  '40': '40ft', '40ft': '40ft', '40 ft': '40ft',
  '20': '20ft', '20ft': '20ft', '20 ft': '20ft',
  '45': '45ft', '45ft': '45ft', '53': '45ft', '53ft': '45ft',
  "regular container (20')": 'regular', "regular container (40')": 'regular',
  "oversize container (20')": 'oversize', "oversize container (40')": 'oversize',
  "loose cargo (20')": 'loose-cargo', "loose cargo (40')": 'loose-cargo',
  'regular': 'regular', 'standard': 'regular', 'regular container': 'regular',
  'oversize': 'oversize', 'over-size': 'oversize',
  'loose': 'loose-cargo', 'loose cargo': 'loose-cargo', 'bulk': 'loose-cargo',
  'straight': 'straight-truck', 'straight truck': 'straight-truck',
  'box': 'box-truck', 'box truck': 'box-truck',
  'sprinter': 'sprinter', 'van': 'sprinter', 'sprinter van': 'sprinter',
}

// ── System prompt (identical to chatbot) ──────────────────────────────────────

const SYSTEM_PROMPT = `You are QuoteonAI's customer support assistant. Your name is "Quoty". You help customers understand the platform and generate freight quotes in a polished, professional way.

QuoteonAI service guidance:
1. Drayage: port-to-destination container moves. Offer clear cargo options such as Regular Container (20'), Regular Container (40'), and Regular Container (45'/53').
2. Transloading: warehouse unload / palletization work. Offer clear cargo options such as Regular Container (20'), Regular Container (40'), Oversize Container (20'), Oversize Container (40'), Loose Cargo (20'), and Loose Cargo (40').
3. Last Mile: local final delivery. Vehicle options are Straight Truck, Box Truck, or Sprinter Van.

Conversation rules:
- Ask one clear question at a time unless you are listing customer options.
- Do not ask for the customer's name or email until AFTER you summarize the request and the customer confirms it is correct.
- After the customer confirms the recap: first ask for their full name only. Once they provide their name, ask for their best email address in a separate message.
- Only call generate_quote after the customer has confirmed the recap and provided both their name and email.
- Keep the tone warm, courteous, and professional.

Transloading flow:
1. Ask for the port / warehouse location.
2. Ask which cargo option they need, using the exact labels with size in brackets.
3. Ask: "How many containers do you need for the transloading service?"
4. Always ask this next question (mandatory):
   - For Regular Container or Oversize Container types: "How many pallets are included in the container(s)?"
   - For Loose Cargo types: "How many loose cargo pieces are there?"
5. Then courteously ask whether they need add-on services such as shrink wrap, BOL, and seal.
6. Summarize the full request clearly and ask the customer to confirm it.
7. After confirmation, ask for their full name.
8. After they provide their name, ask for their best email address.

Drayage flow:
1. Ask for the port of origin.
2. Ask which cargo option / container size they need, using explicit size labels in brackets.
3. After container size is selected, ask for the container weight and offer options such as Regular (up to 43K lbs), Heavy, and Very Heavy.
4. Ask for the end destination city, for example Carson or Ontario.
5. Courteously ask whether they need additional elements such as TCF, prepaid pier pass, chassis split, or similar accessorials.
6. Summarize the full request clearly and ask the customer to confirm it.
7. After confirmation, ask for their full name.
8. After they provide their name, ask for their best email address.

Last Mile flow:
1. Ask: "Could you please provide the metro region for the delivery pick-up?"
2. Immediately after that, ask for the end destination city.
3. Ask which vehicle type they need, and present all options: Straight Truck, Box Truck, or Sprinter Van.
4. Ask for special conditions such as reefer, hazmat, or oversize handling.
5. Courteously ask whether they need additional services such as insurance.
6. Ask for the number of trips.
7. Summarize the full request clearly and ask the customer to confirm it.
8. After confirmation, ask for their full name.
9. After they provide their name, ask for their best email address.

General rules:
- If a customer asks broad pricing questions, give only high-level guidance and explain that final pricing is sent after details are confirmed.
- Never invent unofficial exact rates in conversation. Use generate_quote for the final quote.
- If something is ambiguous, ask a short clarifying question.
- In the confirmation recap, include every key detail the customer has provided so far.
- After the quote is generated, thank the customer and ask them to review the email and reply with their confirmation or any revisions.

Post-quote rules:
- Once generate_quote has been called, the conversation is complete. Do NOT ask any follow-up questions.
- If the customer accepts, confirms, acknowledges, or thanks you after the quote is generated, reply ONLY with a short warm closing message. Then stop.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_quote',
      description: 'Generate and email a freight quote to the customer. Call only after the customer has confirmed and provided contact details.',
      parameters: {
        type: 'object',
        properties: {
          customer_name:      { type: 'string' },
          customer_email:     { type: 'string' },
          service:            { type: 'string', enum: ['drayage', 'transloading', 'last-mile'] },
          sub_type:           { type: 'string' },
          port:               { type: 'string' },
          destination_city:   { type: 'string' },
          container_weight:   { type: 'string' },
          quantity:           { type: 'number' },
          quantity_unit:      { type: 'string' },
          container_count:    { type: 'number' },
          pallet_count:       { type: 'number' },
          add_on_services:    { type: 'array', items: { type: 'string' } },
          special_conditions: { type: 'array', items: { type: 'string' } },
          customer_confirmed: { type: 'boolean' },
        },
        required: ['customer_name', 'customer_email', 'service', 'sub_type', 'port', 'quantity', 'quantity_unit', 'customer_confirmed'],
      },
    },
  },
]

// ── Quote helpers ─────────────────────────────────────────────────────────────

interface QuoteArgs {
  customer_name: string; customer_email: string
  service: string; sub_type: string; port: string
  destination_city?: string; container_weight?: string
  quantity: number; quantity_unit: string
  container_count?: number; pallet_count?: number
  add_on_services?: string[]; special_conditions?: string[]
  customer_confirmed: boolean
}

interface LineItem { category: string; description: string; amount: number }

function cleanList(v?: string[]) { return (v ?? []).map(s => s.trim()).filter(Boolean) }

function formatServiceLabel(s: string) {
  return s === 'last-mile' ? 'Last Mile' : s.charAt(0).toUpperCase() + s.slice(1)
}

function formatQuotedSubtype(service: string, subType: string): string {
  const key = SUBTYPE_MAP[subType.toLowerCase()] ?? subType.toLowerCase().replace(/\s+/g, '-')
  if (service === 'transloading') {
    const sizeMatch = subType.match(/\((\d+)'?\)/)
    const suffix = sizeMatch ? ` (${sizeMatch[1]}')` : ''
    if (key === 'regular')     return `Regular Container${suffix}`
    if (key === 'oversize')    return `Oversize Container${suffix}`
    if (key === 'loose-cargo') return `Loose Cargo${suffix}`
  }
  if (service === 'drayage') {
    if (key === '20ft') return "Regular Container (20')"
    if (key === '40ft') return "Regular Container (40')"
    if (key === '45ft') return "Regular Container (45'/53')"
  }
  if (service === 'last-mile') {
    if (key === 'straight-truck') return 'Straight Truck'
    if (key === 'box-truck')      return 'Box Truck'
    if (key === 'sprinter')       return 'Sprinter Van'
  }
  return subType
}

function buildLineItems(args: QuoteArgs, baseRate: number, subtotal: number, subTypeLabel: string): LineItem[] {
  const items: LineItem[] = []
  const stk = SUBTYPE_MAP[args.sub_type.toLowerCase()] ?? args.sub_type.toLowerCase()

  if (args.service === 'drayage') {
    const city = args.destination_city?.trim().toUpperCase() || args.port
    items.push({ category: 'Base Rate', description: `Base Rate — ${city}`, amount: baseRate })
    const weight = (args.container_weight ?? '').toLowerCase()
    if (/very\s*heavy|super\s*heavy/.test(weight))
      items.push({ category: 'Surcharge', description: 'Container Weight Surcharge (Very Heavy, 47,001+ lbs)', amount: 500 })
    else if (/\bheavy\b/.test(weight))
      items.push({ category: 'Surcharge', description: 'Container Weight Surcharge (Heavy, 43,001–47,000 lbs)', amount: 250 })
    for (const svc of (args.add_on_services ?? [])) {
      const s = svc.toLowerCase()
      if (/tcf|terminal.?clean/.test(s))      items.push({ category: 'Accessorial', description: 'Terminal Clean Fuel (TCF)', amount: 20 })
      else if (/pier.?pass|prepaid/.test(s))  items.push({ category: 'Accessorial', description: 'Prepaid Pier Pass', amount: 80 })
      else if (/chassis.?split|chassis/.test(s)) items.push({ category: 'Accessorial', description: 'Chassis Split', amount: 100 })
      else items.push({ category: 'Accessorial', description: svc, amount: 50 })
    }
  } else if (args.service === 'transloading') {
    if (stk === 'regular' || stk === 'oversize') {
      const sizeMatch = subTypeLabel.match(/\((\d+)'?\)/)
      const containerSize = sizeMatch?.[1] ?? '40'
      const containerBaseRate = TRANSLOADING_CONTAINER_RATES[containerSize] ?? 335
      const containerCount = args.container_count ?? 1
      const containerTotal = containerBaseRate * containerCount
      const containerDesc = containerCount > 1
        ? `Container Handling (${containerSize}') — ${containerCount} containers @ $${containerBaseRate}`
        : `Container Handling (${containerSize}') — Base Fee`
      items.push({ category: 'Container', description: containerDesc, amount: containerTotal })
    } else {
      const qtyLabel = args.container_count != null
        ? `${args.container_count} container${args.container_count > 1 ? 's' : ''}`
        : `${args.quantity} ${args.quantity_unit}`
      const pieceInfo = args.pallet_count != null ? ` (${args.pallet_count} pieces)` : ''
      items.push({ category: 'Transloading', description: `${subTypeLabel} — ${qtyLabel}${pieceInfo} @ $${baseRate}/container`, amount: subtotal })
    }
    for (const svc of (args.add_on_services ?? [])) {
      const s = svc.toLowerCase()
      if (/shrink.?wrap|shrink/.test(s)) {
        const swPallets = args.pallet_count ?? 0
        const swAmount = (swPallets > 0 && (stk === 'regular' || stk === 'oversize'))
          ? swPallets * baseRate : 150
        const swDesc = (swPallets > 0 && (stk === 'regular' || stk === 'oversize'))
          ? `Shrink Wrap — ${swPallets} pallets @ $${baseRate}/pallet` : 'Shrink Wrap'
        items.push({ category: 'Accessorial', description: swDesc, amount: swAmount })
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
      if (/reefer|refriger|temp.?control/.test(s))  items.push({ category: 'Accessorial', description: 'Temperature Control (Reefer)', amount: 200 })
      else if (/hazmat|hazardous/.test(s))           items.push({ category: 'Accessorial', description: 'Hazmat Handling', amount: 150 })
      else if (/oversize|over.?size/.test(s))        items.push({ category: 'Accessorial', description: 'Oversize Handling', amount: 175 })
      else items.push({ category: 'Accessorial', description: cond, amount: 75 })
    }
    for (const svc of (args.add_on_services ?? [])) {
      const s = svc.toLowerCase()
      if (/insurance/.test(s)) items.push({ category: 'Accessorial', description: 'Cargo Insurance', amount: 75 })
      else items.push({ category: 'Accessorial', description: svc, amount: 50 })
    }
  }

  return items
}

function buildEmailBody(quote: {
  id: string; customer_name: string; service: string; service_label: string
  sub_type_label: string; port: string; destination_city: string; container_weight: string
  quantity: number; quantity_unit: string; container_count?: number; pallet_count?: number
  add_on_services: string[]; special_conditions: string[]
}, lineItems: LineItem[], total: number): string {
  const fn = quote.customer_name.split(' ')[0]
  let intro: string
  if (quote.service === 'drayage') {
    const sz = (quote.sub_type_label.match(/\d+/) ?? [''])[0]
    const dest = (quote.destination_city || quote.port).toUpperCase()
    intro = `We are pleased to provide you with a drayage quote for your ${sz}-foot container to ${dest}. Below is a detailed summary of the pricing.`
  } else if (quote.service === 'transloading') {
    const qty = quote.pallet_count != null
      ? `${quote.pallet_count} pallets`
      : quote.container_count != null ? `${quote.container_count} containers` : `${quote.quantity} ${quote.quantity_unit}`
    intro = `We are pleased to provide you with a transloading quote for ${qty} (${quote.sub_type_label}) at ${quote.port}. Below is a detailed summary of the pricing.`
  } else {
    intro = `We are pleased to provide you with a last-mile delivery quote for ${quote.quantity} trip(s) using a ${quote.sub_type_label}. Below is a detailed summary of the pricing.`
  }

  const tableRows = lineItems.map(i => `| ${i.category} | ${i.description} | ${formatCurrency(i.amount)} |`).join('\n')

  return `Hi ${fn},

Thank you for reaching out. ${intro}

Quote Summary:

| Category | Item | Amount (USD) |
|---|---|---|
${tableRows}
| **Total** | | **${formatCurrency(total)}** |

Total
The grand total for this ${quote.service_label.toLowerCase()} service is ${formatCurrency(total)} USD.

Notes & Assumptions
- Rates are valid at the time of quotation and subject to change.
- Quote is based on standard port pickup from the terminal complex.
- Any additional accessorials not listed will be invoiced separately.

If you have any further questions, please feel free to reach out.

Best Regards,

Jacob Hernandez
Operations Lead
FL Distribution
(424) 555-0187`
}

// WhatsApp-friendly quote summary (concise, WhatsApp markdown)
function formatWhatsAppSummary(
  quote: { service: string; service_label: string; sub_type_label: string; port: string; container_count?: number; pallet_count?: number; quantity: number; quantity_unit: string; customer_email: string; id: string; add_on_services: string[]; destination_city?: string },
  lineItems: LineItem[],
  total: number
): string {
  const lines: string[] = [`✅ *Quote Ready — FL Distribution*`, ``]

  lines.push(`*Service:* ${quote.service_label} — ${quote.sub_type_label}`)
  lines.push(`*Location:* ${quote.port}`)
  if (quote.destination_city) lines.push(`*Destination:* ${quote.destination_city}`)
  if (quote.container_count != null) lines.push(`*Containers:* ${quote.container_count}`)
  if (quote.pallet_count != null) lines.push(`*Pallets:* ${quote.pallet_count}`)
  if (quote.add_on_services.length > 0) lines.push(`*Add-ons:* ${quote.add_on_services.join(', ')}`)

  lines.push(``)
  lines.push(`*Pricing:*`)
  for (const item of lineItems) {
    lines.push(`• ${item.description}: ${formatCurrency(item.amount)}`)
  }
  lines.push(``)
  lines.push(`*Total: ${formatCurrency(total)}*`)
  lines.push(``)
  lines.push(`📧 Full quote sent to ${quote.customer_email}`)
  lines.push(``)
  lines.push(`Reply with any questions or type *RESET* to start a new conversation.`)

  return lines.join('\n')
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
    const analyticsProcessorType = quote.service === 'transloading' ? 'warehousing' : quote.service

    const thread = await createMessageThread({ tenantId, projectId, threadId, intent: quote.service, processorType: analyticsProcessorType, confidenceScore: 1.0 })
    await updateThreadProcessorType(thread.id, analyticsProcessorType, total)

    await addArtifactToThread({
      threadId: thread.id, tenantId, projectId, type: 'chatbot-quote',
      data: {
        quoteId: quote.id, customerName: quote.customer_name, customerEmail: quote.customer_email,
        service: quote.service, serviceLabel: quote.service_label,
        subType: quote.sub_type, subTypeLabel: quote.sub_type_label, port: quote.port,
        destinationCity: quote.destination_city, containerWeight: quote.container_weight,
        quantity: quote.quantity, quantityUnit: quote.quantity_unit,
        containerCount: quote.container_count, palletCount: quote.pallet_count,
        addOnServices: quote.add_on_services, specialConditions: quote.special_conditions,
        baseRate: quote.base_rate, subtotal: quote.subtotal, total, source: 'whatsapp',
        status: 'awaiting-confirmation',
      },
    })

    const requestSummary = [
      `Service: ${quote.service_label}`,
      `Cargo / Vehicle: ${quote.sub_type_label ?? quote.sub_type}`,
      `Port / Region: ${quote.port}`,
      quote.destination_city ? `Destination: ${quote.destination_city}` : '',
      quote.container_count != null ? `Containers: ${quote.container_count}` : '',
      quote.pallet_count != null ? `Pallets: ${quote.pallet_count}` : '',
      (quote.add_on_services?.length ?? 0) > 0 ? `Add-ons: ${quote.add_on_services!.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const inboundBody = `[WhatsApp Quote Request — ${quote.id}]\n\nCustomer: ${quote.customer_name} <${quote.customer_email}>\n\n${requestSummary}`

    const emailThread = await createEmailThread({
      subject, subjectNorm: normalizeSubject(subject),
      participantFrom: quote.customer_email, participantTo: fromEmail, status: 'new',
    })

    await insertEmailMessage({ threadId: emailThread.id, direction: 'inbound', fromEmail: quote.customer_email, toEmail: fromEmail, subject, bodyText: inboundBody, bodyHtml: null })
    await insertEmailMessage({ threadId: emailThread.id, direction: 'outbound', fromEmail, toEmail: quote.customer_email, subject, bodyText: emailBodyText, bodyHtml: emailBodyHtml })

    await sql`UPDATE email_threads SET process_thread_id = ${threadId} WHERE id = ${emailThread.id}`.catch(() => {})

    return threadId
  } catch {
    return null
  }
}

async function handleGenerateQuote(args: QuoteArgs): Promise<string> {
  if (!args.customer_confirmed) {
    return 'Please confirm the summarized request first so I can prepare your quote.'
  }

  const subTypeKey = SUBTYPE_MAP[args.sub_type.toLowerCase()] ?? args.sub_type.toLowerCase().replace(/\s+/g, '-')
  const portKey = PORT_MAP[args.port.toLowerCase()] ?? args.port
  const subTypeLabel = formatQuotedSubtype(args.service, args.sub_type)
  const addOnServices = cleanList(args.add_on_services)
  const specialConditions = cleanList(args.special_conditions)

  const serviceRates = RATES[args.service]?.[subTypeKey]
  const baseRate = serviceRates?.[portKey] ?? serviceRates?.[Object.keys(serviceRates ?? {})[0]] ?? 400

  const billingQty = (
    args.service === 'transloading' &&
    (subTypeKey === 'regular' || subTypeKey === 'oversize') &&
    args.pallet_count != null
  ) ? args.pallet_count : args.quantity

  const subtotal = Math.round(baseRate * billingQty)
  const serviceLabel = formatServiceLabel(args.service)
  const quoteId = `Q-${Date.now().toString(36).toUpperCase()}`

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
    quantity: billingQty,
    quantity_unit: (args.service === 'transloading' && (subTypeKey === 'regular' || subTypeKey === 'oversize') && args.pallet_count != null) ? 'pallets' : args.quantity_unit,
    container_count: args.container_count,
    pallet_count: args.pallet_count,
    add_on_services: addOnServices,
    special_conditions: specialConditions,
    base_rate: baseRate,
    subtotal,
    valid_days: 30,
  }

  const lineItems = buildLineItems({ ...args, add_on_services: addOnServices, special_conditions: specialConditions }, baseRate, subtotal, subTypeLabel)
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0)

  const emailBody = buildEmailBody(quote, lineItems, total)
  const emailHtml = textToHtml(emailBody)
  const subject = `${serviceLabel} Quote – ${quoteId} – FL Distribution`

  await Promise.all([
    createInboxRecord(quote, total, emailBody, emailHtml, subject).catch(e => console.error('[wa inbox]', e)),
    sendEmail({ to: quote.customer_email, subject, html: emailHtml, text: emailBody }).catch(e => console.error('[wa email]', e)),
  ])

  return formatWhatsAppSummary(quote, lineItems, total)
}

// ── Twilio signature verification (optional — skipped if URL not configured) ──

function verifyTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? ''
  const signature = req.headers.get('x-twilio-signature') ?? ''

  if (!authToken || !webhookUrl) return true // not configured — skip

  const sortedStr = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('')
  const expected = createHmac('sha1', authToken).update(webhookUrl + sortedStr).digest('base64')
  return expected === signature
}

// ── TwiML response helper ─────────────────────────────────────────────────────

function twiml(message: string): NextResponse {
  // Escape XML special chars
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function emptyTwiml(): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    status: 200, headers: { 'Content-Type': 'text/xml' },
  })
}

// ── Main webhook handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // Collect all fields for signature verification
    const params: Record<string, string> = {}
    for (const [k, v] of formData.entries()) {
      if (typeof v === 'string') params[k] = v
    }

    if (!verifyTwilioSignature(req, params)) {
      console.warn('[webhook/whatsapp] Signature verification failed')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const from = (formData.get('From') as string | null) ?? ''     // e.g. "whatsapp:+12025550196"
    const body = ((formData.get('Body') as string | null) ?? '').trim()

    if (!from || !body) return emptyTwiml()

    const phone = from.replace('whatsapp:', '')

    // RESET command clears conversation history
    if (/^reset$/i.test(body)) {
      reset(phone)
      return twiml("Conversation reset! I'm Quoty from FL Distribution. How can I help you today? I can assist with Drayage, Transloading, or Last-Mile delivery quotes.")
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[webhook/whatsapp] OPENAI_API_KEY not configured')
      return twiml('Our quoting service is temporarily unavailable. Please try again shortly.')
    }

    // Build conversation with history
    const history = getMessages(phone)
    push(phone, { role: 'user', content: body })
    const messages = [...history, { role: 'user', content: body }]

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

    if (!res.ok) {
      console.error('[webhook/whatsapp] OpenAI error', res.status)
      return twiml("I'm having trouble processing your request right now. Please try again in a moment.")
    }

    const data = await res.json()
    const choice = data.choices?.[0]

    // Tool call → generate quote
    if (choice?.finish_reason === 'tool_calls') {
      const call = choice.message?.tool_calls?.[0]
      if (call?.function?.name === 'generate_quote') {
        const args = JSON.parse(call.function.arguments) as QuoteArgs
        const reply = await handleGenerateQuote(args)
        push(phone, { role: 'assistant', content: reply })
        return twiml(reply)
      }
    }

    const reply: string = choice?.message?.content ?? "I'm sorry, I couldn't process that. Could you please rephrase?"
    push(phone, { role: 'assistant', content: reply })
    return twiml(reply)

  } catch (err) {
    console.error('[webhook/whatsapp] Error:', err)
    return twiml('Something went wrong on our end. Please try again or contact us directly.')
  }
}
