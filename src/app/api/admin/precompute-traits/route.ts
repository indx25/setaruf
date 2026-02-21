export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const ENGINE_VERSION = 2

interface TraitVector {
  dominance: number
  stability: number
  empathy: number
  logic: number
  religiosity: number
  conflictStyle: number
  attachmentSecurity: number
  ambition: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function extractTraitVector(tests: Array<{ testType: string; score: number | null }>): TraitVector {
  const get = (type: string) => {
    const t = tests.find(tt => tt.testType === type)
    return typeof t?.score === 'number' ? clamp(t.score, 0, 100) : 50
  }
  return {
    dominance: get('disc'),
    stability: get('clinical'),
    empathy: get('pre_marriage'),
    logic: get('16pf'),
    religiosity: get('pre_marriage'),
    conflictStyle: get('disc'),
    attachmentSecurity: get('clinical'),
    ambition: get('16pf')
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const me = await db.user.findUnique({ where: { id: user.id } })
  if (!me?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const take = Math.max(1, Math.min(500, Number(searchParams.get('take') || '200')))
  const cursor = searchParams.get('cursor') || null
  const sleepMs = Math.max(0, Math.min(2000, Number(searchParams.get('sleepMs') || '0')))
  const maxRetries = Math.max(0, Math.min(5, Number(searchParams.get('maxRetries') || '3')))

  const totalUsers = await db.user.count()
  const users = await db.user.findMany({
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      traitVersion: true,
      traitUpdatedAt: true
    }
  })
  if (users.length === 0) {
    await db.settings.upsert({
      where: { key: 'precompute_traits_status' },
      create: { key: 'precompute_traits_status', value: JSON.stringify({ ts: Date.now(), processed: 0, cursor: null, durationMs: 0, errors: 0 }) },
      update: { value: JSON.stringify({ ts: Date.now(), processed: 0, cursor: null, durationMs: 0, errors: 0 }) }
    })
    return NextResponse.json({ done: true, processed: 0, nextCursor: null, totalUsers, staleCandidates: 0, updatedCount: 0, skippedFresh: 0, errorCount: 0, lastBatchDurationMs: 0 })
  }
  const targetIds = users.map(u => u.id)
  const tests = await db.psychoTest.findMany({
    where: { userId: { in: targetIds } },
    select: { userId: true, testType: true, score: true, createdAt: true }
  })
  const byUser: Record<string, Array<{ testType: string; score: number | null; createdAt: Date }>> = {}
  for (const t of tests) {
    byUser[t.userId] = byUser[t.userId] || []
    byUser[t.userId].push({ testType: t.testType, score: t.score ?? null, createdAt: t.createdAt })
  }
  const start = Date.now()
  let updatedCount = 0
  let skippedFresh = 0
  let errorCount = 0
  let staleCandidates = 0
  for (const u of users) {
    const arr = byUser[u.id] || []
    let latest = null as Date | null
    for (const it of arr) {
      if (!latest || it.createdAt > latest) latest = it.createdAt
    }
    const stale = u.traitVersion !== ENGINE_VERSION || !u.traitUpdatedAt || (latest && u.traitUpdatedAt < latest)
    if (!stale) {
      skippedFresh++
      continue
    }
    staleCandidates++
    const vec = extractTraitVector(arr)
    let attempt = 0
    for (;;) {
      try {
        await db.user.update({
          where: { id: u.id },
          data: { traitVector: vec as any, traitVersion: ENGINE_VERSION, traitUpdatedAt: new Date() }
        })
        updatedCount++
        break
      } catch {
        attempt++
        errorCount++
        if (attempt > maxRetries) break
        if (sleepMs) await new Promise(res => setTimeout(res, sleepMs))
      }
    }
    if (sleepMs) await new Promise(res => setTimeout(res, sleepMs))
  }
  const duration = Date.now() - start
  const nextCursor = users[users.length - 1]?.id || null
  await db.settings.upsert({
    where: { key: 'precompute_traits_status' },
    create: { key: 'precompute_traits_status', value: JSON.stringify({ ts: Date.now(), processed: users.length, cursor: nextCursor, durationMs: duration, errors: errorCount, updated: updatedCount, skipped: skippedFresh }) },
    update: { value: JSON.stringify({ ts: Date.now(), processed: users.length, cursor: nextCursor, durationMs: duration, errors: errorCount, updated: updatedCount, skipped: skippedFresh }) }
  })
  return NextResponse.json({
    done: false,
    processed: users.length,
    nextCursor,
    totalUsers,
    staleCandidates,
    updatedCount,
    skippedFresh,
    errorCount,
    lastBatchDurationMs: duration
  })
}
