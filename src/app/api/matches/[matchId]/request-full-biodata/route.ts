export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureIdempotency } from '@/lib/idempotency'
import { enforceRateLimit } from '@/lib/rateLimit'
import { MatchStep } from '@/lib/matchEngine'
import { transitionMatchStep } from '@/lib/transitionEngine'

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

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { id: true, requesterId: true, targetId: true, step: true }
    })
    if (!match) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (match.step === 'full_data_requested') {
      return NextResponse.json({ message: 'Already requested' }, { headers: { 'X-Request-ID': cid } })
    }

    await transitionMatchStep(matchId, MatchStep.FULL_DATA_REQUESTED)

    await db.notification.createMany({
      data: [
        {
          userId: match.requesterId,
          type: 'full_data_request',
          title: 'Rekomendasi Lihat Biodata Lengkap',
          message: 'Sistem merekomendasikan Anda untuk melihat biodata lengkap pasangan.',
          link: `/dashboard/matches/${matchId}`,
          dedupeKey: `full_data_request:${matchId}:${match.requesterId}`
        },
        {
          userId: match.targetId,
          type: 'full_data_request',
          title: 'Rekomendasi Lihat Biodata Lengkap',
          message: 'Sistem merekomendasikan Anda untuk melihat biodata lengkap pasangan.',
          link: `/dashboard/matches/${matchId}`,
          dedupeKey: `full_data_request:${matchId}:${match.targetId}`
        }
      ]
    })

    return NextResponse.json({ message: 'Request full biodata dikirim' }, { headers: { 'X-Request-ID': cid } })
  } catch (error: any) {
    if (error?.code === 'INVALID_TRANSITION') {
      return NextResponse.json({ error: 'Invalid transition' }, { status: 400 })
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

