export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { ensureIdempotency } from '@/lib/idempotency'

// POST /api/matches/[matchId]/dislike - Hide this match permanently from recommendations
export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const idemKey = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idemKey, userId)
    const ok = await throttle(`dislike:${userId}:${ip || 'na'}`, 20, 60_000)
    if (!ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const matchId = params.matchId
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { requester: true, target: true }
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mark blocked to ensure it won't appear again
    await db.match.update({
      where: { id: matchId },
      data: { status: 'blocked', step: 'blocked' }
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal menyembunyikan rekomendasi: ${msg}` }, { status: 500 })
  }
}
