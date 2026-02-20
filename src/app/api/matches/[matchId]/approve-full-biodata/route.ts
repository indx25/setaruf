import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/matches/[matchId]/approve-full-biodata - Approve full biodata view
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

    // Only allow full biodata approval in full_data_requested or full_data_approved stage
    if (
      match.step !== 'full_data_requested' &&
      match.step !== 'full_data_approved'
    ) {
      return NextResponse.json({ error: 'Cannot approve full biodata at this stage' }, { status: 400 })
    }

    // Check if user already approved
    if (match.requesterId === userId && match.requesterViewed) {
      return NextResponse.json({ message: 'You have already approved full biodata view' })
    }
    if (match.targetId === userId && match.targetViewed) {
      return NextResponse.json({ message: 'You have already approved full biodata view' })
    }

    // Update the user's approval status
    const updateData: any = {}
    if (match.requesterId === userId) {
      updateData.requesterViewed = true
    } else {
      updateData.targetViewed = true
    }

    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: updateData,
    })

    // Check if both users have approved
    if (updatedMatch.requesterViewed && updatedMatch.targetViewed) {
      // Both approved, update step to full_data_approved and status to chatting
      await db.match.update({
        where: { id: matchId },
        data: {
          step: 'full_data_approved',
          status: 'chatting',
        },
      })

      // Notify both users that full biodata is now approved and chat is available
      await db.notification.create({
        data: {
          userId: match.requesterId,
          type: 'full_data_approved',
          title: 'Biodata Lengkap Disetujui',
          message: 'Kedua belah pihak telah menyetujui untuk melihat biodata lengkap. Anda sekarang dapat mulai mengobrol!',
          link: `/dashboard/matches/${matchId}`,
        },
      })

      await db.notification.create({
        data: {
          userId: match.targetId,
          type: 'full_data_approved',
          title: 'Biodata Lengkap Disetujui',
          message: 'Kedua belah pihak telah menyetujui untuk melihat biodata lengkap. Anda sekarang dapat mulai mengobrol!',
          link: `/dashboard/matches/${matchId}`,
        },
      })

      return NextResponse.json({
        message: 'Full biodata approved by both users. Chat is now available!',
        match: {
          id: updatedMatch.id,
          status: 'chatting',
          step: 'full_data_approved',
        },
      })
    }

    return NextResponse.json({
      message: 'Full biodata approved. Waiting for the other party.',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error approving full biodata:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
