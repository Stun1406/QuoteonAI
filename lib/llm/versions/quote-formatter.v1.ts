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

  const prompt = `You are writing a professional quote email for FL Distribution, a Southern California warehousing and freight logistics company.

Customer: ${contactInfo.name || 'Team'} ${contactInfo.company ? `from ${contactInfo.company}` : ''}
Original request: ${originalMessage.slice(0, 500)}

Quote summary:
${lineItemsSummary}
Subtotal: ${formatCurrency(result.subtotal)}
${result.discountPct > 0 ? `Discount (${result.discountPct}%): -${formatCurrency(result.discountAmount)}` : ''}
Total: ${formatCurrency(result.total)}

${result.warnings.length > 0 ? `Notes: ${result.warnings.join('; ')}` : ''}

Write a professional, concise quote email. Include:
1. Brief greeting using the customer's first name (or "Team" if unknown)
2. The quote line items as a markdown table with exactly these columns: | Description | Amount |
3. A separator row after the header: |---|---|
4. A bold TOTAL row at the bottom: | **TOTAL** | **$X.XX** |
5. The signature: Jacob Hernandez, Operations Lead, FL Distributions, (424) 555-0187

Use markdown table format (pipe-separated). Do not use HTML. Keep it professional and data-focused.`

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
