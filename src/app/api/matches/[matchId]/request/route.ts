import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/request - Request to view profile
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

    // Only requester can initiate profile view request
    if (match.requesterId !== userId) {
      return NextResponse.json({ error: 'Only requester can initiate profile view request' }, { status: 403 })
    }

    // Check if match is already in a terminal state
    if (match.status === 'blocked' || match.status === 'rejected') {
      return NextResponse.json({ error: 'Cannot request profile view for this match' }, { status: 400 })
    }

    // If already approved or in later stages, just return the match
    if (match.status === 'approved' || match.status === 'chatting') {
      return NextResponse.json({
        message: 'Profile view already approved',
        match: {
          id: match.id,
          status: match.status,
          step: match.step,
        },
      })
    }

    // Update match to request profile view
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        status: 'pending',
        step: 'profile_request',
      },
    })

    // Create notification for target user
    await db.notification.create({
      data: {
        userId: match.targetId,
        type: 'match_request',
        title: 'Permintaan Lihat Profil',
        message: `${match.requester.name || 'Seseorang'} ingin melihat profil Anda`,
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Profile view request sent',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error requesting profile view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
