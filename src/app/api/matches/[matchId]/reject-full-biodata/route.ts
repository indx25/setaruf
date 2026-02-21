import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureIdempotency } from '@/lib/idempotency'
import { enforceRateLimit } from '@/lib/rateLimit'

// POST /api/matches/[matchId]/reject-full-biodata - Reject full biodata view (enterprise-safe)
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
    const idem = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idem, userId)
    await enforceRateLimit(userId, ip)

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.match.updateMany({
        where: {
          id: matchId,
          status: { not: 'rejected' },
          step: { in: ['full_data_requested', 'full_data_approved'] },
          OR: [{ requesterId: userId }, { targetId: userId }]
        },
        data: {
          status: 'rejected',
          step: 'full_data_rejected',
          updatedAt: new Date()
        }
      })
      if (updated.count === 0) {
        const e: any = new Error('INVALID_STAGE')
        e.code = 'INVALID_STAGE'
        throw e
      }
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: { requesterId: true, targetId: true, status: true, step: true }
      })
      if (!match) {
        const e: any = new Error('NOT_FOUND')
        e.code = 'NOT_FOUND'
        throw e
      }
      await tx.notification.createMany({
        data: [
          {
            userId: match.requesterId,
            type: 'full_data_rejected',
            title: 'Permintaan Biodata Lengkap Ditolak',
            message: 'Salah satu pihak menolak biodata lengkap. Proses dihentikan.',
            link: `/dashboard/matches/${matchId}`,
            dedupeKey: `full_data_rejected:${matchId}:${match.requesterId}`
          },
          {
            userId: match.targetId,
            type: 'full_data_rejected',
            title: 'Permintaan Biodata Lengkap Ditolak',
            message: 'Salah satu pihak menolak biodata lengkap. Proses dihentikan.',
            link: `/dashboard/matches/${matchId}`,
            dedupeKey: `full_data_rejected:${matchId}:${match.targetId}`
          }
        ]
      })
      return match
    })

    return NextResponse.json(
      { message: 'Full biodata rejected successfully', match: result },
      { headers: { 'X-Request-ID': cid } }
    )
  } catch (error: any) {
    if (error?.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (error?.code === 'IDEMPOTENT') {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }
    if (error?.code === 'INVALID_STAGE') {
      return NextResponse.json({ error: 'Cannot reject at this stage' }, { status: 400 })
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
