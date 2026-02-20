export type LogItem = {
  id: string
  type: string
  action: string
  userId?: string
  userName?: string | null
  detail?: string
  at: string
}

const MAX_ITEMS = 1000
const ring: LogItem[] = []

function genId(prefix = 'log') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function record(item: Omit<LogItem, 'id' | 'at'> & Partial<Pick<LogItem, 'id' | 'at'>>) {
  const entry: LogItem = {
    id: item.id || genId(item.type || 'log'),
    at: item.at || new Date().toISOString(),
    type: item.type || 'info',
    action: item.action || 'event',
    userId: item.userId,
    userName: item.userName ?? null,
    detail: item.detail
  }
  ring.push(entry)
  if (ring.length > MAX_ITEMS) {
    ring.splice(0, ring.length - MAX_ITEMS)
  }
}

export function query(opts: {
  type?: string
  action?: string
  q?: string
  from?: Date | null
  to?: Date | null
  limit?: number
} = {}) {
  const type = (opts.type || '').toLowerCase()
  const action = (opts.action || '').toLowerCase()
  const q = (opts.q || '').toLowerCase()
  const from = opts.from || null
  const to = opts.to || null
  const limit = Math.min(Math.max(opts.limit || 300, 1), 1000)
  const filtered = ring.filter(it => {
    if (type && it.type.toLowerCase() !== type) return false
    if (action && it.action.toLowerCase() !== action) return false
    if (q && !(`${it.userName || ''} ${it.detail || ''} ${it.type} ${it.action}`).toLowerCase().includes(q)) return false
    const atDate = new Date(it.at)
    if (from && atDate < from) return false
    if (to && atDate > to) return false
    return true
  })
  return filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit)
}

