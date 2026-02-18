export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH - Update subscription (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const adminUserId = (session?.user as any)?.id as string | undefined
    if (!adminUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminUserId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })

    const { subscriptionId } = params
    const body = await request.json()
    const {
      planType,
      duration, // months
      startDate,
      endDate,
      isActive,
      isTrial,
      upgradeToPremium
    } = body

    const existing = await db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true }
    })
    if (!existing) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

    let newStart = startDate ? new Date(startDate) : existing.startDate
    let newEnd = endDate ? new Date(endDate) : existing.endDate || null
    if (typeof duration === 'number' && !isNaN(duration)) {
      const base = new Date(newStart)
      base.setMonth(base.getMonth() + duration)
      newEnd = base
    }

    const updated = await db.subscription.update({
      where: { id: subscriptionId },
      data: {
        planType: planType ?? existing.planType,
        duration: typeof duration === 'number' ? duration : existing.duration,
        startDate: newStart,
        endDate: newEnd || null,
        isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
        isTrial: typeof isTrial === 'boolean' ? isTrial : existing.isTrial,
      }
    })

    const makePremium = upgradeToPremium === true || planType === 'premium'
    if (makePremium) {
      await db.user.update({
        where: { id: existing.userId },
        data: { isPremium: true }
      })
    }

    return NextResponse.json({ success: true, subscription: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal update subscription: ${msg}` }, { status: 500 })
  }
}
