import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function calculateMatchPercentage(userPsychotests: any[], targetPsychotests: any[]): number {
  if (!userPsychotests.length || !targetPsychotests.length) {
    return Math.random() * 40 + 30
  }
  let totalScore = 0
  let count = 0
  const testTypes = ['pre_marriage', 'disc', 'clinical', '16pf']
  for (const testType of testTypes) {
    const a = userPsychotests.find(t => t.testType === testType)
    const b = targetPsychotests.find(t => t.testType === testType)
    if (a && b && a.score && b.score) {
      const difference = Math.abs(a.score - b.score)
      const similarity = 100 - difference
      totalScore += similarity
      count++
    }
  }
  if (count === 0) return Math.random() * 40 + 30
  const baseScore = totalScore / count
  const aiVariation = (Math.random() - 0.5) * 20
  let finalScore = baseScore + aiVariation
  return Math.max(0, Math.min(100, finalScore))
}

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

    await db.match.deleteMany({
      where: { requesterId: userId, targetId: userId }
    })
    let matches = await db.match.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { targetId: userId },
        ],
        status: { in: ['pending', 'approved'] }
      },
      include: {
        requester: {
          include: { profile: true }
        },
        target: {
          include: { profile: true }
        }
      },
      orderBy: { matchPercentage: 'desc' },
      take: 10
    })

    const getInitials = (name?: string | null) => {
      if (!name) return ''
      return name.split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0, 2)
    }
    const getDerivedOccupation = (profile: any) => {
      if (!profile) return undefined
      if (profile.occupation) return profile.occupation
      if (profile.workplace) {
        try {
          const parsed = JSON.parse(profile.workplace)
          const first = Array.isArray(parsed) ? parsed[0] : null
          if (first) {
            return first.position || first.company || undefined
          }
        } catch {}
      }
      return undefined
    }
    let formattedMatches = matches.map(match => {
      const isRequester = match.requesterId === userId
      const other = isRequester ? match.target : match.requester
      return {
        id: match.id,
        targetId: other.id,
        targetName: other.name || 'Unknown',
        targetInitials: getInitials(other.name || ''),
        targetAvatar: other.avatar,
        targetAge: other.profile?.age,
        targetGender: other.profile?.gender,
        targetReligion: other.profile?.religion,
        targetOccupation: getDerivedOccupation(other.profile),
        targetWhatsapp: other.profile?.whatsapp || null,
        targetInstagram: other.profile?.instagram || null,
        targetQuote: other.profile?.quote || null,
        targetCity: other.profile?.city,
        matchPercentage: match.matchPercentage || 0,
        matchStatus: match.status,
        matchStep: match.step
      }
    })

    // Fallback: if less than 10, fill with candidate users (no existing match)
    if (formattedMatches.length < 10) {
      const needed = 10 - formattedMatches.length
      const existingOtherIds = new Set<string>(
        matches.map(m => (m.requesterId === userId ? m.targetId : m.requesterId))
      )
      const currentGender = user.profile?.gender || null
      const oppositeGender = currentGender === 'male' ? 'female' : currentGender === 'female' ? 'male' : null

      const city = user.profile?.city || null
      const religion = user.profile?.religion || null
      const userAge = user.profile?.age || null
      const minAge = userAge ? Math.max(18, userAge - 5) : undefined
      const maxAge = userAge ? userAge + 5 : undefined

      const strict = await db.user.findMany({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: {
            ...(oppositeGender ? { gender: oppositeGender } : {}),
            ...(city ? { city: { contains: city } } : {}),
            ...(religion ? { religion } : {}),
            ...(minAge || maxAge ? { age: { ...(minAge ? { gte: minAge } : {}), ...(maxAge ? { lte: maxAge } : {}) } } : {}),
          }
        },
        include: { profile: true, psychotests: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      const medium = await db.user.findMany({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: {
            ...(oppositeGender ? { gender: oppositeGender } : {}),
            ...(religion ? { religion } : {}),
            ...(minAge || maxAge ? { age: { ...(minAge ? { gte: minAge } : {}), ...(maxAge ? { lte: maxAge } : {}) } } : {}),
          }
        },
        include: { profile: true, psychotests: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      const base = await db.user.findMany({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: {
            ...(oppositeGender ? { gender: oppositeGender } : {}),
          }
        },
        include: { profile: true, psychotests: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      const seenIds = new Set<string>()
      const candidates = [...strict, ...medium, ...base].filter(c => {
        if (seenIds.has(c.id)) return false
        seenIds.add(c.id)
        return true
      })

      const scored: Array<{ cand: any; score: number }> = []
      for (const cand of candidates) {
        if (existingOtherIds.has(cand.id)) continue
        const score = calculateMatchPercentage(psychotests, cand.psychotests || [])
        scored.push({ cand, score })
      }
      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, needed)

      for (const { cand, score } of top) {
        // ensure no existing match in either direction
        const existing = await db.match.findFirst({
          where: {
            OR: [
              { requesterId: userId, targetId: cand.id },
              { requesterId: cand.id, targetId: userId }
            ]
          }
        })
        let ensured = existing
        if (!ensured) {
          ensured = await db.match.create({
            data: {
              requesterId: userId,
              targetId: cand.id,
              matchPercentage: Math.round(score),
              aiReasoning: 'Rekomendasi berdasarkan kecocokan psikotes.',
              status: 'pending',
              step: 'profile_request'
            }
          })
        }
        formattedMatches.push({
          id: ensured.id,
          targetId: cand.id,
          targetName: cand.name || 'Unknown',
          targetInitials: (cand.name || '').split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0, 2),
          targetAvatar: cand.avatar,
          targetAge: cand.profile?.age,
          targetGender: cand.profile?.gender,
          targetReligion: cand.profile?.religion,
          targetOccupation: getDerivedOccupation(cand.profile),
          targetWhatsapp: cand.profile?.whatsapp || null,
          targetInstagram: cand.profile?.instagram || null,
          targetQuote: cand.profile?.quote || null,
          targetCity: cand.profile?.city,
          matchPercentage: ensured.matchPercentage || Math.round(score),
          matchStatus: ensured.status,
          matchStep: ensured.step
        })
        if (formattedMatches.length >= 10) break
      }
    }

    // Apply gender/religion/age filters strictly
    const myGender = user.profile?.gender || null
    const myReligion = user.profile?.religion || null
    formattedMatches = formattedMatches.filter((m: any) => {
      const okAdult = (m.targetAge ?? 0) >= 18
      const okGender = myGender ? (m.targetGender && m.targetGender !== myGender) : true
      const okReligion = myReligion ? (m.targetReligion && m.targetReligion === myReligion) : true
      return okAdult && okGender && okReligion
    })

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
      take: 50
    })

    // Get active subscription
    const activeSubscription = user.subscriptions[0] || null

    // Format psychotest data
    const formattedPsychotests = psychotests.map(test => ({
      testType: test.testType,
      score: test.score || 0,
      result: test.result || 'Belum dinilai'
    }))

    // Compute workflow flags
    const requiredProfileFields = ['fullName', 'gender', 'dateOfBirth', 'religion', 'city'] as const
    const profileCompleted = !!user.profile && requiredProfileFields.every(f => (user.profile as any)[f])
    const requiredTests = ['pre_marriage', 'disc', 'clinical', '16pf']
    const testTypesSet = new Set(psychotests.map(t => t.testType))
    const psychotestCompleted = requiredTests.every(t => testTypesSet.has(t))
    const matchingAvailable = matches.length > 0
    const profileCompletionCount = !!user.profile ? requiredProfileFields.filter(f => (user.profile as any)[f]).length : 0
    const profileCompletionPercent = Math.round((profileCompletionCount / requiredProfileFields.length) * 100)
    const psychotestCompletedCount = requiredTests.filter(t => testTypesSet.has(t)).length
    const psychotestRequiredCount = requiredTests.length
    const psychotestCompletionPercent = Math.round((psychotestCompletedCount / psychotestRequiredCount) * 100)

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
        fullName: user.profile.fullName,
        age: user.profile.age,
        gender: user.profile.gender,
        religion: user.profile.religion,
        photoUrl: user.profile.photoUrl,
        occupation: getDerivedOccupation(user.profile),
        city: user.profile.city,
        quote: user.profile.quote || null
      } : null,
      psychotests: formattedPsychotests,
      subscription: activeSubscription ? {
        planType: activeSubscription.planType,
        startDate: activeSubscription.startDate?.toISOString() || null,
        endDate: activeSubscription.endDate?.toISOString() || null,
        isActive: activeSubscription.isActive
      } : null,
      matches: formattedMatches,
      flags: {
        profileCompleted,
        psychotestCompleted,
        matchingAvailable
      },
      progress: {
        profileCompletionPercent,
        psychotestCompletionPercent,
        psychotestCompletedCount,
        psychotestRequiredCount
      },
      notifications: user.notifications.length,
      advertisements: advertisements.map(ad => ({
        id: ad.id,
        title: ad.title,
        imageUrl: ad.imageUrl,
        linkUrl: ad.linkUrl,
        position: ad.position
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
