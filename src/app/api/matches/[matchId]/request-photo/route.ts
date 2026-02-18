import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/request-photo - Request to view photos (system recommendation)
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

    // Only allow photo request after profile is approved
    if (match.status !== 'approved' || match.step !== 'profile_viewed') {
      return NextResponse.json({ error: 'Cannot request photo at this stage' }, { status: 400 })
    }

    // Update match step to photo_requested
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        step: 'photo_requested',
      },
    })

    // Create notifications for both users about photo recommendation
    await db.notification.create({
      data: {
        userId: match.requesterId,
        type: 'photo_request',
        title: 'Rekomendasi Foto',
        message: 'Sistem merekomendasikan Anda untuk saling melihat foto. Silakan setujui untuk melanjutkan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    await db.notification.create({
      data: {
        userId: match.targetId,
        type: 'photo_request',
        title: 'Rekomendasi Foto',
        message: 'Sistem merekomendasikan Anda untuk saling melihat foto. Silakan setujui untuk melanjutkan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Photo view recommendation sent to both users',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error requesting photo view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
