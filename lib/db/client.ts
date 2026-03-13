import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

// Lazy initialization — avoids crashing at build time when DATABASE_URL is absent
let _sql: NeonQueryFunction<false, false> | null = null

export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is not set')
  _sql = neon(url)
  return _sql
}

// Use a callable function as the proxy target so tagged-template calls work
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _target = function () {} as any
export const sql: NeonQueryFunction<false, false> = new Proxy(_target, {
  apply(_t, _thisArg, args) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get(_t, prop) {
    return (getSql() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
