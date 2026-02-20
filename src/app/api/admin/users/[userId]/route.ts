export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { throttle } from '@/lib/rate-limit'

// GET - Get single user (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    // Check if admin
    const admin = await db.user.findUnique({
      where: { id: adminUserId }
    })

    if (!admin?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = params

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscriptions: true,
        payments: true,
        psychotests: true,
        _count: {
          select: {
            sentMatches: true,
            receivedMatches: true,
            sentMessages: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data user' },
      { status: 500 }
    )
  }
}

// PATCH - Update user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    // Check if admin
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
    const baseLimit = 20
    const limitPerMin = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${adminUserId}:user-update`, limitPerMin, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { userId } = params
    const { name, email, password, isAdmin, isBlocked, isPremium } = await request.json()

    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked
    if (isPremium !== undefined) updateData.isPremium = isPremium
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengupdate user' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    // Check if admin
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
    const allowed = await throttle(`admin:${adminUserId}:user-delete`, limitPerMin, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { userId } = params

    await db.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({
      success: true,
      message: 'User berhasil dihapus'
    })

  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus user' },
      { status: 500 }
    )
  }
}
