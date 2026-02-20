export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

// GET - List subscriptions with user info (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@setaruf.com'
    const baseLimit = 20
    const rlLimit = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${userId}:subscriptions-list`, rlLimit, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = (searchParams.get('search') || '').trim()
    const plan = (searchParams.get('plan') || '').trim() // 'free' | 'premium' | ''
    const active = (searchParams.get('active') || '').trim() // 'true' | 'false' | ''

    const where: any = {}
    if (plan) where.planType = plan
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false

    const [items, total] = await Promise.all([
      db.subscription.findMany({
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
      db.subscription.count({ where })
    ])

    const filtered = search
      ? items.filter(s => {
          const name = s.user?.name || s.user?.profile?.fullName || ''
          const email = s.user?.email || ''
          return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase())
        })
      : items

    const res = NextResponse.json({
      subscriptions: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal memuat subscriptions: ${msg}` }, { status: 500 })
  }
}
