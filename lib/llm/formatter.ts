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

function firstName(name: string): string {
  return name.split(' ')[0]
}

function categoryForCode(code: string): string {
  if (code === 'BASE' || code === 'DROP') return 'Base Rate'
  if (code === 'WTSUR') return 'Surcharge'
  return 'Accessorial'
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

  const basisNotes = quote.basisNotes.length > 0
    ? quote.basisNotes
    : ['Base rate includes standard port pickup from LA/LB terminals.']
  const notesAndWarnings = [...(data.notes ?? []), ...quote.warnings].filter(Boolean)

  const weightStr = quote.containerWeightLbs ? quote.containerWeightLbs.toLocaleString() + ' lbs' : 'not specified'

  const tableRows = quote.lineItems.map(item =>
    `| ${categoryForCode(item.code)} | ${item.description} | ${formatCurrency(item.amount)} |`
  ).join('\n')

  const fn = firstName(name)

  const body = `Hi ${fn},

Thank you for reaching out.${isRush ? ' We understand this is urgent and have prioritized your quote.' : ''} We are pleased to provide you with a drayage quote for your ${quote.containerSize}-foot container to ${quote.city}${quote.containerWeightLbs ? `, with a cargo weight of ${weightStr}` : ''}. Below is a detailed summary of the pricing for your request.

Quote Summary:

| Category | Item | Amount (USD) |
|---|---|---|
${tableRows}
| **Total** | | **${formatCurrency(quote.subtotal)}** |

Total
The grand total for this drayage service is ${formatCurrency(quote.subtotal)} USD. This amount reflects the sum of all line items listed in the table above.

Basis for Quote
${basisNotes.map(n => `- ${n}`).join('\n')}
${notesAndWarnings.length > 0 ? notesAndWarnings.map(n => `- ${n}`).join('\n') : ''}

Notes & Assumptions
- Quote is based on standard port pickup from the LA/LB terminal complex.
- Rates are valid at the time of quotation and subject to change.
- Any additional accessorials not listed above will be invoiced separately.

If you have any further questions or need additional services, please feel free to reach out.

Best Regards,

Jacob Hernandez
Operations Lead
FL Distribution
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

  const fn = firstName(name)
  const tableRows = data.result.lineItems.map(item =>
    `| Delivery | ${item.description} | ${formatCurrency(item.amount)} |`
  ).join('\n')

  const body = `Hi ${fn},

Thank you for reaching out. We are pleased to provide you with a last-mile delivery quote based on your request. Below is a detailed summary of the pricing.

Quote Summary:

| Category | Item | Amount (USD) |
|---|---|---|
${tableRows}
| **Total** | | **${formatCurrency(data.result.total)}** |

Total
The grand total for this last-mile delivery service is ${formatCurrency(data.result.total)} USD. This amount reflects the sum of all line items listed in the table above.

Basis for Quote
- Quote is based on the delivery details provided in your request.
- Rates reflect current last-mile delivery pricing.

Notes & Assumptions
- Delivery addresses and stop counts are as specified in your request.
- Rates are valid at the time of quotation and subject to change.
- Additional stops or special handling requirements not listed above will be invoiced separately.

If you have any further questions or need additional services, please feel free to reach out.

Best Regards,

Jacob Hernandez
Operations Lead
FL Distribution
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
      if (drayageData.quote && drayageData.quote.subtotal > 0) {
        sections.push(`DRAYAGE QUOTE — ${drayageData.quote.city.toUpperCase()}
${'─'.repeat(40)}
${drayageData.quote.lineItems.map((item: LineItem) => `${item.code.padEnd(8)} ${item.description.padEnd(30)} ${formatCurrency(item.amount).padStart(10)}`).join('\n')}
${'─'.repeat(40)}
Drayage Total: ${formatCurrency(drayageData.quote.subtotal)}
`)
      } else if (drayageData.missingFields?.length) {
        sections.push(`DRAYAGE — Additional info needed: ${drayageData.missingFields.join(', ')}\n`)
      }
    } else if (component.responseData.type === 'warehousing') {
      const whData = component.responseData as WarehousingResponseData
      if (whData.result.total > 0) {
        sections.push(`WAREHOUSING/TRANSLOADING QUOTE
${'─'.repeat(40)}
${whData.result.lineItems.map(item => `${item.description.padEnd(35)} ${formatCurrency(item.total).padStart(10)}`).join('\n')}
${'─'.repeat(40)}
Warehousing Total: ${formatCurrency(whData.result.total)}
`)
      }
    }
  }

  // If only one component has a real total, skip the redundant combined line
  const nonZeroComponents = data.components.filter(c => c.total > 0)
  if (nonZeroComponents.length === 1) {
    const single = nonZeroComponents[0]
    if (single.responseData.type === 'drayage') {
      return formatDrayageResult(single.responseData as DrayageResponseData, contactInfo, originalMessage)
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
