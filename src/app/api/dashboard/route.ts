import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'

const TEST_WEIGHTS: Record<string, number> = {
  pre_marriage: 0.4,
  disc: 0.2,
  clinical: 0.2,
  '16pf': 0.2
}

function calculateMatchScore(userTests: any[], targetTests: any[]): number {
  if (!userTests.length || !targetTests.length) return 50
  let total = 0
  let weightSum = 0
  for (const testType of Object.keys(TEST_WEIGHTS)) {
    const weight = TEST_WEIGHTS[testType]
    const a = userTests.find(t => t.testType === testType)
    const b = targetTests.find(t => t.testType === testType)
    if (a && b && typeof a.score === 'number' && typeof b.score === 'number') {
      const similarity = 100 - Math.abs(a.score - b.score)
      total += similarity * weight
      weightSum += weight
    }
  }
  if (weightSum === 0) return 50
  return Math.round(total / weightSum)
}

function normalizeGender(s?: string | null): string | null {
  if (!s) return null
  const t = s.toLowerCase()
  if (/^(male|pria|laki|cowok|laki-laki)$/.test(t)) return 'male'
  if (/^(female|wanita|perempuan|cewek)$/.test(t)) return 'female'
  return null
}

function normalizeReligion(s?: string | null): string | null {
  if (!s) return null
  const t = s.toLowerCase()
  const map: Record<string, string> = {
    islam: 'islam',
    moslem: 'islam',
    muslim: 'islam',
    kristen: 'kristen',
    protestan: 'kristen',
    christian: 'kristen',
    protestant: 'kristen',
    katolik: 'katolik',
    catholic: 'katolik',
    hindu: 'hindu',
    hinduism: 'hindu',
    buddha: 'buddha',
    buddhist: 'buddha',
    buddhism: 'buddha',
    konghucu: 'konghucu',
    confucian: 'konghucu',
    confucianism: 'konghucu'
  }
  return map[t] || null
}

