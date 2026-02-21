export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const ENGINE_VERSION = 2

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const me = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
    if (!me?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = Boolean(body?.dryRun ?? true)
    const limit = Math.max(1, Math.min(5000, Number(body?.limit ?? 1000)))

    // Target: perbaiki data lama yang step masih 'pending' agar menjadi 'suggested'
    // untuk konsistensi UI rekomendasi.
    const whereClause = {
      status: 'pending' as const,
      NOT: { step: 'suggested' as const },
    }

    const total = await db.match.count({ where: whereClause })
    if (total === 0) {
      return NextResponse.json({ total: 0, updated: 0, dryRun })
    }

    if (dryRun) {
      return NextResponse.json({ total, updated: 0, dryRun })
    }

    // Ambil batch terbatas, lalu update by id
    const batch = await db.match.findMany({
      where: whereClause,
      select: { id: true },
      take: limit,
      orderBy: { createdAt: 'asc' }
    })

    if (batch.length === 0) {
      return NextResponse.json({ total, updated: 0, dryRun })
    }

    const ids = batch.map(b => b.id)
    const result = await db.match.updateMany({
      where: { id: { in: ids } },
      data: { step: 'suggested', matchVersion: ENGINE_VERSION }
    })

    return NextResponse.json({ total, updated: result.count, dryRun: false })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

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
