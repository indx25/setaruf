type Entry = { attempts: number[]; blockedUntil?: number }
const store = new Map<string, Entry>()
const throttleStore = new Map<string, number[]>()
const RATE_LIMIT = 5
const WINDOW_MS = 60_000
const BLOCK_MS = 60_000

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || ''
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ''

function now() { return Date.now() }

async function upstashGet(key: string): Promise<string | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      cache: 'no-store',
    })
    const data = await res.json()
    return typeof data.result === 'string' ? data.result : null
  } catch { return null }
}

async function upstashSet(key: string, value: string, ttlMs?: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return
  try {
    await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    })
    if (ttlMs && ttlMs > 0) {
      const sec = Math.ceil(ttlMs / 1000)
      await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(key)}/${sec}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      })
    }
  } catch {}
}

async function upstashIncrExpire(key: string, ttlMs: number): Promise<number | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  try {
    const res = await fetch(`${UPSTASH_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    })
    const data = await res.json()
    const count = typeof data.result === 'number' ? data.result : null
    const sec = Math.ceil(ttlMs / 1000)
    await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(key)}/${sec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    })
    return count
  } catch { return null }
}

export async function isBlocked(key: string): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const blockedUntilStr = await upstashGet(`block:${key}`)
    const until = blockedUntilStr ? parseInt(blockedUntilStr, 10) : 0
    return !!until && until > now()
  }
  const e = store.get(key)
  return !!(e && e.blockedUntil && e.blockedUntil > now())
}

export async function recordWrongQuizAttempt(key: string): Promise<void> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const attempts = await upstashIncrExpire(`attempts:${key}`, WINDOW_MS)
    if ((attempts ?? 0) >= RATE_LIMIT) {
      const until = (now() + BLOCK_MS).toString()
      await upstashSet(`block:${key}`, until, BLOCK_MS)
      await upstashSet(`attempts:${key}`, '0', WINDOW_MS)
    }
    return
  }
  const t = now()
  const e = store.get(key) || { attempts: [] }
  e.attempts = e.attempts.filter((x) => t - x < WINDOW_MS)
  e.attempts.push(t)
  if (e.attempts.length >= RATE_LIMIT) {
    e.blockedUntil = t + BLOCK_MS
    e.attempts = []
  }
  store.set(key, e)
}

export async function throttle(key: string, limit: number, windowMs: number): Promise<boolean> {
  const k = `th:${key}`
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const count = await upstashIncrExpire(k, windowMs)
    return (count ?? 0) <= limit
  }
  const t = now()
  const arr = throttleStore.get(k) || []
  const filtered = arr.filter((x) => t - x < windowMs)
  filtered.push(t)
  throttleStore.set(k, filtered)
  return filtered.length <= limit
}
