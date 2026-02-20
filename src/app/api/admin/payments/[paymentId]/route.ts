export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

// POST - Approve or reject payment (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const adminUserId = (session?.user as any)?.id as string | undefined

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = await db.user.findUnique({
      where: { id: adminUserId }
    })

    if (!admin?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@setaruf.com'
    const baseLimit = 10
    const limitPerMin = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${adminUserId}:payment-action`, limitPerMin, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { paymentId } = params
    const { action, note } = await request.json()

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { user: true }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: 'Payment sudah diproses' },
        { status: 400 }
      )
    }

    let updatedPayment

    if (action === 'approve') {
      // Verify unique code matches
      const digits = String(payment.uniqueCode || '').replace(/\D/g, '')
      const codeNum = digits ? parseInt(digits, 10) : NaN
      const expectedAmount = Number.isFinite(codeNum) ? 50000 + codeNum : null
      if (expectedAmount === null || payment.amount !== expectedAmount) {
        return NextResponse.json(
          { error: `Jumlah tidak sesuai. Expected: ${expectedAmount}, Received: ${payment.amount}` },
          { status: 400 }
        )
      }

      // Update payment status
      updatedPayment = await db.payment.update({
        where: { id: paymentId },
        data: {
          status: 'approved',
          adminNote: note,
          approvedBy: adminUserId,
          approvedAt: new Date()
        }
      })

      // Update user to premium
      await db.user.update({
        where: { id: payment.userId },
        data: { isPremium: true }
      })

      // Create or update subscription
      const existingSub = await db.subscription.findFirst({
        where: {
          userId: payment.userId,
          isActive: true
        }
      })

      if (existingSub) {
        // Extend existing subscription
        const currentEnd = new Date(existingSub.endDate)
        currentEnd.setMonth(currentEnd.getMonth() + 1)

        await db.subscription.update({
          where: { id: existingSub.id },
          data: {
            endDate: currentEnd
          }
        })
      } else {
        // Create new subscription
        const startDate = new Date()
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1)

        await db.subscription.create({
          data: {
            userId: payment.userId,
            planType: 'premium',
            amount: 50000,
            duration: 1,
            startDate,
            endDate,
            isActive: true,
            isTrial: false
          }
        })
      }

      // Create notification for user
      await db.notification.create({
        data: {
          userId: payment.userId,
          type: 'payment_approved',
          title: 'Pembayaran Disetujui!',
          message: 'Selamat! Pembayaran Anda telah disetujui. Subscription premium Anda sekarang aktif.',
          link: '/dashboard/subscription'
        }
      })

    } else if (action === 'reject') {
      updatedPayment = await db.payment.update({
        where: { id: paymentId },
        data: {
          status: 'rejected',
          adminNote: note,
          rejectedAt: new Date()
        }
      })

      // Create notification for user
      await db.notification.create({
        data: {
          userId: payment.userId,
          type: 'payment_rejected',
          title: 'Pembayaran Ditolak',
          message: `Pembayaran Anda ditolak. ${note || 'Silakan upload ulang bukti transfer.'}`,
          link: '/dashboard/subscription'
        }
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Payment disetujui' : 'Payment ditolak',
      payment: updatedPayment
    })

  } catch (error) {
    console.error('Payment action error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses payment' },
      { status: 500 }
    )
  }
}
