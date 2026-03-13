import { config } from 'dotenv'
config({ path: '.env.local' })
config()

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'

  console.log('=== FLD-CRM Phase 2 Integration Test ===\n')

  // Test 1: Drayage quote
  console.log('Test 1: Drayage quote (Ontario, CA)...')
  const drayageRes = await fetch(`${baseUrl}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Hello,

We need a drayage quote for a 40ft container going to Ontario, CA from the Port of Long Beach.
Container weight is approximately 42,000 lbs. We'll need 3 chassis days.

Thanks,
John Smith
Acme Logistics
john.smith@acmelogistics.com
(310) 555-0100`
    }),
  })
  const drayageResult = await drayageRes.json()
  console.log('Status:', drayageRes.status)
  console.log('Processor:', drayageResult.processorType)
  console.log('Thread ID:', drayageResult.threadId)
  if (drayageResult.responseData?.type === 'drayage' && drayageResult.responseData?.quote) {
    console.log('Quote subtotal:', drayageResult.responseData.quote.subtotal)
  }
  console.log('')

  // Test 2: Warehouse quote
  console.log('Test 2: Warehouse/transloading quote...')
  const whRes = await fetch(`${baseUrl}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Hi,

We have 2 x 40ft containers arriving next week. We need them transloaded onto pallets (approx 20 pallets each).
We'll also need shrink wrap and BOL. Storage for 30 days.

- Sarah Johnson
sarah@globaltrade.com`
    }),
  })
  const whResult = await whRes.json()
  console.log('Status:', whRes.status)
  console.log('Processor:', whResult.processorType)
  if (whResult.responseData?.type === 'warehousing') {
    console.log('Quote total:', whResult.responseData.result.total)
  }
  console.log('')

  // Test 3: Convert
  if (drayageResult.threadUuid && drayageResult.processorType !== 'general') {
    console.log('Test 3: Convert to email format...')
    const convertRes = await fetch(`${baseUrl}/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: drayageResult,
        originalRequest: 'Drayage quote for Ontario CA',
        threadId: drayageResult.threadUuid,
      }),
    })
    const convertResult = await convertRes.json()
    console.log('Status:', convertRes.status)
    console.log('Subject:', convertResult.subject)
    console.log('Has markdown:', !!convertResult.markdown)
    console.log('')
  }

  console.log('=== Tests complete ===')
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