function buildReasons(me: any, meTests: any[], other: any, otherTests: any[], matchPct: number): string[] {
  const reasons: string[] = []
  const meGender = normalizeGender(me?.profile?.gender) || null
  const otherGender = normalizeGender(other?.profile?.gender) || null
  const meReligion = normalizeReligion(me?.profile?.religion) || null
  const otherReligion = normalizeReligion(other?.profile?.religion) || null
  const meCity = (me?.profile?.city || '').toLowerCase()
  const otherCity = (other?.profile?.city || '').toLowerCase()
  const meAge = me?.profile?.age
  const otherAge = other?.profile?.age
  if (meCity && otherCity && otherCity.includes(meCity)) reasons.push('Domisili cocok')
  if (typeof meAge === 'number' && typeof otherAge === 'number') {
    const minA = Math.max(18, meAge - 5)
    const maxA = meAge + 5
    if (otherAge >= minA && otherAge <= maxA) reasons.push('Rentang usia sesuai')
  }
  const labels: Record<string, string> = { pre_marriage: 'Pra-Nikah', disc: 'DISC', clinical: 'Clinical', '16pf': '16PF' }
  for (const testType of ['pre_marriage', 'disc', 'clinical', '16pf']) {
    const a = meTests.find(t => t.testType === testType)
    const b = otherTests.find(t => t.testType === testType)
    if (a && b && typeof a.score === 'number' && typeof b.score === 'number') {
      const sim = 100 - Math.abs(a.score - b.score)
      if (sim >= 70) reasons.push(`Skor ${labels[testType] || testType} serupa`)
    }
  }
  if (matchPct >= 85) reasons.push('Kecocokan keseluruhan tinggi')
  else if (matchPct >= 60) reasons.push('Kecocokan keseluruhan sedang')
  return reasons.slice(0, 8)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    try {
      console.log('SESSION:', session?.user)
      console.log('Session user id:', userId)
    } catch {}

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
    try {
      console.log('ME:', { id: user.id, email: user.email })
      console.log('ME PROFILE:', user.profile)
      console.log('PROFILE COMPLETED CHECK INPUT:', {
        gender: user.profile?.gender,
        religion: user.profile?.religion,
        age: user.profile?.age
      })
    } catch {}

    // Guard: require minimal profile before running matching
    const p = user.profile
    const profileIncomplete =
      !p ||
      !p.gender ||
      !p.religion ||
      typeof p.age !== 'number' ||
      p.age < 18
    if (profileIncomplete) {
      return NextResponse.json({ requiresProfileCompletion: true })
    }

    // Fetch psychotest results
    const psychotests = await db.psychoTest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
    try {
      console.log('PSYCHOTESTS COUNT:', psychotests.length)
    } catch {}

    // Clean self-matches (safeguard)
    await db.match.deleteMany({
      where: { requesterId: userId, targetId: userId }
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
    // Opposite gender and same religion setup
    const myGender = normalizeGender(user.profile?.gender)
    const myReligion = normalizeReligion(user.profile?.religion)
    const oppositeGender =
      myGender === 'male' ? 'female' :
      myGender === 'female' ? 'male' : null

    // Existing matches (exclude from recommendation)
    const existingMatches = await db.match.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { targetId: userId }
        ]
      }
    })
    try {
      console.log('EXISTING_MATCHES:', existingMatches.length)
    } catch {}
    const existingSet = new Set(
      existingMatches.map(m => (m.requesterId === userId ? m.targetId : m.requesterId))
    )

    // Quick counters for diagnostics
    try {
      const totalUsersCount = await db.user.count({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: { age: { gte: 18 } }
        }
      })
      const filteredUsersCount = await db.user.count({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: {
            ...(oppositeGender ? { gender: { equals: oppositeGender, mode: 'insensitive' } } : {}),
            ...(myReligion ? { religion: { equals: myReligion, mode: 'insensitive' } } : {}),
            age: { gte: 18 }
          }
        }
      })
      console.log('TOTAL USERS:', totalUsersCount)
      console.log('FILTERED:', filteredUsersCount)
    } catch {}

    // Single query candidates
    const candidates = await db.user.findMany({
      where: {
        id: { not: userId },
        isBlocked: false,
        profile: {
          ...(oppositeGender ? { gender: { equals: oppositeGender, mode: 'insensitive' } } : {}),
          ...(myReligion ? { religion: { equals: myReligion, mode: 'insensitive' } } : {}),
          age: { gte: 18 }
        }
      },
      include: {
        profile: true,
        psychotests: true
      },
      take: 150
    })
    try {
      console.log('FILTERS:', { oppositeGender, myReligion })
      console.log('ALL USERS (candidates):', candidates.length)
    } catch {}

    // Scoring and create matches
    const myTests = await db.psychoTest.findMany({ where: { userId } })
    const scored = candidates
      .filter(c => !existingSet.has(c.id))
      .map(c => ({
        user: c,
        score: calculateMatchScore(myTests, c.psychotests || [])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
    try {
      console.log('FILTERED (scored topN):', scored.length)
    } catch {}

    const createdMatches = await Promise.all(
      scored.map(s =>
        db.match.create({
          data: {
            requesterId: userId,
            targetId: s.user.id,
            matchPercentage: s.score,
            aiReasoning: 'Rekomendasi berdasarkan kecocokan psikotes',
            status: 'pending',
            step: 'profile_request'
          }
        })
      )
    )
    try {
      console.log('CREATED_MATCHES:', createdMatches.length)
    } catch {}

    // Format
    let formattedMatches = createdMatches.map((match, index) => {
      const cand = scored[index].user
      const meTests = myTests.map(t => ({ testType: t.testType, score: t.score || 0, result: t.result || '' }))
      const otherTests = (cand.psychotests || []).map(t => ({ testType: t.testType, score: t.score || 0, result: t.result || '' }))
      return {
        id: match.id,
        targetId: cand.id,
        targetName: cand.name || 'Unknown',
        targetInitials: getInitials(cand.name || ''),
        targetAvatar: cand.avatar,
        targetAge: cand.profile?.age,
        targetGender: normalizeGender(cand.profile?.gender),
        targetReligion: normalizeReligion(cand.profile?.religion),
        targetOccupation: getDerivedOccupation(cand.profile),
        targetWhatsapp: cand.profile?.whatsapp || null,
        targetInstagram: cand.profile?.instagram || null,
        targetQuote: cand.profile?.quote || null,
        targetCity: cand.profile?.city,
        matchPercentage: match.matchPercentage,
        aiReasoning: match.aiReasoning || 'Rekomendasi berdasarkan kecocokan psikotes.',
        aiReasons: buildReasons({ profile: user.profile }, meTests, { profile: cand.profile }, otherTests, match.matchPercentage || 0),
        matchStatus: match.status,
        matchStep: match.step
      }
    })
    const beforeFilterCount = formattedMatches.length

    const myGender2 = normalizeGender(user.profile?.gender) || null
    const myReligion2 = normalizeReligion(user.profile?.religion) || null
    const passesDefault = (m: any) => {
      const okAdult = (m.targetAge ?? 0) >= 18
      const tg = normalizeGender(m.targetGender)
      const tr = normalizeReligion(m.targetReligion)
      const okGender = myGender2 ? (tg != null ? tg !== myGender2 : false) : true
      const okReligion = myReligion2 ? (tr != null ? tr === myReligion2 : false) : true
      return okAdult && okGender && okReligion
    }

    // Already filtered by gender/religion and age in query; keep final filter for safety

    formattedMatches = formattedMatches.filter(passesDefault)
    try {
      console.log('FORMATTED_BEFORE_FILTER:', beforeFilterCount)
      console.log('FORMATTED_AFTER_FILTER:', formattedMatches.length)
    } catch {}

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
    const matchingAvailable = formattedMatches.length > 0
    const profileCompletionCount = !!user.profile ? requiredProfileFields.filter(f => (user.profile as any)[f]).length : 0
    const profileCompletionPercent = Math.round((profileCompletionCount / requiredProfileFields.length) * 100)
    const psychotestCompletedCount = requiredTests.filter(t => testTypesSet.has(t)).length
    const psychotestRequiredCount = requiredTests.length
    const psychotestCompletionPercent = Math.round((psychotestCompletedCount / psychotestRequiredCount) * 100)

    // Return dashboard data
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    const res = NextResponse.json({
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
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    res.headers.set('X-Request-ID', cid)
    return res

  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Dashboard API error:', { error, cid })
    try { logger.record({ type: 'error', action: 'dashboard_get', detail: `Dashboard API error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat dashboard' },
      { status: 500 }
    )
  }
}
