export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

// GET - List all users (admin only)
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const gender = searchParams.get('gender') || ''
    const blocked = searchParams.get('blocked') || '' // 'true' | 'false'
    const premium = searchParams.get('premium') || '' // 'true' | 'false'
    const hasProfile = searchParams.get('hasProfile') || '' // 'true' | 'false'
    const city = searchParams.get('city') || ''
    const minAge = parseInt(searchParams.get('minAge') || '')
    const maxAge = parseInt(searchParams.get('maxAge') || '')

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ]
    }
    if (blocked === 'true') where.isBlocked = true
    if (blocked === 'false') where.isBlocked = false
    if (premium === 'true') where.isPremium = true
    if (premium === 'false') where.isPremium = false
    if (gender || city || !isNaN(minAge) || !isNaN(maxAge) || hasProfile) {
      where.profile = {}
      if (gender) where.profile.gender = gender
      if (city) where.profile.city = { contains: city }
      if (!isNaN(minAge) || !isNaN(maxAge)) {
        where.profile.age = {}
        if (!isNaN(minAge)) where.profile.age.gte = minAge
        if (!isNaN(maxAge)) where.profile.age.lte = maxAge
      }
      if (hasProfile === 'true') where.profile.NOT = null
      if (hasProfile === 'false') where.profile = null
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          profile: true,
          subscriptions: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          _count: {
            select: {
              sentMatches: true,
              receivedMatches: true,
              sentMessages: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data user' },
      { status: 500 }
    )
  }
}

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

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

    const { name, email, password, isAdmin: makeAdmin } = await request.json()

    // Check if email exists
    const existing = await db.user.findUnique({
      where: { email }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate unique code
    const uniqueCode = `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        uniqueCode,
        isAdmin: makeAdmin || false
      }
    })

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat user' },
      { status: 500 }
    )
  }
}
