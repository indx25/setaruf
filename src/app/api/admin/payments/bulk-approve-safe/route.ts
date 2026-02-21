export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminUserId = (session?.user as any)?.id as string | undefined

    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await db.user.findUnique({ where: { id: adminUserId } })
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const allowed = await throttle(`admin:${adminUserId}:bulk-approve-safe`, 5, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { limit = 50 } = await request.json().catch(() => ({ limit: 50 }))
    const take = Math.max(1, Math.min(Number(limit) || 50, 200))

    const candidates = await db.payment.findMany({
      where: {
        status: 'pending',
        fraudLevel: 'SAFE',
        NOT: { proofUrl: null },
      },
      orderBy: { createdAt: 'asc' },
      take
    })

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, processed: 0, approved: 0, skipped: 0 })
    }

    const result = await db.$transaction(async (tx) => {
      let approved = 0
      let skipped = 0
      for (const p of candidates) {
        // validate expected amount matches base + uniqueCode
        const digits = String(p.uniqueCode || '').replace(/\D/g, '')
        const codeNum = digits ? parseInt(digits, 10) : NaN
        const expectedAmount = Number.isFinite(codeNum) ? 50000 + codeNum : null
        if (expectedAmount === null || p.amount !== expectedAmount) {
          skipped++
          continue
        }

        // ensure still pending
        const current = await tx.payment.findUnique({ where: { id: p.id } })
        if (!current || current.status !== 'pending') { skipped++; continue }

        await tx.payment.update({
          where: { id: p.id },
          data: {
            status: 'approved',
            adminNote: 'Bulk approve SAFE',
            approvedBy: adminUserId,
            approvedAt: new Date()
          }
        })

        await tx.user.update({
          where: { id: p.userId },
          data: { isPremium: true }
        })

        const existingSub = await tx.subscription.findFirst({
          where: { userId: p.userId, isActive: true }
        })
        if (existingSub) {
          const currentEnd = new Date(existingSub.endDate || new Date())
          currentEnd.setMonth(currentEnd.getMonth() + 1)
          await tx.subscription.update({
            where: { id: existingSub.id },
            data: { endDate: currentEnd }
          })
        } else {
          const start = new Date()
          const end = new Date()
          end.setMonth(end.getMonth() + 1)
          await tx.subscription.create({
            data: {
              userId: p.userId,
              planType: 'premium',
              amount: p.amount || 50000,
              duration: 1,
              startDate: start,
              endDate: end,
              isActive: true,
              isTrial: false
            }
          })
        }

        await tx.notification.create({
          data: {
            userId: p.userId,
            type: 'payment_approved',
            title: 'Pembayaran Disetujui!',
            message: 'Pembayaran Anda telah disetujui melalui verifikasi otomatis.',
            link: '/dashboard/subscription'
          }
        })

        approved++
      }
      return { processed: candidates.length, approved, skipped }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Bulk approve SAFE error:', error)
    return NextResponse.json({ error: 'Gagal bulk approve SAFE' }, { status: 500 })
  }
}

