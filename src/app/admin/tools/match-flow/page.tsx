"use client"

import { useEffect, useMemo, useState } from "react"

type Item = {
  id: string
  status: string
  step: string | null
  updatedAt: string
  matchPercentage: number | null
  requester: { id: string; name: string | null; email: string | null }
  target: { id: string; name: string | null; email: string | null }
}

type Summary = {
  total: number
  byStatus: Record<string, number>
  byStep: Record<string, number>
}

export default function AdminMatchFlowPage() {
  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [status, setStatus] = useState<string>("")
  const [step, setStep] = useState<string>("")
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (append = false, c?: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (step) params.set("step", step)
      if (c) params.set("cursor", c)
      params.set("limit", "50")
      const res = await fetch(`/api/admin/metrics/match-flow?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`${res.status}`)
      const j = await res.json()
      setSummary(j.summary)
      setNextCursor(j.nextCursor || null)
      if (append) setItems(prev => [...prev, ...j.items])
      else setItems(j.items)
    } catch (e: any) {
      setError(e?.message || "Error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(false, null); setCursor(null) }, [status, step])

  const statuses = useMemo(() => Object.keys(summary?.byStatus || {}).length ? Object.keys(summary!.byStatus) : ['pending','approved','rejected','blocked'], [summary])
  const steps = useMemo(() => Object.keys(summary?.byStep || {}), [summary])

  return (
    <div style={{ maxWidth: 1100, margin: "32px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Audit Match Flow</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Status: All</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={step} onChange={e => setStep(e.target.value)} style={{ minWidth: 260 }}>
          <option value="">Step: All</option>
          {steps.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => load(false, null)} disabled={loading}>Refresh</button>
      </div>
      {error && <div style={{ color: "crimson", marginBottom: 12 }}>Error: {error}</div>}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Total</div>
            <div>{summary.total}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>By Status</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6 }}>
              {Object.entries(summary.byStatus).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>By Step (Top)</div>
            <div style={{ maxHeight: 160, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6 }}>
              {Object.entries(summary.byStep).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Match</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Requester</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Target</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Status</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Step</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Kecocokan</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", fontFamily: "ui-monospace, SFMono-Regular" }}>{it.id.slice(0,8)}…</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{it.requester.name || it.requester.email || it.requester.id}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{it.target.name || it.target.email || it.target.id}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{it.status}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{it.step || "-"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{it.matchPercentage ?? "-"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{new Date(it.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={7} style={{ padding: 12, textAlign: "center", color: "#6b7280" }}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={() => load(false, null)} disabled={loading}>Reload</button>
        <button onClick={() => { if (nextCursor) { load(true, nextCursor); setCursor(nextCursor) } }} disabled={!nextCursor || loading}>Load More</button>
      </div>
    </div>
  )
}

