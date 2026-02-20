export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@setaruf.com'
    const baseLimit = 30
    const limitPerMin = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${userId}:ads-list`, limitPerMin, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const q = (searchParams.get('q') || '').trim()
    const position = searchParams.get('position') || ''
    const active = searchParams.get('active') || ''

    const where: any = {}
    if (q) where.title = { contains: q }
    if (position) where.position = position
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false

    const [items, total] = await Promise.all([
      db.advertisement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.advertisement.count({ where })
    ])

    const res = NextResponse.json({
      advertisements: items,
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
    return NextResponse.json({ error: 'Failed to load advertisements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { title, description, imageUrl, linkUrl, position, isActive, startDate, endDate } = body
    const allowedPositions = new Set([
      'dashboard_left',
      'dashboard_right',
      'dashboard_top',
      'dashboard_center',
      'dashboard_middle',
      'dashboard_bottom'
    ])
    const isValidImage =
      typeof imageUrl === 'string'
        ? /^(\/|https:\/\/)/.test(imageUrl) && !/^javascript:/i.test(imageUrl)
        : imageUrl === null || typeof imageUrl === 'undefined'
    const isValidLink =
      typeof linkUrl === 'string'
        ? /^https?:\/\//.test(linkUrl) && !/^javascript:/i.test(linkUrl)
        : linkUrl === null || typeof linkUrl === 'undefined'
    if (!title || !position) {
      return NextResponse.json({ error: 'Title and position are required' }, { status: 400 })
    }
    if (!allowedPositions.has(position)) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }
    if (!isValidImage) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
    }
    if (!isValidLink) {
      return NextResponse.json({ error: 'Invalid link URL' }, { status: 400 })
    }
    const created = await db.advertisement.create({
      data: {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        position,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null
      }
    })
    return NextResponse.json({ advertisement: created })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create advertisement' }, { status: 500 })
  }
}
