import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import * as logger from '@/lib/logger'

function normalizeGender(s?: string | null): string | null {
  const t = (s || '').toLowerCase().trim()
  if (!t) return null
  if (['male','pria','laki','laki-laki','cowok'].includes(t)) return 'male'
  if (['female','wanita','perempuan','cewek'].includes(t)) return 'female'
  return t
}

function normalizeReligion(s?: string | null): string | null {
  const t = (s || '').toLowerCase().trim()
  if (!t) return null
  if (['islam','muslim','moslem'].includes(t)) return 'islam'
  if (['kristen','protestan'].includes(t)) return 'kristen'
  if (['katolik','catholic'].includes(t)) return 'katolik'
  return t
}

const ENGINE_VERSION = 2
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
interface TraitVector { dominance: number; stability: number; empathy: number; logic: number; religiosity: number; conflictStyle: number; attachmentSecurity: number; ambition: number }
function extractTraitVector(tests: any[]): TraitVector {
  const get = (type: string) => {
    const t = tests.find((tt: any) => tt.testType === type)
    return typeof t?.score === 'number' ? clamp(t.score, 0, 100) : 50
  }
  return {
    dominance: get('disc'),
    stability: get('clinical'),
    empathy: get('pre_marriage'),
    logic: get('16pf'),
    religiosity: get('pre_marriage'),
    conflictStyle: get('disc'),
    attachmentSecurity: get('clinical'),
    ambition: get('16pf')
  }
}
function calculateTraitCompatibility(a: TraitVector, b: TraitVector): number {
  const weights = { dominance: 0.15, stability: 0.2, empathy: 0.15, logic: 0.1, religiosity: 0.15, conflictStyle: 0.1, attachmentSecurity: 0.1, ambition: 0.05 }
  let total = 0
  for (const k in weights) {
    const key = k as keyof TraitVector
    const diff = Math.abs(a[key] - b[key])
    const sim = 100 - diff
    total += sim * (weights as any)[k]
  }
  return Math.round(total)
}
function calculateConflictRisk(a: TraitVector, b: TraitVector): number {
  let raw = 0
  if (a.dominance > 75 && b.dominance > 75) raw += 25
  if (a.stability < 40 && b.stability < 40) raw += 25
  if (a.conflictStyle > 70 && b.conflictStyle > 70) raw += 20
  if (a.attachmentSecurity < 40 && b.attachmentSecurity < 40) raw += 20
  if (Math.abs(a.religiosity - b.religiosity) > 50) raw += 10
  const maxRisk = 25 + 25 + 20 + 20 + 10
  return Math.min(100, Math.max(0, Math.round((raw / maxRisk) * 100)))
}
function calculateEmotionalStability(a: TraitVector, b: TraitVector): number {
  const stabilityScore = (a.stability + b.stability) / 2
  const attachmentScore = (a.attachmentSecurity + b.attachmentSecurity) / 2
  return Math.round((stabilityScore * 0.6) + (attachmentScore * 0.4))
}
function calculateLifeAlignment(a: TraitVector, b: TraitVector): number {
  const ambitionAlignment = 100 - Math.abs(a.ambition - b.ambition)
  const religiosityAlignment = 100 - Math.abs(a.religiosity - b.religiosity)
  return Math.round((ambitionAlignment * 0.5) + (religiosityAlignment * 0.5))
}
function calculateMarriageStability(emotionalStability: number, conflictRisk: number): number {
  return Math.round((emotionalStability * 0.5) + ((100 - conflictRisk) * 0.5))
}
function calculateMarriageReadiness(tests: any[]): number {
  const v = extractTraitVector(tests)
  return Math.round((v.stability * 0.35) + (v.attachmentSecurity * 0.25) + (v.religiosity * 0.2) + (v.empathy * 0.2))
}
function calculateMarriageReadinessFromVector(v: TraitVector): number {
  return Math.round((v.stability * 0.35) + (v.attachmentSecurity * 0.25) + (v.religiosity * 0.2) + (v.empathy * 0.2))
}
function calculateAdvancedFromVectors(a: TraitVector, b: TraitVector) {
  const compatibility = calculateTraitCompatibility(a, b)
  const conflictRisk = calculateConflictRisk(a, b)
  const emotionalStability = calculateEmotionalStability(a, b)
  const lifeAlignment = calculateLifeAlignment(a, b)
  const marriageStability = calculateMarriageStability(emotionalStability, conflictRisk)
  const finalScore = Math.round(
    (compatibility * 0.35) + (lifeAlignment * 0.25) + (emotionalStability * 0.20) + ((100 - conflictRisk) * 0.20)
  )
  return { finalScore, compatibility, conflictRisk, emotionalStability, lifeAlignment, marriageStability }
}
function calculateAdvancedMatchScore(userTests: any[], targetTests: any[]) {
  if (!userTests.length || !targetTests.length) {
    return { finalScore: 50, compatibility: 50, conflictRisk: 50, emotionalStability: 50, lifeAlignment: 50, marriageStability: 50 }
  }
  const a = extractTraitVector(userTests)
  const b = extractTraitVector(targetTests)
  const compatibility = calculateTraitCompatibility(a, b)
  const conflictRisk = calculateConflictRisk(a, b)
  const emotionalStability = calculateEmotionalStability(a, b)
  const lifeAlignment = calculateLifeAlignment(a, b)
  const marriageStability = calculateMarriageStability(emotionalStability, conflictRisk)
  const finalScore = Math.round(
    (compatibility * 0.35) + (lifeAlignment * 0.25) + (emotionalStability * 0.20) + ((100 - conflictRisk) * 0.20)
  )
  return { finalScore, compatibility, conflictRisk, emotionalStability, lifeAlignment, marriageStability }
}
function getDivorceRiskLevel(conflictRisk: number) {
  if (conflictRisk >= 70) return 'High'
  if (conflictRisk >= 40) return 'Moderate'
  return 'Low'
}

