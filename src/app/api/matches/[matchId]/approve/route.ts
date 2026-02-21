export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { ensureIdempotency } from '@/lib/idempotency'

const APPROVABLE_STATUS = ['requested', 'pending']

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const cid = crypto.randomUUID()
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matchId = params.matchId
    if (!matchId) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const idemKey = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idemKey, userId)
    await enforceRateLimit(userId, ip)

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        step: true,
        requesterId: true,
        targetId: true,
        targetViewed: true,
        requesterViewed: true,
        target: { select: { name: true } }
      }
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (match.targetId !== userId) {
      return NextResponse.json(
        { error: 'Only target user can approve profile view request' },
        { status: 403 }
      )
    }

    if (match.status === 'approved') {
      return NextResponse.json({ message: 'Already approved' }, { status: 200 })
    }

    if (!APPROVABLE_STATUS.includes(match.status)) {
      return NextResponse.json(
        { error: 'Match cannot be approved in current state' },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      const updateRes = await tx.match.updateMany({
        where: { id: matchId, targetId: userId, status: { in: APPROVABLE_STATUS } },
        data: {
          status: 'approved',
          step: 'profile_viewed',
          targetViewed: true,
          requesterViewed: true,
          updatedAt: new Date()
        }
      })

      if (updateRes.count === 0) {
        const current = await tx.match.findUnique({ where: { id: matchId }, select: { status: true } })
        if (current?.status === 'approved') {
          return { id: matchId, status: 'approved', step: 'profile_viewed', idempotent: true }
        }
        const e: any = new Error('INVALID_STATE')
        e.code = 'INVALID_STATE'
        throw e
      }

      const updated = await tx.match.findUnique({
        where: { id: matchId },
        select: { id: true, status: true, step: true, requesterId: true }
      })

      if (updated) {
        await tx.notification.create({
          data: {
            userId: updated.requesterId,
            type: 'profile_viewed',
            title: 'Permintaan Lihat Profil Disetujui',
            message: `${match.target?.name || 'Pengguna'} menyetujui permintaan melihat profil Anda`,
            link: `/dashboard/matches/${matchId}`,
            dedupeKey: `profile_viewed:${matchId}:${updated.requesterId}`
          }
        })
      }

      return updated
    })

    return NextResponse.json(
      {
        message: 'Profile view approved successfully',
        match: result
      },
      { headers: { 'X-Request-ID': cid } }
    )
  } catch (error: any) {
    if (error?.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (error?.code === 'IDEMPOTENT') {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }
    if (error?.code === 'INVALID_STATE') {
      return NextResponse.json({ error: 'Match cannot be approved in current state' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

