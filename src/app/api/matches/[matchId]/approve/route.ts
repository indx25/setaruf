import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/approve - Approve profile view request
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

    // Only target can approve profile view request
    if (match.targetId !== userId) {
      return NextResponse.json({ error: 'Only target user can approve profile view request' }, { status: 403 })
    }

    // Check if match can be approved
    if (match.status === 'blocked' || match.status === 'rejected' || match.status === 'chatting') {
      return NextResponse.json({ error: 'Cannot approve this match' }, { status: 400 })
    }

    // Update match status to approved
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        status: 'approved',
        step: 'profile_viewed',
        targetViewed: true,
      },
    })

    // Create notification for requester
    await db.notification.create({
      data: {
        userId: match.requesterId,
        type: 'profile_viewed',
        title: 'Permintaan Lihat Profil Disetujui',
        message: `${match.target.name || 'Seseorang'} telah menyetujui permintaan melihat profil Anda`,
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Profile view approved',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error approving profile view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
