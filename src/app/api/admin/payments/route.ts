export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

// GET - List all payments (admin only)
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

    // Check if admin
    const admin = await db.user.findUnique({
      where: { id: userId }
    })

    if (!admin?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@setaruf.com'
    const baseLimit = 20
    const rlLimit = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${userId}:payments-list`, rlLimit, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const fraudLevel = searchParams.get('fraudLevel') || ''
    const daysParam = parseInt(searchParams.get('days') || '')
    const days = !isNaN(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : null

    const where: any = {}
    if (status) where.status = status
    if (fraudLevel) where.fraudLevel = fraudLevel
    if (days) {
      const start = new Date()
      start.setDate(start.getDate() - days)
      where.createdAt = { gte: start }
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          user: {
            include: { profile: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.payment.count({ where })
    ])

    const res = NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res

  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data payment' },
      { status: 500 }
    )
  }
}
