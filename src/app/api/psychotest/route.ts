import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const ALLOWED_TYPES = new Set(['pre_marriage', 'disc', 'clinical', '16pf'])

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const me = session?.user as any
  if (!me?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const tests = await db.psychoTest.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      select: { testType: true, score: true, result: true }
    })
    return NextResponse.json({
      tests: tests.map(t => ({
        testType: t.testType,
        score: typeof t.score === 'number' ? clamp(t.score, 0, 100) : 0,
        result: t.result || ''
      }))
    })
  } catch (e) {
    console.error('Psychotest GET error:', e)
    return NextResponse.json({ error: 'Failed to load tests' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const me = session?.user as any
  if (!me?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const testType = String(body?.testType || '')
  if (!ALLOWED_TYPES.has(testType)) {
    return NextResponse.json({ error: 'Invalid testType' }, { status: 400 })
  }
  const scoreNum = clamp(Number(body?.score ?? 0), 0, 100)
  const result = String(body?.result || '')
  const answers = body?.answers ? JSON.stringify(body.answers) : JSON.stringify({})
  try {
    const existing = await db.psychoTest.findFirst({
      where: { userId: me.id, testType }
    })
    const saved = existing
      ? await db.psychoTest.update({
          where: { id: existing.id },
          data: { score: scoreNum, result, answers, completedAt: new Date() }
        })
      : await db.psychoTest.create({
          data: { userId: me.id, testType, score: scoreNum, result, answers, completedAt: new Date() }
        })

    return NextResponse.json({
      ok: true,
      test: {
        id: saved.id,
        testType: saved.testType,
        score: saved.score ?? 0,
        result: saved.result || ''
      }
    })
  } catch (e) {
    console.error('Psychotest POST error:', e)
    return NextResponse.json({ error: 'Failed to save test' }, { status: 500 })
  }
}

