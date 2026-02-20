import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/matches/[matchId]/reject-full-biodata - Reject full biodata view
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

    // Only allow full biodata rejection in full_data_requested or full_data_approved stage
    if (
      match.step !== 'full_data_requested' &&
      match.step !== 'full_data_approved'
    ) {
      return NextResponse.json({ error: 'Cannot reject full biodata at this stage' }, { status: 400 })
    }

    // Update match status to rejected
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        status: 'rejected',
        step: 'full_data_rejected',
      },
    })

    // Notify both users about the rejection
    await db.notification.create({
      data: {
        userId: match.requesterId,
        type: 'full_data_rejected',
        title: 'Permintaan Biodata Lengkap Ditolak',
        message: 'Salah satu pihak telah menolak untuk melihat biodata lengkap. Hubungan ini dihentikan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    await db.notification.create({
      data: {
        userId: match.targetId,
        type: 'full_data_rejected',
        title: 'Permintaan Biodata Lengkap Ditolak',
        message: 'Salah satu pihak telah menolak untuk melihat biodata lengkap. Hubungan ini dihentikan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Full biodata rejected',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error rejecting full biodata:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
