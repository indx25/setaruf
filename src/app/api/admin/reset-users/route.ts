export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    if (process.env.ALLOW_ADMIN_TOOLS !== 'true') {
      return NextResponse.json({ error: 'Admin tools disabled' }, { status: 403 })
    }

    const allowed = await throttle(`admin:${userId}:reset-users`, 1, 10 * 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    await db.message.deleteMany({})
    await db.match.deleteMany({})
    await db.psychoTest.deleteMany({})
    await db.payment.deleteMany({})
    await db.subscription.deleteMany({})
    await db.notification.deleteMany({})
    await db.profile.deleteMany({})
    await db.user.deleteMany({ where: { id: { not: admin.id } } })

    return NextResponse.json({ success: true, message: 'Database user berhasil direset. Admin tetap dipertahankan.' })
  } catch (error) {
    console.error('Reset users error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal reset database user: ${msg}` }, { status: 500 })
  }
}
