import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

// POST /api/admin/cleanup-matches
// Body: { dryRun?: boolean, limit?: number }
// Effect: Reset matches in status=pending & step=profile_request & requesterViewed=false & targetViewed=false to step='suggested'
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id as string | undefined
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allowed = await throttle(`admin:${adminId}:cleanup-matches`, 2, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const body = await request.json().catch(() => ({} as any))
    const dryRun = Boolean(body?.dryRun ?? true)
    const limit = Math.max(1, Math.min(5_000, Number(body?.limit ?? 1_000)))

    // Kandidat yang dianggap "keliru":
    // - status pending
    // - step profile_request
    // - belum ada view oleh requester maupun target
    // Catatan: kita sengaja tidak mengecek notifikasi untuk menjaga performa dan kesederhanaan.
    const candidates = await db.match.findMany({
      where: {
        status: 'pending',
        step: 'profile_request',
        requesterViewed: false,
        targetViewed: false
      },
      select: { id: true, requesterId: true, targetId: true, createdAt: true, updatedAt: true },
      take: limit,
      orderBy: { updatedAt: 'asc' }
    })

    if (!candidates.length) {
      return NextResponse.json({ ok: true, dryRun, total: 0, updated: 0, sample: [] })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        total: candidates.length,
        updated: 0,
        sample: candidates.slice(0, 10)
      })
    }

    const ids = candidates.map(c => c.id)
    const { count } = await db.match.updateMany({
      where: { id: { in: ids } },
      data: { step: 'suggested' }
    })

    return NextResponse.json({
      ok: true,
      dryRun: false,
      total: candidates.length,
      updated: count
    })
  } catch (error) {
    console.error('Admin cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
