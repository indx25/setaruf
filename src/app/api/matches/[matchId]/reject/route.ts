import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/reject - Reject profile view request
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

    // Only target can reject profile view request
    if (match.targetId !== userId) {
      return NextResponse.json({ error: 'Only target user can reject profile view request' }, { status: 403 })
    }

    // Check if match can be rejected
    if (match.status === 'blocked' || match.status === 'rejected' || match.status === 'chatting') {
      return NextResponse.json({ error: 'Cannot reject this match' }, { status: 400 })
    }

    // Update match status to rejected
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        status: 'rejected',
        step: 'profile_request',
      },
    })

    // Create notification for requester
    await db.notification.create({
      data: {
        userId: match.requesterId,
        type: 'match_blocked',
        title: 'Permintaan Lihat Profil Ditolak',
        message: `${match.target.name || 'Seseorang'} telah menolak permintaan melihat profil Anda`,
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Profile view rejected',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error rejecting profile view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
