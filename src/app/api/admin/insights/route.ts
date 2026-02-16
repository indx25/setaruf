import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

// GET - Get web insights (admin only)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
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

    return NextResponse.json({
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
      }
    })

  } catch (error) {
    console.error('Get insights error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil insights' },
      { status: 500 }
    )
  }
}
