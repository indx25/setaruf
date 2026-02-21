import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'
import { throttle, kvGet, kvSetWithTTL } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('targetId') || undefined

    let match
    if (targetId) {
      match = await db.match.findFirst({
        where: {
          OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
      })
    } else {
      match = await db.match.findFirst({
        where: {
          OR: [{ requesterId: userId }, { targetId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
      })
    }

    const hasActiveMatch = !!(match && match.status === 'approved')
    const res = NextResponse.json({
      hasActiveMatch,
      match: match ? { id: match.id, status: match.status, step: match.step, requesterId: match.requesterId, targetId: match.targetId } : null,
    })
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    return res
  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Match GET error:', { error, cid })
    try { logger.record({ type: 'error', action: 'match_get_status', detail: `Match GET error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json({ error: 'Gagal mengambil status match' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const decision = String(body?.decision || '')
    const targetId = String(body?.targetId || '')

    if (!decision || !targetId) {
      return NextResponse.json({ error: 'Decision dan targetId diperlukan' }, { status: 400 })
    }
  if (targetId === userId) {
    return NextResponse.json({ error: 'Tidak dapat mencocokkan dengan diri sendiri' }, { status: 400 })
  }

    // Anti-abuse: per-user rate limit (20/min, 100/jam)
    const okMin = await throttle(`match:${userId}:min`, 20, 60_000)
    const okHour = await throttle(`match:${userId}:hour`, 100, 60 * 60_000)
    if (!okMin || !okHour) {
      return NextResponse.json({ error: 'Terlalu banyak aksi. Coba lagi nanti.' }, { status: 429 })
    }
    // Anti-abuse: per-IP rate limit (60/min)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const okIP = await throttle(`ip:${ip}:min`, 60, 60_000)
    if (!okIP) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan dari IP Anda.' }, { status: 429 })
    }
    // Cooldown lock per (user,target) 5 detik untuk cegah spam click
    const cdKey = `cooldown:match:${userId}:${targetId}`
    const hasCooldown = await kvGet(cdKey)
    if (hasCooldown) {
      return NextResponse.json({ error: 'Terlalu cepat. Coba lagi sebentar.' }, { status: 429 })
    }
    await kvSetWithTTL(cdKey, 5)

    // Abnormal behavior detection & progressive penalty
    const ok10m = await throttle(`decision10:${userId}`, 50, 10 * 60_000)
    const me = await db.user.findUnique({ where: { id: userId }, select: { penaltyLevel: true, penaltyUntil: true } })
    const now = new Date()
    if (me?.penaltyUntil && me.penaltyUntil > now) {
      return NextResponse.json({ error: 'Akun dibatasi sementara. Coba lagi nanti.' }, { status: 429 })
    }
    if (!ok10m) {
      const level = (me?.penaltyLevel || 0) + 1
      const freezeMinutes = level >= 3 ? 60 * 24 : level === 2 ? 10 : 1
      const until = new Date(Date.now() + freezeMinutes * 60_000)
      await db.user.update({ where: { id: userId }, data: { isFlagged: true, penaltyLevel: level, penaltyUntil: until } })
      return NextResponse.json({ error: 'Aktivitas tidak biasa terdeteksi. Aksi dibatasi sementara.' }, { status: 429 })
    }

    // Validate target existence / availability
    const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, isBlocked: true } })
    if (!target || target.isBlocked) {
      return NextResponse.json({ error: 'Target tidak valid' }, { status: 400 })
    }

    if (decision === 'approve') {
      const result = await db.$transaction(async (tx) => {
        const [a, b] = [userId, targetId].sort()
        const pairKey = `${a}_${b}`
        let match = await tx.match.findFirst({
          where: { OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }] }
        })
        let becameApproved = false
        if (!match) {
          const initialStep = userId === a ? 'requester_approved' : 'target_approved'
          match = await tx.match.create({
            data: { requesterId: a, targetId: b, status: 'pending', step: initialStep, pairKey }
          })
          return { match, becameApproved, notifyRequest: true, notifyTargetId: userId === a ? b : a }
        }
        if (match.status === 'approved') {
          return { match, becameApproved: false, notifyRequest: false, notifyTargetId: null }
        }
        const isRequester = match.requesterId === userId
        let newStep = match.step
        let newStatus = 'pending'
        if (isRequester) {
          if (match.step === 'target_approved') {
            newStatus = 'approved'
            newStep = 'chatting'
            becameApproved = true
          } else {
            newStep = 'requester_approved'
          }
        } else {
          if (match.step === 'requester_approved') {
            newStatus = 'approved'
            newStep = 'chatting'
            becameApproved = true
          } else {
            newStep = 'target_approved'
          }
        }
        match = await tx.match.update({ where: { id: match.id }, data: { status: newStatus, step: newStep } })
        return { match, becameApproved, notifyRequest: !becameApproved, notifyTargetId: isRequester ? match.targetId : match.requesterId }
      })

      if (result.notifyRequest && result.notifyTargetId) {
        const dedupeKey = `match_request:${result.match.id}:${result.notifyTargetId}`
        await db.notification.create({
          data: {
            userId: result.notifyTargetId,
            type: 'match_request',
            dedupeKey,
            title: 'Pasangan Memilih Lanjut',
            message: 'Pasangan Anda menekan Lanjut. Jika Anda setuju, pilih Lanjut untuk mengaktifkan match.',
            link: `/dashboard/matches/${result.match.id}`
          }
        })
      }

      const match = result.match
      if (result.becameApproved || match.status === 'approved') {
        await db.user.update({
          where: { id: userId },
          data: { workflowStatus: 'getting_to_know' },
        })
        if (targetId) {
          await db.user.update({
            where: { id: targetId },
            data: { workflowStatus: 'getting_to_know' },
          })
        }
        await db.notification.create({
          data: {
            userId: userId,
            type: 'match_approved',
            dedupeKey: `match_approved:${match.id}:${userId}`,
            title: 'Match Aktif',
            message: 'Anda dan pasangan telah sama‑sama memilih Lanjut. Chat kini aktif.',
            link: `/dashboard/matches/${match.id}`
          }
        })
        await db.notification.create({
          data: {
            userId: targetId!,
            type: 'match_approved',
            dedupeKey: `match_approved:${match.id}:${targetId}`,
            title: 'Match Aktif',
            message: 'Anda dan pasangan telah sama‑sama memilih Lanjut. Chat kini aktif.',
            link: `/dashboard/matches/${match.id}`
          }
        })
      }

      return NextResponse.json({ success: true, match: result.match })
    }

    if (decision === 'reject') {
      await db.$transaction(async (tx) => {
        const m = await tx.match.findFirst({ where: { OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }] } })
        if (!m) {
          await tx.match.create({ data: { requesterId: userId, targetId, status: 'rejected', step: 'rejected' } })
          return
        }
        if (m.status !== 'rejected') {
          await tx.match.update({ where: { id: m.id }, data: { status: 'rejected', step: 'rejected' } })
        }
      })
      const m2 = await db.match.findFirst({ where: { OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }] } })
      if (m2) {
        await db.notification.create({
          data: {
            userId: userId,
            type: 'match_rejected',
            dedupeKey: `match_rejected:${m2.id}:${userId}`,
            title: 'Match Ditolak',
            message: 'Anda telah menolak proses taaruf dengan pasangan ini.',
            link: `/dashboard/matches/${m2.id}`
          }
        })
        await db.notification.create({
          data: {
            userId: userId === m2.requesterId ? m2.targetId : m2.requesterId,
            type: 'match_rejected',
            dedupeKey: `match_rejected:${m2.id}:${userId === m2.requesterId ? m2.targetId : m2.requesterId}`,
            title: 'Match Ditolak',
            message: 'Pasangan menolak proses taaruf.',
            link: `/dashboard/matches/${m2.id}`
          }
        })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Decision tidak dikenal' }, { status: 400 })
  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Match POST error:', { error, cid })
    try { logger.record({ type: 'error', action: 'match_post', detail: `Match POST error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json({ error: 'Gagal memperbarui status match' }, { status: 500 })
  }
}
