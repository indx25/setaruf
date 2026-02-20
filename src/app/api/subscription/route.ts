import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'

// Get subscription data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get active subscription
    let subscription = await db.subscription.findFirst({
      where: {
        userId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    // If no active subscription, create a default free trial for 1 month
    if (!subscription) {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      subscription = await db.subscription.create({
        data: {
          userId,
          planType: 'free',
          amount: 0,
          duration: 1,
          startDate,
          endDate,
          isActive: true,
          isTrial: true
        }
      })
    }

    // Get pending payment
    const pendingPayment = await db.payment.findFirst({
      where: {
        userId,
        status: 'pending'
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const res = NextResponse.json({
      subscription: subscription ? {
        planType: subscription.planType,
        startDate: subscription.startDate?.toISOString() || null,
        endDate: subscription.endDate?.toISOString() || null,
        isActive: subscription.isActive,
        isTrial: subscription.isTrial
      } : null,
      pendingPayment
    })
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    return res

  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Get subscription error:', { error, cid })
    try { logger.record({ type: 'error', action: 'subscription_get', detail: `Subscription get error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data subscription' },
      { status: 500 }
    )
  }
}
