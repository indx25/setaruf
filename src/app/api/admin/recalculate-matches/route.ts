import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const TEST_WEIGHTS: Record<string, number> = {
  pre_marriage: 0.4,
  disc: 0.2,
  clinical: 0.2,
  '16pf': 0.2
}

function calculateMatch(userTests: any[], otherTests: any[]) {
  if (!userTests.length || !otherTests.length) return 50
  let total = 0
  let weightSum = 0
  for (const k of Object.keys(TEST_WEIGHTS)) {
    const w = TEST_WEIGHTS[k]
    const a = userTests.find(t => t.testType === k)
    const b = otherTests.find(t => t.testType === k)
    if (a && b && typeof a.score === 'number' && typeof b.score === 'number') {
      const similarity = 100 - Math.abs(a.score - b.score)
      total += similarity * w
      weightSum += w
    }
  }
  if (weightSum === 0) return 50
  return Math.round(total / weightSum)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const me = await db.user.findUnique({ where: { id: userId } })
    if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 2000)
    const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10), 0)
    const dryRun = (searchParams.get('dryRun') || '').toLowerCase() === 'true'

    const matches = await db.match.findMany({
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: {
        requester: { include: { psychotests: true } },
        target: { include: { psychotests: true } }
      }
    })

    let updated = 0
    const diffs: Array<{ id: string; before: number | null; after: number }> = []

    for (const m of matches) {
      const before = m.matchPercentage ?? null
      const after = calculateMatch(m.requester.psychotests || [], m.target.psychotests || [])
      if (before !== after) {
        diffs.push({ id: m.id, before, after })
        if (!dryRun) {
          await db.match.update({ where: { id: m.id }, data: { matchPercentage: after } })
        }
        updated++
      }
    }

    return NextResponse.json({
      processed: matches.length,
      updated,
      dryRun,
      diffs
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
