import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { ensureIdempotency } from '@/lib/idempotency'
import { handleMatchAction } from '@/services/match.actions'

export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const cid = crypto.randomUUID()
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const match = await db.match.findUnique({
      where: { id: params.matchId },
      select: {
        id: true,
        status: true,
        step: true,
        requesterId: true,
        targetId: true,
        requester: {
          select: {
            id: true,
            profile: { select: { fullName: true, age: true, city: true } }
          }
        },
        target: {
          select: {
            id: true,
            profile: { select: { fullName: true, age: true, city: true } }
          }
        }
      }
    })
    if (!match) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const isRequester = match.requesterId === userId
    const otherUser = isRequester ? match.target : match.requester
    const res = NextResponse.json(
      {
        match,
        otherUser,
        isRequester,
        permissions: {
          canViewProfile: match.step === 'profile_viewed' || match.status === 'approved',
          canViewPhoto: match.step === 'photo_approved' || match.step === 'full_data_approved',
          canViewFullBiodata: match.step === 'full_data_approved' || match.step === 'chatting',
          canChat: match.step === 'chatting'
        }
      },
      { headers: { 'Cache-Control': 'no-store', 'X-Request-ID': cid } }
    )
    return res
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const cid = crypto.randomUUID()
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const idem = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idem, userId)
    await enforceRateLimit(userId, ip)
    const body = await request.json().catch(() => ({}))
    const action = body?.action as string | undefined
    if (!action) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    const data = await db.$transaction(async (tx) => {
      return handleMatchAction(tx, { matchId: params.matchId, userId, action })
    })
    return NextResponse.json({ success: true, data }, { headers: { 'X-Request-ID': cid } })
  } catch (error: any) {
    if (error?.code === 'INVALID_TRANSITION') {
      return NextResponse.json({ error: 'Invalid transition' }, { status: 400 })
    }
    if (error?.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (error?.code === 'IDEMPOTENT') {
      return NextResponse.json({ error: 'Duplicate request' }, { status: 409 })
    }
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
