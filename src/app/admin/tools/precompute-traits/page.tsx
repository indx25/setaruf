"use client"
import { useState, useCallback } from 'react'

export default function PrecomputeTraitsPage() {
  const [running, setRunning] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [lastBatch, setLastBatch] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [avgRate, setAvgRate] = useState<number>(0)

  const runOnce = useCallback(async (cur: string | null) => {
    const qs = new URLSearchParams()
    qs.set('take', '200')
    if (cur) qs.set('cursor', cur)
    const res = await fetch(`/api/admin/precompute-traits?${qs.toString()}`, { method: 'POST' })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`${res.status} ${txt}`)
    }
    return res.json() as Promise<{ done: boolean; processed: number; nextCursor: string | null; totalUsers?: number }>
  }, [])

  const onStart = useCallback(async () => {
    if (running) return
    setRunning(true)
    setError(null)
    if (!startedAt) setStartedAt(Date.now())
    try {
      let cur = cursor
      let totalLocal = processed
      let totalUsersLocal = total ?? 0
      const start = startedAt || Date.now()
      for (;;) {
        const r = await runOnce(cur)
        setLastBatch(r.processed)
        totalLocal += r.processed
        setProcessed(totalLocal)
        setCursor(r.nextCursor)
        if (typeof r.totalUsers === 'number' && (!totalUsersLocal || totalUsersLocal < r.totalUsers)) {
          totalUsersLocal = r.totalUsers
          setTotal(r.totalUsers)
        }
        const elapsedSec = (Date.now() - start) / 1000
        if (elapsedSec > 0) {
          setAvgRate(totalLocal / elapsedSec)
        }
        if (r.done || r.processed === 0) break
        await new Promise(res => setTimeout(res, 200))
      }
    } catch (e: any) {
      setError(e?.message || 'Unknown error')
    } finally {
      setRunning(false)
    }
  }, [running, cursor, processed, runOnce, startedAt, total])

  const onReset = useCallback(() => {
    setCursor(null)
    setProcessed(0)
    setLastBatch(0)
    setError(null)
    setTotal(null)
    setStartedAt(null)
    setAvgRate(0)
  }, [])

  const pct = total ? Math.min(100, Math.round((processed / total) * 100)) : null
  const etaSec = avgRate > 0 && total ? Math.max(0, Math.round((total - processed) / avgRate)) : null
  const etaMin = etaSec ? Math.floor(etaSec / 60) : null
  const etaRem = etaSec ? (etaSec % 60) : null
  const estBatches = total ? Math.ceil(total / 200) : null

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1>Precompute Trait Vectors</h1>
      <p>Jalankan batch precompute traitVector untuk semua user.</p>
      <div style={{ marginBottom: 8, fontSize: 13 }}>
        Tips: Jalankan beberapa kali sampai processed mencapai total user. Gunakan endpoint observability untuk memantau kualitas.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onStart} disabled={running} style={{ padding: '8px 16px' }}>
          {running ? 'Memproses...' : 'Mulai / Lanjutkan'}
        </button>
        <button onClick={onReset} disabled={running} style={{ padding: '8px 16px' }}>
          Reset
        </button>
      </div>
      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <div>Total diproses: {processed}</div>
        <div>Total user: {total ?? '-'}</div>
        <div>Batch terakhir: {lastBatch}</div>
        <div>Cursor saat ini: {cursor ?? '-'}</div>
        <div>Perkiraan total batch: {estBatches ?? '-'}</div>
        <div>Kecepatan rata-rata: {avgRate ? `${avgRate.toFixed(1)} user/detik` : '-'}</div>
        <div>Perkiraan selesai: {etaSec != null ? `${etaMin}m ${etaRem}s` : '-'}</div>
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct ?? 0}%`, background: '#4f46e5' }} />
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{pct != null ? `${pct}%` : '-'}</div>
        </div>
        {error && <div style={{ color: 'crimson', marginTop: 8 }}>Error: {error}</div>}
      </div>
      <p style={{ marginTop: 16 }}>Akses khusus admin. Endpoint: /api/admin/precompute-traits</p>
    </div>
  )
}
