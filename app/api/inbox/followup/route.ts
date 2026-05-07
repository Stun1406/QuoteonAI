import { NextRequest, NextResponse } from 'next/server'
import { openai, MODEL } from '@/lib/llm/client'

const SYSTEM_PROMPT = `You are Jacob Hernandez, Operations Lead at FL Distribution, responding to a customer follow-up about a freight quote you have already sent them.

Your role:
- Answer the customer's question or comment directly and concisely
- Do NOT re-generate or re-quote pricing unless the customer explicitly asks for a revised quote
- Do NOT summarize the original quote back to them unless specifically asked
- If they have a question about timing, process, or next steps, answer it professionally
- Keep the response short (2-4 sentences) and warm
- Always close with your standard signature

Signature format:
Best Regards,

Jacob Hernandez
Operations Lead
FL Distribution
(424) 555-0187`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      customerMessage: string
      originalSubject: string
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    const { customerMessage, originalSubject, conversationHistory = [] } = body

    if (!customerMessage?.trim()) {
      return NextResponse.json({ error: 'customerMessage is required' }, { status: 400 })
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    if (originalSubject) {
      messages.push({
        role: 'system',
        content: `Quote thread subject: "${originalSubject}"`,
      })
    }

    for (const m of conversationHistory.slice(-6)) {
      messages.push({ role: m.role, content: m.content })
    }

    messages.push({ role: 'user', content: customerMessage })

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 400,
      temperature: 0.4,
    })

    const reply = completion.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[/api/inbox/followup] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI follow-up failed' },
      { status: 500 },
    )
  }
}
