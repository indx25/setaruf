import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/cancel-request - Cancel previously requested profile view (requester only)
export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matchId = params.matchId
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { requester: true, target: true },
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only requester can cancel a profile request
    if (match.requesterId !== userId) {
      return NextResponse.json({ error: 'Only requester can cancel request' }, { status: 403 })
    }

    // Only cancel when a request exists
    if (match.step !== 'profile_request') {
      return NextResponse.json({ error: 'No active request to cancel' }, { status: 400 })
    }

    const updated = await db.match.update({
      where: { id: matchId },
      data: {
        step: 'cancelled',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      match: { id: updated.id, status: updated.status, step: updated.step },
    })
  } catch (e) {
    console.error('Cancel request error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
