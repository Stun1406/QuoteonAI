import { NextRequest, NextResponse } from 'next/server'
import { getTenantProjectContext } from '@/lib/db/context'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const { tenantId, projectId } = getTenantProjectContext()
    const body = await req.json().catch(() => ({}))

    const testMessage = body.message ?? `Hi,

I need a drayage quote for a 40ft container going to Ontario, CA from the Port of Long Beach.
Container weight is approximately 42,000 lbs.
We'll need 3 chassis days.

Thanks,
John Smith
Acme Logistics
john.smith@acmelogistics.com
(310) 555-0100`

    const response = await fetch(`${req.nextUrl.origin}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testMessage }),
    })

    const result = await response.json()

    // Also run convert
    if (result.threadUuid && result.processorType !== 'general') {
      const convertResponse = await fetch(`${req.nextUrl.origin}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: result,
          originalRequest: testMessage,
          threadId: result.threadUuid,
        }),
      })
      const convertResult = await convertResponse.json()
      return NextResponse.json({ process: result, convert: convertResult })
    }

    return NextResponse.json({ process: result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
