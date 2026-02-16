import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    // Fetch user data with relations
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscriptions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        notifications: {
          where: { isRead: false },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch psychotest results
    const psychotests = await db.psychoTest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    // Fetch matches where user is the requester
    const matches = await db.match.findMany({
      where: {
        requesterId: userId,
        status: { in: ['pending', 'approved'] }
      },
      include: {
        target: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { matchPercentage: 'desc' },
      take: 10
    })

    // Format matches data
    const formattedMatches = matches.map(match => ({
      id: match.id,
      targetId: match.targetId,
      targetName: match.target.name || 'Unknown',
      targetInitials: match.target.profile?.initials,
      targetAvatar: match.target.avatar,
      targetAge: match.target.profile?.age,
      targetOccupation: match.target.profile?.occupation,
      targetCity: match.target.profile?.city,
      matchPercentage: match.matchPercentage || 0
    }))

    // Fetch advertisements
    const now = new Date()
    const advertisements = await db.advertisement.findMany({
      where: {
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ],
        startDate: { lte: now }
      },
      orderBy: { createdAt: 'asc' },
      take: 3
    })

    // Get active subscription
    const activeSubscription = user.subscriptions[0] || null

    // Format psychotest data
    const formattedPsychotests = psychotests.map(test => ({
      testType: test.testType,
      score: test.score || 0,
      result: test.result || 'Belum dinilai'
    }))

    // Return dashboard data
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        uniqueCode: user.uniqueCode,
        workflowStatus: user.workflowStatus
      },
      profile: user.profile ? {
        initials: user.profile.initials,
        fullName: user.profile.fullName,
        age: user.profile.age,
        occupation: user.profile.occupation,
        city: user.profile.city
      } : null,
      psychotests: formattedPsychotests,
      subscription: activeSubscription ? {
        planType: activeSubscription.planType,
        endDate: activeSubscription.endDate?.toISOString() || null,
        isActive: activeSubscription.isActive
      } : null,
      matches: formattedMatches,
      notifications: user.notifications.length,
      advertisements: advertisements.map(ad => ({
        id: ad.id,
        title: ad.title,
        imageUrl: ad.imageUrl,
        linkUrl: ad.linkUrl
      }))
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat dashboard' },
      { status: 500 }
    )
  }
}
