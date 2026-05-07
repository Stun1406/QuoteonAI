import { NextRequest, NextResponse } from 'next/server'
import { openai, MODEL } from '@/lib/llm/client'

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json() as { message: string }

    if (!message?.trim()) {
      return NextResponse.json({ outcome: null })
    }

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You analyze email replies from customers who have received a freight shipping quote.

Determine if the customer is making a FINAL DECISION about the quote.

Return ONLY valid JSON — no markdown, no explanation:
- {"outcome": "won"}  — customer is clearly and unambiguously ACCEPTING the quote and wants to proceed or book
- {"outcome": "lost"} — customer is clearly and unambiguously DECLINING, rejecting, or going with another provider
- {"outcome": null}   — customer is asking a question, requesting a change, negotiating, or intent is unclear

Be conservative. When in doubt, return {"outcome": null}.`,
        },
        {
          role: 'user',
          content: message.slice(0, 1500),
        },
      ],
      max_tokens: 20,
      temperature: 0,
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw) as { outcome: 'won' | 'lost' | null }
    return NextResponse.json({ outcome: parsed.outcome ?? null })
  } catch {
    return NextResponse.json({ outcome: null })
  }
}
