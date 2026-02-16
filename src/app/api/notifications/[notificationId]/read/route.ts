import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/notifications/[notificationId]/read - Mark notification as read
export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
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

    const notificationId = params.notificationId

    // Fetch notification
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Check if the notification belongs to the user
    if (notification.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mark notification as read
    const updatedNotification = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
      },
    })

    return NextResponse.json({
      message: 'Notification marked as read',
      notification: updatedNotification,
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
