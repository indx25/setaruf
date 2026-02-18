import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/matches/[matchId]/approve-photo - Approve photo view
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

    // Only allow photo approval in photo_requested or photo_approved stage
    if (
      match.step !== 'photo_requested' &&
      match.step !== 'photo_approved'
    ) {
      return NextResponse.json({ error: 'Cannot approve photo at this stage' }, { status: 400 })
    }

    // Check if user already approved
    if (match.requesterId === userId && match.requesterViewed) {
      return NextResponse.json({ message: 'You have already approved photo view' })
    }
    if (match.targetId === userId && match.targetViewed) {
      return NextResponse.json({ message: 'You have already approved photo view' })
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
      // Both approved, update step to photo_approved
      await db.match.update({
        where: { id: matchId },
        data: {
          step: 'photo_approved',
        },
      })

      // Notify both users that photo is now approved
      await db.notification.create({
        data: {
          userId: match.requesterId,
          type: 'photo_approved',
          title: 'Foto Disetujui',
          message: 'Kedua belah pihak telah menyetujui untuk melihat foto. Anda sekarang dapat melihat foto lengkap.',
          link: `/dashboard/matches/${matchId}`,
        },
      })

      await db.notification.create({
        data: {
          userId: match.targetId,
          type: 'photo_approved',
          title: 'Foto Disetujui',
          message: 'Kedua belah pihak telah menyetujui untuk melihat foto. Anda sekarang dapat melihat foto lengkap.',
          link: `/dashboard/matches/${matchId}`,
        },
      })

      return NextResponse.json({
        message: 'Photo view approved by both users',
        match: {
          id: updatedMatch.id,
          status: updatedMatch.status,
          step: 'photo_approved',
        },
      })
    }

    return NextResponse.json({
      message: 'Photo view approved. Waiting for the other party.',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        step: updatedMatch.step,
      },
    })
  } catch (error) {
    console.error('Error approving photo view:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
