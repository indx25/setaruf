import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/request-full-biodata - Request full biodata (system recommendation)
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

    // Only allow full biodata request after photo is approved
    if (match.status !== 'approved' || match.step !== 'photo_approved') {
      return NextResponse.json({ error: 'Cannot request full biodata at this stage' }, { status: 400 })
    }

    // Update match step to full_data_requested
    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        step: 'full_data_requested',
      },
    })

    // Create notifications for both users about full biodata recommendation
    await db.notification.create({
      data: {
        userId: match.requesterId,
        type: 'full_data_request',
        title: 'Rekomendasi Biodata Lengkap',
        message: 'Sistem merekomendasikan Anda untuk saling melihat biodata lengkap. Silakan setujui untuk melanjutkan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    await db.notification.create({
      data: {
        userId: match.targetId,
        type: 'full_data_request',
        title: 'Rekomendasi Biodata Lengkap',
        message: 'Sistem merekomendasikan Anda untuk saling melihat biodata lengkap. Silakan setujui untuk melanjutkan.',
        link: `/dashboard/matches/${matchId}`,
      },
    })

    return NextResponse.json({
      message: 'Full biodata recommendation sent to both users',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error requesting full biodata:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
