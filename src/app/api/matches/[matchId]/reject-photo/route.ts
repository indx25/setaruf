import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/matches/[matchId]/reject-photo - Reject photo view
export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    // Get session from cookie
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = JSON.parse(sessionCookie.value)
    const userId = session.userId

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matchId = params.matchId

    // Fetch match
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        requester: true,
        target: true,
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check if the user is part of this match
    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow photo rejection in photo_requested or photo_approved stage
    if (
      match.step !== 'photo_requested' &&
      match.step !== 'photo_approved'
    ) {
      return NextResponse.json({ error: 'Cannot reject photo at this stage' }, { status: 400 })
    }

    // Update match status to rejected
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        status: 'rejected',
        step: 'photo_rejected',
      },
    })

    // Notify both users about the rejection
    await db.notification.create({
      data: {
        userId: match.requesterId,
        type: 'photo_rejected',
        title: 'Permintaan Foto Ditolak',
        message: 'Salah satu pihak telah menolak untuk melihat foto. Hubungan ini dihentikan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    await db.notification.create({
      data: {
        userId: match.targetId,
        type: 'photo_rejected',
        title: 'Permintaan Foto Ditolak',
        message: 'Salah satu pihak telah menolak untuk melihat foto. Hubungan ini dihentikan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Photo view rejected',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error rejecting photo view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
