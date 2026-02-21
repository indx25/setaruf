import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { ensureIdempotency } from '@/lib/idempotency'

const ALLOWED_STEPS = ['full_data_requested', 'full_data_approved']

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
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          status: true,
          step: true,
          requesterId: true,
          targetId: true,
          requesterViewed: true,
          targetViewed: true
        }
      })
      if (!match) {
        const e: any = new Error('NOT_FOUND')
        e.code = 'NOT_FOUND'
        throw e
      }
      if (match.requesterId !== userId && match.targetId !== userId) {
        const e: any = new Error('FORBIDDEN')
        e.code = 'FORBIDDEN'
        throw e
      }
      if (!ALLOWED_STEPS.includes(match.step)) {
        const e: any = new Error('INVALID_STAGE')
        e.code = 'INVALID_STAGE'
        throw e
      }
      const isRequester = match.requesterId === userId
      const alreadyApproved = isRequester ? match.requesterViewed : match.targetViewed
      if (alreadyApproved) {
        return { type: 'ALREADY_APPROVED' as const, match: { id: match.id, status: match.status, step: match.step } }
      }
      await tx.match.updateMany({
        where: { id: matchId, ...(isRequester ? { requesterViewed: false } : { targetViewed: false }) },
        data: { requesterViewed: isRequester ? true : match.requesterViewed, targetViewed: isRequester ? match.targetViewed : true, updatedAt: new Date() }
      })
      const after = await tx.match.findUnique({
        where: { id: matchId },
        select: { id: true, status: true, step: true, requesterId: true, targetId: true, requesterViewed: true, targetViewed: true }
      })
      if (!after) {
        const e: any = new Error('NOT_FOUND')
        e.code = 'NOT_FOUND'
        throw e
      }
      if (after.requesterViewed && after.targetViewed) {
        const finalMatch = await tx.match.update({
          where: { id: matchId },
          data: { step: 'full_data_approved', status: 'chatting', updatedAt: new Date() },
          select: { id: true, status: true, step: true, requesterId: true, targetId: true }
        })
        await tx.notification.createMany({
          data: [
            {
              userId: finalMatch.requesterId,
              type: 'full_data_approved',
              title: 'Biodata Lengkap Disetujui',
              message: 'Kedua belah pihak menyetujui biodata lengkap. Chat tersedia.',
              link: `/dashboard/matches/${matchId}`,
              dedupeKey: `full_data_approved:${matchId}:${finalMatch.requesterId}`
            },
            {
              userId: finalMatch.targetId,
              type: 'full_data_approved',
              title: 'Biodata Lengkap Disetujui',
              message: 'Kedua belah pihak menyetujui biodata lengkap. Chat tersedia.',
              link: `/dashboard/matches/${matchId}`,
              dedupeKey: `full_data_approved:${matchId}:${finalMatch.targetId}`
            }
          ]
        })
        return { type: 'BOTH_APPROVED' as const, match: { id: finalMatch.id, status: finalMatch.status, step: finalMatch.step } }
      }
      return { type: 'WAITING_OTHER' as const, match: { id: after.id, status: after.status, step: after.step } }
    })

    if (result.type === 'ALREADY_APPROVED') {
      return NextResponse.json({ message: 'You have already approved full biodata view' }, { headers: { 'X-Request-ID': cid } })
    }
    if (result.type === 'BOTH_APPROVED') {
      return NextResponse.json({ message: 'Full biodata approved by both users. Chat is now available!', match: result.match }, { headers: { 'X-Request-ID': cid } })
    }
    return NextResponse.json({ message: 'Full biodata approved. Waiting for the other party.', match: result.match }, { headers: { 'X-Request-ID': cid } })
  } catch (error: any) {
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error?.code === 'INVALID_STAGE') {
      return NextResponse.json({ error: 'Cannot approve full biodata at this stage' }, { status: 400 })
    }
    if (error?.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (error?.code === 'IDEMPOTENT') {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
