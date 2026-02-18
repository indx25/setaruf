import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/matches/[matchId]/messages - Get message history
export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const userId = request.cookies.get('userId')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matchId = params.matchId

    // Fetch match
    const match = await db.match.findUnique({
      where: { id: matchId },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check if the user is part of this match
    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if chat is allowed
    if (match.step !== 'full_data_approved' && match.status !== 'chatting') {
      return NextResponse.json({ error: 'Chat is not allowed at this stage' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const before = searchParams.get('before')

    // Build where clause
    const where: any = { matchId }
    if (before) {
      where.createdAt = {
        lt: new Date(before),
      }
    }

    // Fetch messages
    const messages = await db.message.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Reverse to get chronological order
    const sortedMessages = messages.reverse()

    // Mark messages as read if user is receiver
    await db.message.updateMany({
      where: {
        matchId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    })

    return NextResponse.json({
      messages: sortedMessages,
      total: sortedMessages.length,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
