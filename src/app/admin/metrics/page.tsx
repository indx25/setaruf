"use client"
import { useEffect, useState } from 'react'

type Obs = {
  engineVersion: number
  users: { total: number; missingTraitVectors: number }
  conflictRisk: { avg: number }
  readinessBuckets: { lt40: number; b40_59: number; b60_74: number; gte75: number; sample: number }
  drift: { sample: number; avgDelta: number; pctAbove5: number }
  precompute?: any
}

export default function AdminMetricsPage() {
  const [data, setData] = useState<Obs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/metrics/observability', { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      const j = await res.json()
      setData(j)
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = data?.users.total ?? 0
  const missing = data?.users.missingTraitVectors ?? 0
  const pctReady = total ? Math.round(((total - missing) / total) * 100) : 0

  return (
    <div style={{ maxWidth: 920, margin: '32px auto', padding: 16 }}>
      <h1>Observability & Metrics</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={load} disabled={loading} style={{ padding: '8px 14px' }}>
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>Error: {error}</div>}
      {!data ? (
        <div>Memuat...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Engine</div>
            <div>Version: {data.engineVersion}</div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>TraitVector Coverage</div>
            <div>Total users: {total}</div>
            <div>Missing traitVector: {missing}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctReady}%`, background: '#16a34a' }} />
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{pctReady}% ready</div>
            </div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Conflict Risk</div>
            <div>Rata-rata: {data.conflictRisk.avg}</div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Distribusi Readiness</div>
            <div>&lt;40: {data.readinessBuckets.lt40}</div>
            <div>40–59: {data.readinessBuckets.b40_59}</div>
            <div>60–74: {data.readinessBuckets.b60_74}</div>
            <div>≥75: {data.readinessBuckets.gte75}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Sample: {data.readinessBuckets.sample}</div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Drift</div>
            <div>Sample: {data.drift.sample}</div>
            <div>Avg delta: {data.drift.avgDelta}</div>
            <div>≥5 delta: {data.drift.pctAbove5}%</div>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Precompute Status</div>
            {data.precompute ? (
              <>
                <div>Processed: {data.precompute.processed ?? '-'}</div>
                <div>Cursor: {data.precompute.cursor ?? '-'}</div>
                <div>Durasi batch: {data.precompute.durationMs ?? 0} ms</div>
                <div>Error count: {data.precompute.errors ?? 0}</div>
                <div>Updated: {data.precompute.updated ?? 0}</div>
                <div>Skipped: {data.precompute.skipped ?? 0}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>TS: {data.precompute.ts ?? '-'}</div>
              </>
            ) : (
              <div>-</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
