import { kvGet, kvSetWithTTL } from './rate-limit'

export async function ensureIdempotency(key: string | null, userId: string, ttlSeconds = 60) {
  if (!key) return
  const k = `idem:${userId}:${key}`
  const exists = await kvGet(k)
  if (exists) {
    const e: any = new Error('IDEMPOTENT')
    e.code = 'IDEMPOTENT'
    throw e
  }
  await kvSetWithTTL(k, ttlSeconds)
}

