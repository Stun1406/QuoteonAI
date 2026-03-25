import { createHmac, createHash, timingSafeEqual } from 'crypto'

export function verifyWebhookSignature(
  formFields: Record<string, string>,
  signature: string,
  secret: string
): boolean {
  try {
    // Sort fields and join as key=value&...
    const sorted = Object.keys(formFields)
      .sort()
      .map(key => `${key}=${formFields[key]}`)
      .join('&')

    const expected = createHmac('sha256', secret).update(sorted).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const signatureBuf = Buffer.from(signature, 'hex')

    if (expectedBuf.length !== signatureBuf.length) return false
    return timingSafeEqual(expectedBuf, signatureBuf)
  } catch {
    return false
  }
}

export function generateCanonicalId(
  messageId: string | null,
  from: string,
  subject: string,
  timestamp: string
): string {
  if (messageId) return messageId

  const raw = `${from}|${subject}|${timestamp}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}
