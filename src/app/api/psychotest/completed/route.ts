import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { enqueueCompatibilityJob } from '@/lib/compatQueue'

const ENGINE_VERSION = 2

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function extractTraitVector(tests: Array<{ testType: string; score: number | null }>) {
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
  const me = session?.user as any
  if (!me?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const userId: string | undefined = body.userId
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  const meUser = await db.user.findUnique({ where: { id: me.id } })
  if (!meUser?.isAdmin && me.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tests = await db.psychoTest.findMany({
    where: { userId },
    select: { testType: true, score: true, createdAt: true }
  })
  const vec = extractTraitVector(tests)
  await db.user.update({
    where: { id: userId },
    data: { traitVector: vec as any, traitVersion: ENGINE_VERSION, traitUpdatedAt: new Date() }
  })
  const matches = await db.match.findMany({
    where: { OR: [{ requesterId: userId }, { targetId: userId }] },
    select: { requesterId: true, targetId: true },
    orderBy: { updatedAt: 'desc' },
    take: 50
  })
  const otherIds = new Set<string>()
  for (const m of matches) {
    const other = m.requesterId === userId ? m.targetId : m.requesterId
    if (other) otherIds.add(other)
  }
  let enqueued = 0
  for (const otherId of Array.from(otherIds)) {
    await enqueueCompatibilityJob(userId, otherId)
    enqueued++
  }
  return NextResponse.json({ ok: true, traitVectorUpdated: true, enqueued })
}
