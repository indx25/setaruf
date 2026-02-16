type Entry = {
  attempts: number[]
  blockedUntil?: number
}

const store = new Map<string, Entry>()
const RATE_LIMIT = 3
const WINDOW_MS = 2 * 60_000
const BLOCK_MS = 2 * 60_000

function now() {
  return Date.now()
}

export function isBlocked(key: string): boolean {
  const e = store.get(key)
  if (!e) return false
  if (e.blockedUntil && e.blockedUntil > now()) return true
  return false
}

export function recordWrongQuizAttempt(key: string): void {
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
