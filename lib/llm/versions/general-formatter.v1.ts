import { openai, MODEL } from '../client'
import { trackLlmCall } from '../../db/llm-tracker'
import type { ContactInfo } from '../../types/preprocessor'

interface FormatGeneralInquiryParams {
  contactInfo: ContactInfo
  originalMessage: string
  context: { tenantId: string; projectId: string; threadId: string }
}

export async function formatGeneralInquiryResponse(params: FormatGeneralInquiryParams): Promise<string> {
  const { contactInfo, originalMessage, context } = params
  const startTime = Date.now()

  const prompt = `You are responding to a general inquiry email for FL Distribution, a Southern California warehousing and freight logistics company.

Company info:
- Services: Drayage (port container moves from LA/Long Beach), Warehousing/Transloading, Last-Mile Delivery
- Location: Southern California
- Contact: quotes@fldistribution.com
- Phone: (424) 555-0187

Customer: ${contactInfo.name || 'Team'} ${contactInfo.company ? `from ${contactInfo.company}` : ''}
Their message: ${originalMessage.slice(0, 800)}

Write a helpful, professional response. Be concise.

IMPORTANT: Do NOT generate any pricing estimates, dollar amounts, or quote figures. If the customer is asking for a quote, acknowledge their request and let them know the team will follow up with an accurate quote shortly.

Sign off as:
Jacob Hernandez
Operations Lead | FL Distributions
(424) 555-0187

Plain text only, no HTML, no markdown.`

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: 'system', content: 'You write professional, helpful responses for a logistics company. Return only the email body, no subject line.' },
      { role: 'user', content: prompt },
    ],
  })

  const responseTimeMs = Date.now() - startTime
  const text = response.choices[0].message.content ?? ''

  await trackLlmCall({
    tenantId: context.tenantId,
    projectId: context.projectId,
    threadId: context.threadId,
    callType: 'format_general_inquiry',
    callStage: 'outbound',
    model: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    responseTimeMs,
  })

  return text
}
