export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

// GET - Get web insights (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

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
    const baseLimit = 10
    const limitPerMin = admin.email === adminEmail ? baseLimit * 3 : baseLimit
    const allowed = await throttle(`admin:${userId}:insights`, limitPerMin, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('recommendationsFor') || searchParams.get('user') || searchParams.get('q')
    if (q) {
      const qTrim = q.trim()
      const byUnique = await db.user.findFirst({ where: { uniqueCode: qTrim.toUpperCase() }, include: { profile: true, psychotests: true } })
      const byEmail = byUnique ? null : await db.user.findFirst({ where: { email: qTrim }, include: { profile: true, psychotests: true } })
      const byName = byUnique || byEmail ? null : await db.user.findFirst({
        where: {
          OR: [
            { name: { contains: qTrim, mode: 'insensitive' } },
            { profile: { is: { fullName: { contains: qTrim, mode: 'insensitive' } } } }
          ]
        },
        include: { profile: true, psychotests: true }
      })
      const u = byUnique || byEmail || byName
      if (!u) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      const ms = await db.match.findMany({
        where: { requesterId: u.id, status: { in: ['pending', 'rejected'] } },
        include: { target: { include: { profile: true } } },
        orderBy: { matchPercentage: 'desc' },
        take: 100
      })
      const list = ms.map(m => ({
        id: m.id,
        status: m.status,
        match: m.matchPercentage || 0,
        targetId: m.targetId,
        name: (m as any).target?.profile?.fullName || (m as any).target?.name || 'Unknown',
        city: (m as any).target?.profile?.city || null,
        age: (m as any).target?.profile?.age || null
      }))
      return NextResponse.json({ user: { id: u.id, name: u.name, fullName: u.profile?.fullName || null, email: u.email, uniqueCode: u.uniqueCode }, recommendations: list })
    }

    // Get all counts
    const [
      totalUsers,
      premiumUsers,
      blockedUsers,
      totalPayments,
      approvedPayments,
      pendingPayments,
      rejectedPayments,
      totalMatches,
      totalMessages,
      totalAds,
      activeSubscriptions,
      expiredSubscriptions
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isPremium: true } }),
      db.user.count({ where: { isBlocked: true } }),
      db.payment.count(),
      db.payment.count({ where: { status: 'approved' } }),
      db.payment.count({ where: { status: 'pending' } }),
      db.payment.count({ where: { status: 'rejected' } }),
      db.match.count(),
      db.message.count(),
      db.advertisement.count(),
      db.subscription.count({ where: { isActive: true } }),
      db.subscription.count({ where: { isActive: false } })
    ])

    // Get revenue
    const approvedPaymentsData = await db.payment.findMany({
      where: { status: 'approved' },
      select: { amount: true, createdAt: true }
    })

    const totalRevenue = approvedPaymentsData.reduce((sum, p) => sum + (p.amount || 0), 0)

    // Get revenue this month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const revenueThisMonth = approvedPaymentsData
      .filter(p => p.createdAt >= startOfMonth)
      .reduce((sum, p) => sum + (p.amount || 0), 0)

    // Get user growth (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const newUsersLast7Days = await db.user.count({
      where: {
        createdAt: { gte: sevenDaysAgo }
      }
    })

    // Get match statistics
    const matchesByStatus = await db.match.groupBy({
      by: ['status'],
      _count: true
    })

    // Get psychotest completion rate
    const usersWithProfile = await db.profile.count()
    const usersWithAllTests = await db.user.count({
      where: {
        psychotests: {
          some: {}
        }
      }
    })

    // Get recent activity
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { profile: true }
    })

    const recentPayments = await db.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } }
    })

    // Extended analytics: traffic, login, demographics
    const daysParam = parseInt(searchParams.get('days') || '30', 10)
    const days = Math.min(Math.max(isNaN(daysParam) ? 30 : daysParam, 7), 180)
    const startRange = new Date()
    startRange.setDate(startRange.getDate() - days)

    function toKey(d: Date) {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return x.toISOString().slice(0, 10)
    }

    const [
      usersLast30,
      matchesLast30,
      messagesLast30,
      paymentsLast30,
      sessionsLast30,
      providerGroups,
      genderGroups,
      cityGroups,
      profilesWithAge
    ] = await Promise.all([
      db.user.findMany({ where: { createdAt: { gte: startRange } }, select: { createdAt: true } }),
      db.match.findMany({ where: { createdAt: { gte: startRange } }, select: { createdAt: true } }),
      db.message.findMany({ where: { createdAt: { gte: startRange } }, select: { createdAt: true } }),
      db.payment.findMany({ where: { createdAt: { gte: startRange } }, select: { createdAt: true } }),
      db.session.findMany({ where: { expires: { gte: startRange } }, select: { expires: true } }),
      db.account.groupBy({ by: ['provider'], _count: true }),
      db.profile.groupBy({ by: ['gender'], _count: true }),
      db.profile.groupBy({ by: ['city'], _count: true }),
      db.profile.findMany({ where: { age: { not: null } }, select: { age: true } })
    ])

    const trafficMap: Record<string, { date: string; newUsers: number; matches: number; messages: number; payments: number; sessions: number }> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const key = toKey(d)
      trafficMap[key] = { date: key, newUsers: 0, matches: 0, messages: 0, payments: 0, sessions: 0 }
    }
    usersLast30.forEach(u => { const k = toKey(u.createdAt as unknown as Date); if (trafficMap[k]) trafficMap[k].newUsers++ })
    matchesLast30.forEach(m => { const k = toKey(m.createdAt as unknown as Date); if (trafficMap[k]) trafficMap[k].matches++ })
    messagesLast30.forEach(m => { const k = toKey(m.createdAt as unknown as Date); if (trafficMap[k]) trafficMap[k].messages++ })
    paymentsLast30.forEach(p => { const k = toKey(p.createdAt as unknown as Date); if (trafficMap[k]) trafficMap[k].payments++ })
    sessionsLast30.forEach(s => { const k = toKey(s.expires as unknown as Date); if (trafficMap[k]) trafficMap[k].sessions++ })
    const trafficDaily = Object.values(trafficMap)

    const providerBreakdown: Record<string, number> = {}
    providerGroups.forEach(g => { providerBreakdown[g.provider] = g._count })
    const oauthUsersCount = await db.account.count()
    const totalUsersCount = await db.user.count()
    const credentialsUsers = Math.max(totalUsersCount - oauthUsersCount, 0)
    providerBreakdown['credentials'] = credentialsUsers

    const genderBreakdown: Record<string, number> = {}
    genderGroups.forEach(g => { if (g.gender) genderBreakdown[g.gender] = g._count })

    const ageBuckets = { '17-24': 0, '25-34': 0, '35-44': 0, '45+': 0 }
    profilesWithAge.forEach(p => {
      const a = p.age as number
      if (a < 25) ageBuckets['17-24']++
      else if (a < 35) ageBuckets['25-34']++
      else if (a < 45) ageBuckets['35-44']++
      else ageBuckets['45+']++
    })

    const topCities = cityGroups
      .filter(c => c.city)
      .sort((a, b) => b._count - a._count)
      .slice(0, 5)
      .map(c => ({ city: c.city as string, count: c._count }))

    const res = NextResponse.json({
      overview: {
        totalUsers,
        premiumUsers,
        blockedUsers,
        activeSubscriptions,
        totalMatches,
        totalMessages
      },
      payments: {
        totalPayments,
        approvedPayments,
        pendingPayments,
        rejectedPayments,
        totalRevenue,
        revenueThisMonth
      },
      users: {
        newUsersLast7Days,
        usersWithProfile,
        usersWithAllTests,
        completionRate: totalUsers > 0 ? ((usersWithAllTests / totalUsers) * 100).toFixed(1) : 0
      },
      matches: matchesByStatus,
      recent: {
        users: recentUsers,
        payments: recentPayments
      },
      analytics: {
        trafficDaily,
        providerBreakdown,
        sessions: {
          totalActive: await db.session.count({ where: { expires: { gt: new Date() } } }),
          totalSessions: await db.session.count()
        },
        demographics: {
          gender: genderBreakdown,
          ageBuckets,
          topCities
        }
      }
    })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res

  } catch (error) {
    console.error('Get insights error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil insights' },
      { status: 500 }
    )
  }
}
