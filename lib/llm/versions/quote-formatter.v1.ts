import { openai, MODEL } from '../client'
import { trackLlmCall } from '../../db/llm-tracker'
import type { ContactInfo } from '../../types/preprocessor'
import type { QuoteExtraction, QuoteResult } from '../../types/quote'
import { formatCurrency } from '../../utils/currency'

interface FormatWarehouseQuoteParams {
  contactInfo: ContactInfo
  extraction: QuoteExtraction
  result: QuoteResult
  originalMessage: string
  context: { tenantId: string; projectId: string; threadId: string }
}

export async function formatWarehouseQuoteEmail(params: FormatWarehouseQuoteParams): Promise<string> {
  const { contactInfo, extraction, result, originalMessage, context } = params
  const startTime = Date.now()

  const lineItemsSummary = result.lineItems.map(item =>
    `- ${item.description}: ${item.quantity} × $${item.unitPrice} = ${formatCurrency(item.total)}`
  ).join('\n')

  const firstName = (contactInfo.name || 'Team').split(' ')[0]
  const discountLine = result.discountPct > 0
    ? `Discount (${result.discountPct}%): -${formatCurrency(result.discountAmount)}\n` : ''

  const prompt = `You are writing a professional quote email for FL Distribution, a Southern California warehousing and freight logistics company.

Customer first name: ${firstName}
Original request: ${originalMessage.slice(0, 600)}

Line items:
${lineItemsSummary}
${discountLine}Total: ${formatCurrency(result.total)}

${result.warnings.length > 0 ? `Warnings/notes from the system: ${result.warnings.join('; ')}` : ''}

Write the email body using EXACTLY this structure (do not deviate from the format):

Hi ${firstName},

Thank you for reaching out. [Write 1–2 sentences summarising what the customer requested, referencing the specific service type, container size, number of pallets, and any special handling from the original request.]

Quote Summary:

| Category | Item | Amount (USD) |
|---|---|---|
[For each line item, assign a Category (use: Transloading / Accessorial / Documentation / Storage / Discount) based on what the item is. Use the exact item description from the line items above. Format amounts as $X.XX]
| **Total** | | **${formatCurrency(result.total)}** |

Total
The grand total for this service is ${formatCurrency(result.total)} USD. This amount reflects the sum of all line items listed in the table above.

Basis for Quote
[Write 2–4 bullet points (using - ) explaining the key facts the quote is based on — e.g. number of containers, pallet count, container size, services included, services excluded.]

Notes & Assumptions
[Write 2–3 bullet points (using - ) covering assumptions made — e.g. pallets are standard size, no additional handling required, rates are based on current pricing.]

If you have any further questions or need additional services, please feel free to reach out.

Best Regards,

Jacob Hernandez
Operations Lead
FL Distribution
(424) 555-0187

Rules:
- Use the exact table format above with pipe characters
- Do not add extra sections or change section names
- Do not use HTML
- Do not add a subject line`

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: 'You write professional logistics quote emails. Return only the email body text, no subject line, no markdown formatting.' },
      { role: 'user', content: prompt },
    ],
  })

  const responseTimeMs = Date.now() - startTime
  const text = response.choices[0].message.content ?? ''

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'format_warehouse_quote',
    callStage: 'outbound',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  return text
}
