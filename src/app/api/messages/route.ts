import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/messages - Send message (fallback if WebSocket fails)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { matchId, receiverId, content } = body

    if (!matchId || !receiverId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 })
    }

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

    // Verify receiverId is the other party in the match
    const otherPartyId = match.requesterId === userId ? match.targetId : match.requesterId
    if (receiverId !== otherPartyId) {
      return NextResponse.json({ error: 'Invalid receiver' }, { status: 400 })
    }

    // Check if chat is allowed
    if (match.step !== 'full_data_approved' && match.status !== 'chatting') {
      return NextResponse.json({ error: 'Chat is not allowed at this stage' }, { status: 403 })
    }

    // Get sender name
    const sender = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 })
    }

    // Create message
    const message = await db.message.create({
      data: {
        senderId: userId,
        receiverId,
        matchId,
        content: content.trim(),
        isRead: false,
      },
    })

    // Return message with sender name
    return NextResponse.json({
      message: {
        id: message.id,
        senderId: message.senderId,
        senderName: sender.name,
        receiverId: message.receiverId,
        matchId: message.matchId,
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt,
      },
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
