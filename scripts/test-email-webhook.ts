import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { createHmac } from 'crypto'

const BASE_URL = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'test-secret'

function sign(fields: Record<string, string>): string {
  const sorted = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('&')
  return createHmac('sha256', WEBHOOK_SECRET).update(sorted).digest('hex')
}

async function main() {
  console.log('=== Email Webhook Test ===\n')

  const rawEmail = `From: john.smith@acmelogistics.com
To: quotes@fldistribution.com
Subject: Drayage Quote Request - Riverside CA
Message-ID: <test-${Date.now()}@acmelogistics.com>
Content-Type: text/plain

Hi,

We need a drayage quote for a 40ft container to Riverside, CA.
Weight: 38,000 lbs. Need 2 chassis days.

Best,
John Smith
Acme Logistics
john.smith@acmelogistics.com
(310) 555-0100`

  const messageId = `<test-${Date.now()}@acmelogistics.com>`
  const timestamp = new Date().toISOString()

  const formFields: Record<string, string> = {
    'message-id': messageId,
    'from': 'john.smith@acmelogistics.com',
    'to': 'quotes@fldistribution.com',
    'subject': 'Drayage Quote Request - Riverside CA',
    'timestamp': timestamp,
    'spf': 'pass',
    'dkim': 'pass',
  }

  const signature = sign(formFields)

  const formData = new FormData()
  Object.entries(formFields).forEach(([k, v]) => formData.append(k, v))
  formData.append('raw', rawEmail)

  console.log('Sending webhook...')
  const res = await fetch(`${BASE_URL}/api/webhooks/email`, {
    method: 'POST',
    headers: { 'x-webhook-signature': signature },
    body: formData,
  })

  const result = await res.json()
  console.log('Status:', res.status)
  console.log('Result:', JSON.stringify(result, null, 2))

  // Test duplicate
  console.log('\nTesting duplicate detection...')
  const res2 = await fetch(`${BASE_URL}/api/webhooks/email`, {
    method: 'POST',
    headers: { 'x-webhook-signature': signature },
    body: formData,
  })
  const result2 = await res2.json()
  console.log('Status:', res2.status)
  console.log('Result:', result2.status)

  console.log('\n=== Done ===')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