// Advanced engine ends

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const allowed = await throttle(`search-code:${userId}`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
        { status: 429 }
      )
    }

    const { uniqueCode, confirmDifferentReligion } = await request.json()

    if (!uniqueCode) {
      return NextResponse.json(
        { error: 'Kode unik wajib diisi' },
        { status: 400 }
      )
    }

    // Get current user's data
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      include: {
      profile: true,
      psychotests: true,
      subscriptions: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
      }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

  // Check subscription: must be active premium (not free) and not expired
  const activeSub = currentUser.subscriptions?.[0] || null
  const now = new Date()
  const isExpired = activeSub?.endDate ? activeSub.endDate < now : false
  const isPremiumActive = !!activeSub && activeSub.isActive && !isExpired && (activeSub.planType?.toLowerCase() !== 'free')
  if (!isPremiumActive) {
    return NextResponse.json(
      { error: 'Fitur khusus Premium. Aktifkan subscription untuk menggunakan pencarian kode unik.' },
      { status: 403 }
    )
  }

  // Find target user by unique code
    const targetUser = await db.user.findUnique({
      where: { uniqueCode: uniqueCode.toUpperCase() },
      include: {
        profile: true,
        psychotests: true
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Pengguna dengan kode unik tersebut tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if trying to match with self
    if (targetUser.id === userId) {
      return NextResponse.json(
        { error: 'Tidak dapat mencocokkan dengan diri sendiri' },
        { status: 400 }
      )
    }

    // Check if target is blocked
    if (targetUser.isBlocked) {
      return NextResponse.json(
        { error: 'Pengguna tersebut sedang diblokir' },
        { status: 403 }
      )
    }

    // 1) Gender check (reject same gender)
    const userGender = normalizeGender(currentUser.profile?.gender)
    const targetGender = normalizeGender(targetUser.profile?.gender)
    if (!userGender || !targetGender) {
      return NextResponse.json(
        { error: 'Data gender belum lengkap' },
        { status: 400 }
      )
    }
    if (userGender === targetGender) {
      return NextResponse.json(
        { error: 'Tidak dapat mencocokkan dengan gender yang sama' },
        { status: 400 }
      )
    }

    // 2) Age check (reject under 18)
    const userAge = currentUser.profile?.age || 0
    const targetAge = (targetUser.profile?.age || 0)
    if (userAge < 18 || targetAge < 18) {
      return NextResponse.json(
        { error: 'Pencarian tidak diizinkan untuk pengguna di bawah 18 tahun' },
        { status: 403 }
      )
    }

    // 3) Religion difference (ask for confirmation first)
    const userReligion = normalizeReligion(currentUser.profile?.religion)
    const targetReligion = normalizeReligion(targetUser.profile?.religion)
    if (userReligion && targetReligion && userReligion !== targetReligion && !confirmDifferentReligion) {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          message: `Pengguna ini berbeda agama dengan Anda (${targetReligion}). Apakah Anda ingin melanjutkan?`,
          targetPreview: {
            id: targetUser.id,
            name: (targetUser.profile?.fullName || targetUser.name) ? 'Tersedia' : 'Tidak tersedia',
            initials: (targetUser.profile?.fullName || targetUser.name || 'U').split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0,2),
            city: targetUser.profile?.city || null
          }
        },
        { status: 200 }
      )
    }

    // Check if match already exists (directional or reverse to avoid duplicates)
    const existingMatch = await db.match.findFirst({
      where: {
        OR: [
          { requesterId: userId, targetId: targetUser.id },
          { requesterId: targetUser.id, targetId: userId }
        ]
      }
    })

    const myVec = (currentUser as any).traitVersion === ENGINE_VERSION && (currentUser as any).traitVector ? (currentUser as any).traitVector as TraitVector : null
    const targetVec = (targetUser as any).traitVersion === ENGINE_VERSION && (targetUser as any).traitVector ? (targetUser as any).traitVector as TraitVector : null
    const result = (myVec && targetVec)
      ? calculateAdvancedFromVectors(myVec, targetVec)
      : calculateAdvancedMatchScore(currentUser.psychotests, targetUser.psychotests)
    const readinessMe = myVec ? calculateMarriageReadinessFromVector(myVec) : calculateMarriageReadiness(currentUser.psychotests)
    const readinessTarget = targetVec ? calculateMarriageReadinessFromVector(targetVec) : calculateMarriageReadiness(targetUser.psychotests)
    const divorceRiskLevel = getDivorceRiskLevel(result.conflictRisk)
    let matchPercentage: number
    if (existingMatch && typeof existingMatch.matchPercentage === 'number') {
      matchPercentage = existingMatch.matchPercentage
    } else {
      matchPercentage = result.finalScore
      const newMatch = await db.match.upsert({
        where: { requesterId_targetId: { requesterId: userId, targetId: targetUser.id } },
        update: {
          matchPercentage: result.finalScore,
          compatibilityScore: result.compatibility,
          conflictRiskScore: result.conflictRisk,
          emotionalStabilityScore: result.emotionalStability,
          lifeAlignmentScore: result.lifeAlignment,
          aiReasoning: null,
          status: 'pending',
          step: 'profile_request',
          matchVersion: ENGINE_VERSION
        },
        create: {
          requesterId: userId,
          targetId: targetUser.id,
          matchPercentage: result.finalScore,
          compatibilityScore: result.compatibility,
          conflictRiskScore: result.conflictRisk,
          emotionalStabilityScore: result.emotionalStability,
          lifeAlignmentScore: result.lifeAlignment,
          aiReasoning: null,
          status: 'pending',
          step: 'profile_request',
          matchVersion: ENGINE_VERSION
        }
      })
      // Notifikasi target (opsional)
      await db.notification.create({
        data: {
          userId: targetUser.id,
          type: 'match_request',
          title: 'Ada yang tertarik dengan Anda!',
          message: `${currentUser.profile?.fullName || currentUser.name} mencoba mencocokkan kode unik Anda.`,
          link: `/dashboard/matches/${newMatch.id}`
        }
      })
      // Fire-and-forget AI reasoning (tanpa blocking request)
      ;(async () => {
        try {
          const zai = await ZAI.create()
          const prompt = `Jelaskan secara singkat mengapa user ini cocok untuk taaruf:
- User A (requester, gender: ${currentUser.profile?.gender}): ${currentUser.profile?.fullName || currentUser.name}
- User B (target, gender: ${targetUser.profile?.gender}): ${targetUser.profile?.fullName || targetUser.name}
- Match percentage: ${matchPercentage.toFixed(0)}%
- B User occupation: ${targetUser.profile?.occupation || 'N/A'}
- B User city: ${targetUser.profile?.city || 'N/A'}
- B User age: ${targetUser.profile?.age || 'N/A'}

Berikan alasan dalam 1-2 kalimat dalam Bahasa Indonesia.`
          const completion = await zai.chat.completions.create({
            messages: [
              { role: 'system', content: 'You are a helpful matchmaker assistant for a taaruf platform.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 150
          })
          const aiReasoning = completion.choices?.[0]?.message?.content || null
          if (aiReasoning) await db.match.update({ where: { id: newMatch.id }, data: { aiReasoning } })
        } catch (e) {
          // swallow errors; do not block the request lifecycle
          console.error('Background AI reasoning failed:', e)
        }
      })()
    }

    ;(async () => {
      try {
        const myVec = extractTraitVector(currentUser.psychotests)
        if ((currentUser as any).traitVersion !== ENGINE_VERSION) {
          await db.user.update({ where: { id: currentUser.id }, data: { traitVector: myVec as any, traitVersion: ENGINE_VERSION, traitUpdatedAt: new Date() } })
        }
        const targetVec = extractTraitVector(targetUser.psychotests)
        if ((targetUser as any).traitVersion !== ENGINE_VERSION) {
          await db.user.update({ where: { id: targetUser.id }, data: { traitVector: targetVec as any, traitVersion: ENGINE_VERSION, traitUpdatedAt: new Date() } })
        }
      } catch {}
    })()

    // Return match result
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    const res = NextResponse.json({
      id: targetUser.id,
      name: targetUser.name || 'Unknown',
      avatar: targetUser.avatar,
      age: targetUser.profile?.age,
      occupation: targetUser.profile?.occupation,
      city: targetUser.profile?.city,
      matchPercentage,
      uniqueCode: targetUser.uniqueCode,
      layers: {
        finalScore: result.finalScore,
        compatibility: result.compatibility,
        conflictRisk: result.conflictRisk,
        emotionalStability: result.emotionalStability,
        lifeAlignment: result.lifeAlignment,
        marriageStability: result.marriageStability,
        readinessMe,
        readinessTarget,
        divorceRiskLevel
      }
    })
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    res.headers.set('X-Request-ID', cid)
    return res

  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Search by code API error:', { error, cid })
    try { logger.record({ type: 'error', action: 'search_by_code', detail: `Search by code API error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mencari pasangan' },
      { status: 500 }
    )
  }
}
