export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { ensureIdempotency } from '@/lib/idempotency'

// POST /api/notifications/[notificationId]/read - Mark notification as read
export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const idemKey = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idemKey, userId)
    const ok = await throttle(`notif-read:${userId}:${ip || 'na'}`, 200, 60_000)
    if (!ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

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

    const res = NextResponse.json({
      message: 'Notification marked as read',
      notification: updatedNotification,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
