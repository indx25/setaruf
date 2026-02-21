import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const ENGINE_VERSION = 2

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function readinessFromVector(v: any) {
  if (!v) return 50
  const s = Number(v.stability ?? 50)
  const a = Number(v.attachmentSecurity ?? 50)
  const r = Number(v.religiosity ?? 50)
  const e = Number(v.empathy ?? 50)
  return Math.round((clamp(s, 0, 100) * 0.35) + (clamp(a, 0, 100) * 0.25) + (clamp(r, 0, 100) * 0.2) + (clamp(e, 0, 100) * 0.2))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const me = await db.user.findUnique({ where: { id: user.id } })
  if (!me?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const totalUsers = await db.user.count()
  const missingTraitVectors = await db.user.count({
    where: { OR: [{ traitVector: null }, { traitVersion: { not: ENGINE_VERSION } }, { traitVersion: null }] }
  })
  const avgConflict = await db.match.aggregate({
    _avg: { conflictRiskScore: true }
  })
  const sampleSize = Math.min(1000, await db.user.count({ where: { traitVector: { not: null } } }))
  const sample = await db.user.findMany({
    where: { traitVector: { not: null } },
    select: { traitVector: true },
    take: sampleSize
  })
  let rLow = 0, rMid = 0, rHigh = 0, rVeryHigh = 0
  for (const u of sample) {
    const r = readinessFromVector(u.traitVector as any)
    if (r < 40) rLow++
    else if (r < 60) rMid++
    else if (r < 75) rHigh++
    else rVeryHigh++
  }
  const matchesCount = await db.match.count()
  const driftSampleSize = Math.min(1000, matchesCount)
  const driftSample = await db.match.findMany({
    orderBy: { updatedAt: 'desc' },
    take: driftSampleSize,
    select: {
      matchPercentage: true,
      conflictRiskScore: true,
      emotionalStabilityScore: true,
      lifeAlignmentScore: true,
      compatibilityScore: true
    }
  })
  let deltaSum = 0, above5 = 0, counted = 0
  for (const m of driftSample) {
    const comp = Number(m.compatibilityScore ?? 0)
    const conf = Number(m.conflictRiskScore ?? 0)
    const em = Number(m.emotionalStabilityScore ?? 0)
    const life = Number(m.lifeAlignmentScore ?? 0)
    if (!isFinite(comp + conf + em + life)) continue
    const expected = Math.round((comp * 0.35) + (life * 0.25) + (em * 0.2) + ((100 - conf) * 0.2))
    const stored = Number(m.matchPercentage ?? expected)
    const delta = Math.abs(expected - stored)
    deltaSum += delta
    if (delta >= 5) above5++
    counted++
  }
  const avgDelta = counted ? Math.round((deltaSum / counted) * 100) / 100 : 0
  const pctAbove5 = counted ? Math.round((above5 / counted) * 10000) / 100 : 0
  let precomputeStatus: any = null
  try {
    const s = await db.settings.findUnique({ where: { key: 'precompute_traits_status' } })
    if (s?.value) {
      try { precomputeStatus = JSON.parse(s.value) } catch { precomputeStatus = s.value }
    }
  } catch {}
  return NextResponse.json({
    engineVersion: ENGINE_VERSION,
    users: { total: totalUsers, missingTraitVectors },
    conflictRisk: { avg: Math.round((avgConflict._avg.conflictRiskScore ?? 0) * 100) / 100 },
    readinessBuckets: {
      lt40: rLow,
      b40_59: rMid,
      b60_74: rHigh,
      gte75: rVeryHigh,
      sample: sampleSize
    },
    drift: { sample: counted, avgDelta, pctAbove5 },
    precompute: precomputeStatus
  })
}
