import type { ProcessorResult, DrayageResponseData, WarehousingResponseData, LastMileResponseData, GeneralResponseData, HybridResponseData } from '../types/processor'
import type { ContactInfo } from '../types/preprocessor'
import type { DrayageQuoteResult, LineItem } from '../types/quote'
import { formatCurrency } from '../utils/currency'
import { formatWarehouseQuoteEmail } from './versions/quote-formatter.v1'
import { formatGeneralInquiryResponse } from './versions/general-formatter.v1'

export interface FormattedResponse {
  markdown: string
  html: string
  plainText: string
  subject: string
}

export async function formatProcessorResult(
  result: ProcessorResult,
  originalMessage: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<FormattedResponse> {
  const { responseData, contactInfo } = result

  switch (responseData.type) {
    case 'drayage':
      return formatDrayageResult(responseData, contactInfo, originalMessage)

    case 'warehousing':
      return formatWarehouseResult(responseData, contactInfo, originalMessage, context)

    case 'last-mile':
      return formatLastMileResult(responseData, contactInfo)

    case 'general':
      return formatGeneralResult(responseData, contactInfo, originalMessage, context)

    case 'hybrid':
      return formatHybridResult(responseData, contactInfo, originalMessage, context)

    default:
      return {
        markdown: 'Unable to format response.',
        html: '<p>Unable to format response.</p>',
        plainText: 'Unable to format response.',
        subject: 'RE: Your Inquiry',
      }
  }
}

function sanitizeName(name: string | null): string {
  if (!name) return 'Team'
  const cleaned = name.replace(/[^\w\s'-]/g, '').trim().slice(0, 40)
  if (!cleaned || cleaned.includes('@') || /^(quote|info|sales)/i.test(cleaned)) return 'Team'
  return cleaned
}

function formatDrayageResult(
  data: DrayageResponseData,
  contactInfo: ContactInfo,
  originalMessage: string
): FormattedResponse {
  const name = sanitizeName(contactInfo.name)
  const isRush = /urgent|rush|asap|expedite|priority|hot/i.test(originalMessage)
  const quote = data.quote

  if (!quote) {
    const missingFields = data.missingFields ?? []
    const subject = 'RE: Drayage Quote Request — Additional Information Needed'
    const body = `Hi ${name},

Thank you for reaching out to FL Distribution!${isRush ? ' We understand this is time-sensitive and will prioritize your request.' : ''}

To provide you with an accurate drayage quote, I need a few additional details:
${missingFields.map(f => `• ${f}`).join('\n')}

Please reply with the above information and I'll get your quote back to you promptly.

Best Regards,
Jacob Hernandez
Operations Lead | FL Distributions
(424) 555-0187`

    return {
      markdown: body,
      html: textToHtml(body),
      plainText: body,
      subject,
    }
  }

  const subject = `Drayage Quote – ${quote.city.toUpperCase()} – ${quote.containerSize} ft Container`

  const lineItemsText = quote.lineItems.map(item =>
    `${item.code.padEnd(8)} ${item.description.padEnd(35)} ${formatCurrency(item.amount).padStart(10)}`
  ).join('\n')

  const basisText = quote.basisNotes.length > 0 ? quote.basisNotes.join('\n') : 'Base rate includes standard port pickup from LA/LB terminals.'
  const notesText = [...(data.notes ?? []), ...quote.warnings].filter(Boolean)

  const body = `Hi ${name},

Thank you for reaching out!${isRush ? ' We understand this is urgent and have prioritized your quote.' : ''} Please find your drayage quote below.

QUOTE DETAILS
─────────────
Destination:  ${quote.city}
Container:    ${quote.containerSize} ft
Weight:       ${quote.containerWeightLbs ? quote.containerWeightLbs.toLocaleString() + ' lbs' : 'Not specified'}

LINE ITEMS
──────────
${lineItemsText}
─────────────────────────────────────────────────────
SUBTOTAL${formatCurrency(quote.subtotal).padStart(49)}

BASIS
─────
${basisText}
${notesText.length > 0 ? '\nNOTES\n─────\n' + notesText.join('\n') : ''}

Best Regards,
Jacob Hernandez
Operations Lead | FL Distributions
(424) 555-0187`

  return {
    markdown: body,
    html: textToHtml(body),
    plainText: body,
    subject,
  }
}

async function formatWarehouseResult(
  data: WarehousingResponseData,
  contactInfo: ContactInfo,
  originalMessage: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<FormattedResponse> {
  const body = await formatWarehouseQuoteEmail({
    contactInfo,
    extraction: data.extracted,
    result: data.result,
    originalMessage,
    context,
  })

  const subject = 'Warehousing/Transloading Quote – FL Distribution'

  return {
    markdown: body,
    html: textToHtml(body),
    plainText: body,
    subject,
  }
}

function formatLastMileResult(
  data: LastMileResponseData,
  contactInfo: ContactInfo
): FormattedResponse {
  const name = sanitizeName(contactInfo.name)
  const subject = 'Last-Mile Delivery Quote – FL Distribution'

  const lineItemsText = data.result.lineItems.map(item =>
    `${item.description.padEnd(40)} ${formatCurrency(item.amount).padStart(10)}`
  ).join('\n')

  const body = `Hi ${name},

Thank you for reaching out to FL Distribution! Please find your last-mile delivery quote below.

LINE ITEMS
──────────
${lineItemsText}
──────────────────────────────────────────────────────
TOTAL${formatCurrency(data.result.total).padStart(51)}

Best Regards,
Jacob Hernandez
Operations Lead | FL Distributions
(424) 555-0187`

  return {
    markdown: body,
    html: textToHtml(body),
    plainText: body,
    subject,
  }
}

async function formatGeneralResult(
  data: GeneralResponseData,
  contactInfo: ContactInfo,
  originalMessage: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<FormattedResponse> {
  const body = data.response || await formatGeneralInquiryResponse({
    contactInfo,
    originalMessage,
    context,
  })

  return {
    markdown: body,
    html: textToHtml(body),
    plainText: body,
    subject: 'RE: Your Inquiry – FL Distribution',
  }
}

async function formatHybridResult(
  data: HybridResponseData,
  contactInfo: ContactInfo,
  originalMessage: string,
  context: { tenantId: string; projectId: string; threadId: string }
): Promise<FormattedResponse> {
  const name = sanitizeName(contactInfo.name)
  const subject = 'Combined Drayage & Warehousing Quote – FL Distribution'

  const sections: string[] = [`Hi ${name},\n\nThank you for reaching out! Please find your combined quote below.\n`]

  for (const component of data.components) {
    if (component.responseData.type === 'drayage') {
      const drayageData = component.responseData as DrayageResponseData
      if (drayageData.quote) {
        sections.push(`DRAYAGE QUOTE — ${drayageData.quote.city.toUpperCase()}
${'─'.repeat(40)}
${drayageData.quote.lineItems.map((item: LineItem) => `${item.code.padEnd(8)} ${item.description.padEnd(30)} ${formatCurrency(item.amount).padStart(10)}`).join('\n')}
${'─'.repeat(40)}
Drayage Total: ${formatCurrency(drayageData.quote.subtotal)}
`)
      }
    } else if (component.responseData.type === 'warehousing') {
      const whData = component.responseData as WarehousingResponseData
      sections.push(`WAREHOUSING/TRANSLOADING QUOTE
${'─'.repeat(40)}
${whData.result.lineItems.map(item => `${item.description.padEnd(35)} ${formatCurrency(item.total).padStart(10)}`).join('\n')}
${'─'.repeat(40)}
Warehousing Total: ${formatCurrency(whData.result.total)}
`)
    }
  }

  sections.push(`${'═'.repeat(40)}
COMBINED TOTAL: ${formatCurrency(data.combinedTotal)}
${'═'.repeat(40)}

Best Regards,
Jacob Hernandez
Operations Lead | FL Distributions
(424) 555-0187`)

  const body = sections.join('\n')

  return {
    markdown: body,
    html: textToHtml(body),
    plainText: body,
    subject,
  }
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const lines = escaped.split('\n')
  const htmlLines = lines.map(line => {
    if (line.startsWith('─') || line.startsWith('═')) {
      return `<hr style="border: none; border-top: 1px solid #E5E7EB; margin: 8px 0;">`
    }
    return line === '' ? '<br>' : `<p style="margin: 4px 0; font-family: monospace; font-size: 13px;">${line}</p>`
  })

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111827;">
${htmlLines.join('\n')}
</body>
</html>`
}
