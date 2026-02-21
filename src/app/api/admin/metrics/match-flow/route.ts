export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

const STATUSES = ['pending', 'approved', 'rejected', 'blocked'] as const
const STEPS = [
  'suggested',
  'profile_request',
  'profile_viewed',
  'requester_liked',
  'target_liked',
  'mutual_liked',
  'requester_approved',
  'target_approved',
  'photo_requested',
  'photo_approved',
  'full_data_requested',
  'full_data_approved',
  'chatting',
  'rejected',
  'blocked'
] as const

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id as string | undefined
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const ok = await throttle(`admin:${adminId}:match-flow`, 20, 60_000)
    if (!ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const step = searchParams.get('step') || undefined
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50')))
    const cursor = searchParams.get('cursor') || undefined

    const where: any = {}
    if (status && STATUSES.includes(status as any)) where.status = status
    if (step && STEPS.includes(step as any)) where.step = step

    const items = await db.match.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        status: true,
        step: true,
        updatedAt: true,
        matchPercentage: true,
        requester: { select: { id: true, name: true, email: true } },
        target: { select: { id: true, name: true, email: true } }
      }
    })

    const nextCursor = items.length > limit ? items[limit].id : null
    const sliced = items.slice(0, limit)

    const [total, byStatusCounts, byStepCounts] = await Promise.all([
      db.match.count({ where }),
      Promise.all(STATUSES.map(async s => ({ s, c: await db.match.count({ where: { ...where, status: s } }) }))),
      Promise.all(STEPS.map(async st => ({ st, c: await db.match.count({ where: { ...where, step: st } }) }))),
    ])

    const summary: any = {
      total,
      byStatus: Object.fromEntries(byStatusCounts.map(x => [x.s, x.c])),
      byStep: Object.fromEntries(byStepCounts.map(x => [x.st, x.c])),
    }

    return NextResponse.json({ summary, items: sliced, nextCursor })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

