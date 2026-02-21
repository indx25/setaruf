export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await db.user.findUnique({ where: { id: userId } })
  if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const dryRun = Boolean(body?.dryRun ?? true)
  const limit = Math.max(1, Math.min(5000, Number(body?.limit ?? 1000)))

  const items = await db.match.findMany({
    where: { OR: [{ pairKey: null }, { pairKey: '' }] },
    select: { id: true, requesterId: true, targetId: true, pairKey: true },
    take: limit,
    orderBy: { createdAt: 'asc' }
  })

  if (items.length === 0) {
    return NextResponse.json({ total: 0, updated: 0, dryRun })
  }

  if (dryRun) {
    return NextResponse.json({ total: items.length, updated: 0, dryRun })
  }

  let updated = 0
  for (const m of items) {
    const [a, b] = [m.requesterId, m.targetId].sort()
    const key = `${a}_${b}`
    if (m.pairKey !== key) {
      await db.match.update({ where: { id: m.id }, data: { pairKey: key } })
      updated++
    }
  }
  return NextResponse.json({ total: items.length, updated, dryRun: false })
}

