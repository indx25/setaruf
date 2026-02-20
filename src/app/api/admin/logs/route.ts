export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import * as logger from '@/lib/logger'

type LogItem = {
  id: string
  type: string
  action: string
  userId?: string
  userName?: string | null
  detail?: string
  at: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@setaruf.com'
    const baseLimit = 15
    const limitPerMin = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${userId}:logs`, limitPerMin, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)
    const typeFilter = (searchParams.get('type') || '').toLowerCase()
    const actionFilter = (searchParams.get('action') || '').toLowerCase()
    const q = (searchParams.get('q') || '').toLowerCase()
    const fromStr = searchParams.get('from') || ''
    const toStr = searchParams.get('to') || ''
    const from = fromStr ? new Date(fromStr) : null
    const to = toStr ? new Date(toStr) : null

    const [
      users,
      profilesUpdated,
      matches,
      messages,
      payments,
      paymentsUpdated,
      subscriptions,
      notifications,
      psychotests
    ] = await Promise.all([
      db.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      db.profile.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, include: { user: true } }),
      db.match.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { requester: true, target: true } }),
      db.message.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { sender: true, receiver: true } }),
      db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: true } }),
      db.payment.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, include: { user: true } }),
      db.subscription.findMany({ orderBy: { startDate: 'desc' }, take: 100, include: { user: true } }),
      db.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: true } }),
      db.psychoTest.findMany({ orderBy: { completedAt: 'desc' }, take: 100, include: { user: true } }),
    ])

    const items: LogItem[] = []

    users.forEach(u => items.push({
      id: `user_${u.id}_${u.createdAt.toISOString()}_created`,
      type: 'user',
      action: 'created',
      userId: u.id,
      userName: u.name,
      detail: `User terdaftar${u.isPremium ? ' (premium)' : ''}`,
      at: u.createdAt.toISOString(),
    }))

    profilesUpdated.forEach(p => items.push({
      id: `profile_${p.id}_${p.updatedAt.toISOString()}_updated`,
      type: 'profile',
      action: 'updated',
      userId: p.userId,
      userName: p.user?.name || p.fullName,
      detail: 'Profil diperbarui',
      at: p.updatedAt.toISOString(),
    }))

    matches.forEach(m => items.push({
      id: `match_${m.id}_${m.createdAt.toISOString()}_${m.status}`,
      type: 'match',
      action: m.status,
      userId: m.requesterId,
      userName: m.requester?.name,
      detail: `Match ${m.status} dengan ${m.target?.name || m.targetId} (${Math.round(m.matchPercentage || 0)}%)`,
      at: m.createdAt.toISOString(),
    }))

    messages.forEach(msg => items.push({
      id: `message_${msg.id}_${msg.createdAt.toISOString()}_sent`,
      type: 'message',
      action: 'sent',
      userId: msg.senderId,
      userName: msg.sender?.name,
      detail: `Pesan ke ${msg.receiver?.name || msg.receiverId}: "${msg.content.slice(0, 60)}${msg.content.length > 60 ? '…' : ''}"`,
      at: msg.createdAt.toISOString(),
    }))

    payments.forEach(p => items.push({
      id: `payment_${p.id}_${p.createdAt.toISOString()}_created`,
      type: 'payment',
      action: 'created',
      userId: p.userId,
      userName: p.user?.name,
      detail: `Pembayaran ${p.status} Rp ${Math.round(p.amount || 0).toLocaleString('id-ID')}`,
      at: p.createdAt.toISOString(),
    }))

    paymentsUpdated.forEach(p => items.push({
      id: `payment_${p.id}_${(p.updatedAt?.toISOString() || p.createdAt.toISOString())}_${p.status}`,
      type: 'payment',
      action: p.status,
      userId: p.userId,
      userName: p.user?.name,
      detail: `Status pembayaran: ${p.status}`,
      at: (p.updatedAt || p.createdAt).toISOString(),
    }))

    subscriptions.forEach(s => items.push({
      id: `subscription_${s.id}_${s.startDate.toISOString()}_${s.isActive ? 'activated' : 'deactivated'}`,
      type: 'subscription',
      action: s.isActive ? 'activated' : 'deactivated',
      userId: s.userId,
      userName: s.user?.name,
      detail: `${s.planType} ${s.isTrial ? '(trial)' : ''}`,
      at: s.startDate.toISOString(),
    }))

    notifications.forEach(n => items.push({
      id: `notification_${n.id}_${n.createdAt.toISOString()}_${n.type}`,
      type: 'notification',
      action: n.type,
      userId: n.userId,
      userName: n.user?.name,
      detail: n.title || 'Notifikasi',
      at: n.createdAt.toISOString(),
    }))

    psychotests.forEach(t => items.push({
      id: `psychotest_${t.id}_${t.completedAt.toISOString()}_completed`,
      type: 'psychotest',
      action: 'completed',
      userId: t.userId,
      userName: t.user?.name,
      detail: `${t.testType} (${Math.round(t.score || 0)})`,
      at: t.completedAt.toISOString(),
    }))

    // Merge in-memory error logs
    const errorLogs = logger.query({ limit: 500 })
    errorLogs.forEach(e => items.push(e))

    const filtered = items.filter(it => {
      if (typeFilter && it.type.toLowerCase() !== typeFilter) return false
      if (actionFilter && it.action.toLowerCase() !== actionFilter) return false
      if (q && !(`${it.userName || ''} ${it.detail || ''} ${it.type} ${it.action}`).toLowerCase().includes(q)) return false
      const atDate = new Date(it.at)
      if (from && atDate < from) return false
      if (to && atDate > to) return false
      return true
    })
    const sorted = filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit)

    const res = NextResponse.json({ logs: sorted })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (error) {
    console.error('Admin logs error:', error)
    return NextResponse.json({ error: 'Gagal memuat log aktivitas' }, { status: 500 })
  }
}
