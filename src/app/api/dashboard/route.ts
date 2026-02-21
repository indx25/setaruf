export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'
import { createHash } from 'crypto'

// ===============================
// ADVANCED MARRIAGE INTELLIGENCE ENGINE
// ===============================
const ENGINE_VERSION = 2
const TOP_MATCHES_LIMIT = 50

interface TraitVector {
  dominance: number
  stability: number
  empathy: number
  logic: number
  religiosity: number
  conflictStyle: number
  attachmentSecurity: number
  ambition: number
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 150): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const wait = baseDelayMs * (i + 1)
      await new Promise(res => setTimeout(res, wait))
    }
  }
  throw lastErr
}

function extractTraitVector(tests: any[]): TraitVector {
  const getScore = (type: string) => {
    const t = tests.find(tt => tt.testType === type)
    return typeof t?.score === 'number' ? Math.max(0, Math.min(100, t.score)) : 50
  }
  return {
    dominance: getScore('disc'),
    stability: getScore('clinical'),
    empathy: getScore('pre_marriage'),
    logic: getScore('16pf'),
    religiosity: getScore('pre_marriage'),
    conflictStyle: getScore('disc'),
    attachmentSecurity: getScore('clinical'),
    ambition: getScore('16pf')
  }
}

function calculateTraitCompatibility(a: TraitVector, b: TraitVector): number {
  const weights = {
    dominance: 0.15,
    stability: 0.2,
    empathy: 0.15,
    logic: 0.1,
    religiosity: 0.15,
    conflictStyle: 0.1,
    attachmentSecurity: 0.1,
    ambition: 0.05
  }
  let total = 0
  for (const key in weights) {
    const k = key as keyof TraitVector
    const diff = Math.abs(a[k] - b[k])
    const similarity = 100 - diff
    total += similarity * (weights as any)[key]
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
  const MAX_RISK = 25 + 25 + 20 + 20 + 10
  const normalized = Math.round((raw / MAX_RISK) * 100)
  return Math.min(Math.max(normalized, 0), 100)
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
  const a = extractTraitVector(tests)
  const readiness = (a.stability * 0.35) + (a.attachmentSecurity * 0.25) + (a.religiosity * 0.2) + (a.empathy * 0.2)
  return Math.round(readiness)
}

function cosineSimilarity(a: number[] | TraitVector, b: number[] | TraitVector): number {
  const av = Array.isArray(a) ? a as number[] : Object.values(a as TraitVector) as number[]
  const bv = Array.isArray(b) ? b as number[] : Object.values(b as TraitVector) as number[]
  let dot = 0, na = 0, nb = 0
  const L = Math.min(av.length, bv.length)
  for (let i = 0; i < L; i++) {
    const x = Number(av[i] || 0)
    const y = Number(bv[i] || 0)
    dot += x * y
    na += x * x
    nb += y * y
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1
  return dot / denom
}

function calculateAdvancedFromVectors(a: TraitVector, b: TraitVector) {
  const compatibility = calculateTraitCompatibility(a, b)
  const conflictRisk = calculateConflictRisk(a, b)
  const emotionalStability = calculateEmotionalStability(a, b)
  const lifeAlignment = calculateLifeAlignment(a, b)
  const finalScore =
    (compatibility * 0.35) +
    (lifeAlignment * 0.25) +
    (emotionalStability * 0.20) +
    ((100 - conflictRisk) * 0.20)
  return {
    finalScore: Math.round(finalScore),
    compatibility,
    conflictRisk,
    emotionalStability,
    lifeAlignment
  }
}

function calculateAdvancedMatchScore(userTests: any[], targetTests: any[]) {
  if (!userTests.length || !targetTests.length) {
    return {
      finalScore: 50,
      compatibility: 50,
      conflictRisk: 50,
      emotionalStability: 50,
      lifeAlignment: 50
    }
  }
  const a = extractTraitVector(userTests)
  const b = extractTraitVector(targetTests)
  const compatibility = calculateTraitCompatibility(a, b)
  const conflictRisk = calculateConflictRisk(a, b)
  const emotionalStability = calculateEmotionalStability(a, b)
  const lifeAlignment = calculateLifeAlignment(a, b)
  const marriageStability = calculateMarriageStability(emotionalStability, conflictRisk)
  const finalScore =
    (compatibility * 0.35) +
    (lifeAlignment * 0.25) +
    (emotionalStability * 0.20) +
    ((100 - conflictRisk) * 0.20)
  return {
    finalScore: Math.round(finalScore),
    compatibility,
    conflictRisk,
    emotionalStability,
    lifeAlignment,
    marriageStability
  }
}

function getDivorceRiskLevel(conflictRisk: number) {
  if (conflictRisk >= 70) return 'High'
  if (conflictRisk >= 40) return 'Moderate'
  return 'Low'
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

type EnterpriseTier = 'LOW' | 'MODERATE' | 'HIGH' | 'ELITE'
interface EnterpriseTraitVector { dominance: number; stability: number; empathy: number; openness: number; conscientiousness: number }
interface EnterpriseCompatibilityResult { score: number; reasons: string[]; risks: string[]; forecast: string; tier: EnterpriseTier }
function clampV3(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
function sim(a: number, b: number) { return 100 - Math.abs(a - b) }
function comp(a: number, b: number) { return 100 - Math.abs((a + b) - 100) }
function extractEnterpriseTraitVector(tests: Array<{ testType: string; score: number | null }>): EnterpriseTraitVector {
  const get = (type: string) => {
    const t = tests.find(tt => tt.testType === type)
    return typeof t?.score === 'number' ? clampV3(t.score, 0, 100) : 50
  }
  const disc = get('disc')
  const clinical = get('clinical')
  const pre = get('pre_marriage')
  const pf = get('16pf')
  return {
    dominance: disc,
    stability: clinical,
    empathy: pre,
    openness: pf,
    conscientiousness: Math.round((pf + pre) / 2)
  }
}
function calculateEnterpriseCompatibility(
  me: any,
  other: any,
  meVector: EnterpriseTraitVector,
  otherVector: EnterpriseTraitVector,
  matchPct: number
): EnterpriseCompatibilityResult {
  const reasons: string[] = []
  const risks: string[] = []
  const psychScore = (sim(meVector.empathy, otherVector.empathy) + sim(meVector.stability, otherVector.stability)) / 2
  if (psychScore > 80) reasons.push('Kedewasaan emosional sangat selaras')
  else if (psychScore < 50) risks.push('Potensi perbedaan emosional signifikan')
  const dominanceBalance = comp(meVector.dominance, otherVector.dominance)
  if (dominanceBalance > 75) reasons.push('Keseimbangan kepemimpinan harmonis')
  else if (dominanceBalance < 40) risks.push('Potensi konflik dominasi dalam pengambilan keputusan')
  const longTermIndex = (meVector.stability + otherVector.stability + meVector.conscientiousness + otherVector.conscientiousness) / 4
  if (longTermIndex > 75) reasons.push('Potensi hubungan jangka panjang stabil')
  else if (longTermIndex < 50) risks.push('Risiko inkonsistensi komitmen jangka panjang')
  const finalScore = clampV3(psychScore * 0.25 + dominanceBalance * 0.2 + longTermIndex * 0.2 + matchPct * 0.35, 0, 100)
  let tier: EnterpriseTier
  if (finalScore >= 85) tier = 'ELITE'
  else if (finalScore >= 70) tier = 'HIGH'
  else if (finalScore >= 55) tier = 'MODERATE'
  else tier = 'LOW'
  let forecast: string
  if (tier === 'ELITE') forecast = 'Hubungan ini memiliki fondasi emosional dan karakter yang sangat kuat dengan risiko konflik rendah.'
  else if (tier === 'HIGH') forecast = 'Hubungan ini stabil dengan beberapa area yang perlu komunikasi aktif.'
  else if (tier === 'MODERATE') forecast = 'Hubungan memiliki potensi, namun membutuhkan kesadaran emosional dan kompromi.'
  else forecast = 'Disarankan evaluasi lebih dalam sebelum melanjutkan ke tahap komitmen serius.'
  return { score: Math.round(finalScore), reasons: Array.from(new Set(reasons)), risks: Array.from(new Set(risks)), forecast, tier }
}

function createSecureSeededRandom(seed: string) {
  const hash = createHash('sha256').update(seed).digest()
  const state = new BigUint64Array(4)
  for (let i = 0; i < 4; i++) {
    const base = i * 8
    state[i] =
      (BigInt(hash[base + 0]) << 56n) |
      (BigInt(hash[base + 1]) << 48n) |
      (BigInt(hash[base + 2]) << 40n) |
      (BigInt(hash[base + 3]) << 32n) |
      (BigInt(hash[base + 4]) << 24n) |
      (BigInt(hash[base + 5]) << 16n) |
      (BigInt(hash[base + 6]) << 8n) |
      BigInt(hash[base + 7])
  }
  const MASK = (1n << 64n) - 1n
  const rotl = (x: bigint, k: bigint) => ((x << k) | (x >> (64n - k))) & MASK
  function next(): number {
    const res = Number((rotl((state[1] * 5n) & MASK, 7n) * 9n) & MASK)
    const t = (state[1] << 17n) & MASK
    state[2] ^= state[0]
    state[3] ^= state[1]
    state[1] ^= state[2]
    state[0] ^= state[3]
    state[2] ^= t
    state[3] = rotl(state[3], 45n)
    return res / 2 ** 64
  }
  return {
    random: next,
    randomInt: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    randomFloat: (min: number, max: number) => next() * (max - min) + min
  }
}

function buildHumanInsightAdvanced(meTests: any[], otherTests: any[], metrics: { matchPct: number, compatibility: number, conflictRisk: number, emotionalStability: number, lifeAlignment: number }, seed: string): string {
  const rng = createSecureSeededRandom(seed)
  const diffs: { type: string, diff: number }[] = []
  const get = (t: string) => {
    const a = meTests.find(x => x.testType === t)?.score ?? 50
    const b = otherTests.find(x => x.testType === t)?.score ?? 50
    return { a, b, diff: Math.abs(a - b) }
  }
  const label: Record<string, string> = { pre_marriage: 'visi pra‑nikah', disc: 'gaya komunikasi', clinical: 'stabilitas emosi', '16pf': 'pola pikir' }
  ;['pre_marriage','disc','clinical','16pf'].forEach(t => { const v = get(t); diffs.push({ type: t, diff: v.diff }) })
  const similar = diffs.filter(d => d.diff <= 10).sort((a,b)=>a.diff-b.diff).slice(0, 2).map(d => label[d.type] || d.type)
  const gaps = diffs.filter(d => d.diff >= 20).sort((a,b)=>b.diff-a.diff).slice(0, 2).map(d => label[d.type] || d.type)
  const openers = [
    'Kayaknya kalian gampang nyambung',
    'Feelingnya cocok',
    'Vibenya sejalan',
    'Kelihatannya klik',
    'Potensi nyambungnya bagus'
  ]
  const because = [
    similar.length ? `karena ${similar.join(' & ')}` : 'dilihat dari hasil psikotes',
    similar.length ? `soalnya ${similar.join(' & ')}` : 'dari pola nilai yang mirip',
    similar.length ? `karena ada kemiripan di ${similar.join(' & ')}` : 'dari komposisi skor yang saling melengkapi'
  ]
  const compat = Math.max(0, Math.min(100, Math.round(metrics.compatibility)))
  const align = Math.max(0, Math.min(100, Math.round(metrics.lifeAlignment)))
  const calm = Math.max(0, Math.min(100, Math.round(metrics.emotionalStability)))
  const peace = Math.max(0, Math.min(100, Math.round(100 - metrics.conflictRisk)))
  const challenges: string[] = []
  if (metrics.conflictRisk >= 55) challenges.push('jaga ritme komunikasi biar nggak salah paham')
  if (align < 60) challenges.push('sinkronin prioritas dan jadwal harian')
  if (calm < 60) challenges.push('atur tempo ngobrol saat emosi lagi naik')
  if (gaps.length) challenges.push(`adaptasi di ${gaps.join(' & ')}`)
  const opener = openers[rng.randomInt(0, openers.length - 1)]
  const bc = because[rng.randomInt(0, because.length - 1)]
  const probs = [
    `Peluang nyambung ${compat}%`,
    `Selaras arah ${align}%`,
    `Tenang ${calm}%`,
    `Minim konflik ${peace}%`
  ]
  const head = `${opener}, ${bc}.`
  const tail = challenges.length ? ` Catatan: ${challenges.slice(0,2).join(', ')}.` : ''
  return `${head} ${probs.join(' • ')}.${tail}`
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
    const user = await withRetry(() => db.user.findUnique({
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
    }))

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
    // Opposite gender and same religion setup (no in-memory normalization; rely on DB consistency/indexes)
    const profileGender = user.profile?.gender || null
    const profileReligion = user.profile?.religion || null
    const oppositeGender =
      profileGender === 'male' ? 'female' :
      profileGender === 'female' ? 'male' : null

    // Existing matches (exclude from recommendation)
    const existingMatches = await withRetry(() => db.match.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { targetId: userId }
        ]
      }
    }))
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
            ...(profileReligion ? { religion: { equals: profileReligion, mode: 'insensitive' } } : {}),
            age: { gte: 18 }
          }
        }
      })
      console.log('TOTAL USERS:', totalUsersCount)
      console.log('FILTERED:', filteredUsersCount)
    } catch {}

    // Stage 1 — Narrow candidate pool (indexed filter; take up to 500)
    let candidates = await withRetry(() => db.user.findMany({
      where: {
        id: { not: userId },
        isBlocked: false,
        profile: {
          ...(oppositeGender ? { gender: { equals: oppositeGender, mode: 'insensitive' } } : {}),
          ...(profileReligion ? { religion: { equals: profileReligion, mode: 'insensitive' } } : {}),
          ...(typeof user.profile?.age === 'number'
            ? { age: { gte: Math.max(18, user.profile.age - 5), lte: user.profile.age + 5 } }
            : { age: { gte: 18 } }),
        }
      },
      select: {
        id: true,
        avatar: true,
        traitVector: true,
        traitVersion: true,
        profile: {
          select: { fullName: true, age: true, gender: true, religion: true, city: true, photoUrl: true }
        },
        psychotests: { select: { testType: true, score: true } }
      },
      take: 500
    }))
    if (candidates.length === 0) {
      candidates = await withRetry(() => db.user.findMany({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: {
            ...(oppositeGender ? { gender: { equals: oppositeGender, mode: 'insensitive' } } : {}),
            ...(typeof user.profile?.age === 'number'
              ? { age: { gte: Math.max(18, user.profile.age - 5), lte: user.profile.age + 5 } }
              : { age: { gte: 18 } }),
          }
        },
        select: {
          id: true,
          avatar: true,
          traitVector: true,
          traitVersion: true,
          profile: { select: { fullName: true, age: true, gender: true, religion: true, city: true, photoUrl: true } },
          psychotests: { select: { testType: true, score: true } }
        },
        take: 500
      }))
    }
    if (candidates.length === 0) {
      candidates = await withRetry(() => db.user.findMany({
        where: {
          id: { not: userId },
          isBlocked: false,
          profile: {
            age: { gte: 18 }
          }
        },
        select: {
          id: true,
          avatar: true,
          traitVector: true,
          traitVersion: true,
          profile: { select: { fullName: true, age: true, gender: true, religion: true, city: true, photoUrl: true } },
          psychotests: { select: { testType: true, score: true } }
        },
        take: 500
      }))
    }
    try {
      console.log('FILTERS:', { oppositeGender, religion: profileReligion })
      console.log('ALL USERS (candidates):', candidates.length)
      console.log('CANDIDATE IDS:', candidates.map(c => ({
        id: c.id,
        gender: c.profile?.gender,
        religion: c.profile?.religion
      })))
    } catch {}

    // ===============================
    // STEP 1: GET EXISTING MATCHES
    // ===============================
    let existingMatchesFull = await withRetry(() => db.match.findMany({
      where: {
        requesterId: userId,
        status: { in: ['pending','rejected'] }
      },
      include: {
        target: {
          include: {
            profile: true,
            psychotests: true
          }
        }
      },
      orderBy: { matchPercentage: 'desc' }
    }))
    // ===============================
    // STEP 2: TOP-UP RECOMMENDATIONS IF INSUFFICIENT (Two-Stage Matching)
    // ===============================
    if (existingMatchesFull.length < TOP_MATCHES_LIMIT) {
      const myTests = await db.psychoTest.findMany({ where: { userId } })
      const myVec = ((user as any).traitVector as number[] | TraitVector | null) || extractTraitVector(myTests)
      const taken = new Set(existingMatchesFull.map(m => m.targetId))
      const remainingSlots = Math.max(TOP_MATCHES_LIMIT - existingMatchesFull.length, 0)
      if (remainingSlots > 0) {
        // Stage 1: rank by fast vector similarity
        const ranked = candidates
          .filter(c => !taken.has(c.id))
          .map(c => {
            const cVec = ((c as any).traitVector as number[] | TraitVector | null) || extractTraitVector((c as any).psychotests || [])
            const sim = cosineSimilarity(myVec as any, cVec as any)
            // Convert cosine [-1..1] to [0..100] for ranking convenience
            const fastScore = Math.round(((sim + 1) / 2) * 100)
            return { user: c, cVec, fastScore }
          })
          .sort((a, b) => b.fastScore - a.fastScore)
          .slice(0, remainingSlots * 3) // widen a bit before deep scoring
        // Stage 2: deep compatibility scoring on narrowed set
        const scored = ranked
          .map(item => {
            const result = calculateAdvancedFromVectors(myVec as any, item.cVec as any)
            return { user: item.user, result, score: result.finalScore }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, remainingSlots)
        try { console.log('TOP-UP (adding):', scored.length) } catch {}
        await Promise.all(
          scored.map(s => {
            const r = s.result
            const candidateTests = ((s.user as any).psychotests || []) as Array<{ testType: string; score: number }>
            const aiText = buildHumanInsightAdvanced(
              myTests,
              candidateTests,
              {
                matchPct: r.finalScore,
                compatibility: r.compatibility,
                conflictRisk: r.conflictRisk,
                emotionalStability: r.emotionalStability,
                lifeAlignment: r.lifeAlignment
              },
              `${userId}-${s.user.id}`
            )
            return db.match.upsert({
              where: { requesterId_targetId: { requesterId: userId, targetId: s.user.id } },
              update: {
                matchPercentage: r.finalScore,
                compatibilityScore: r.compatibility,
                conflictRiskScore: r.conflictRisk,
                emotionalStabilityScore: r.emotionalStability,
                lifeAlignmentScore: r.lifeAlignment,
                aiReasoning: aiText,
                matchVersion: ENGINE_VERSION
              },
              create: {
                requesterId: userId,
                targetId: s.user.id,
                matchPercentage: r.finalScore,
                compatibilityScore: r.compatibility,
                conflictRiskScore: r.conflictRisk,
                emotionalStabilityScore: r.emotionalStability,
                lifeAlignmentScore: r.lifeAlignment,
                aiReasoning: aiText,
                status: 'pending',
                step: 'suggested',
                matchVersion: ENGINE_VERSION
              }
            })
          })
        )
        existingMatchesFull = await withRetry(() => db.match.findMany({
          where: {
            requesterId: userId,
            status: { in: ['pending','rejected'] }
          },
          include: {
            target: {
              include: {
                profile: true,
                psychotests: true
              }
            }
          },
          orderBy: { matchPercentage: 'desc' }
        }))
      }
    }
    try {
      const diffs = existingMatchesFull.map(m => {
        const expected = calculateAdvancedMatchScore(psychotests, (m as any).target?.psychotests || [])
        return {
          id: m.id,
          requesterId: m.requesterId,
          targetId: m.targetId,
          stored: m.matchPercentage ?? null,
          expected: expected.finalScore,
          delta: (typeof m.matchPercentage === 'number') ? Math.round((expected.finalScore - m.matchPercentage) * 100) / 100 : null,
          version: (m as any).matchVersion ?? null
        }
      })
      console.log('MATCH PCT CHECK:', diffs)
    } catch {}

    // Auto-refresh stale matches (version drift or large delta)
    try {
      const updates = existingMatchesFull
        .filter(m => {
          const expected = calculateAdvancedMatchScore(psychotests, (m as any).target?.psychotests || [])
          const delta = (typeof m.matchPercentage === 'number') ? Math.abs(expected.finalScore - (m.matchPercentage || 0)) : 999
          const version = (m as any).matchVersion ?? 1
          return version !== ENGINE_VERSION || delta >= 5
        })
        .map(async m => {
          const expected = calculateAdvancedMatchScore(psychotests, (m as any).target?.psychotests || [])
          await db.match.update({
            where: { id: m.id },
            data: {
              matchPercentage: expected.finalScore,
              compatibilityScore: expected.compatibility,
              conflictRiskScore: expected.conflictRisk,
              emotionalStabilityScore: expected.emotionalStability,
              lifeAlignmentScore: expected.lifeAlignment,
              matchVersion: ENGINE_VERSION
            }
          })
        })
      await Promise.all(updates)
      if (updates.length) {
        existingMatchesFull = await db.match.findMany({
          where: { requesterId: userId, status: { in: ['pending','rejected'] } },
          include: { target: { include: { profile: true, psychotests: true } } },
          orderBy: { matchPercentage: 'desc' }
        })
      }
    } catch {}
    // ===============================
    // FORMAT HASIL
    // ===============================
    let formattedMatches = existingMatchesFull.map(match => {
      const cand = match.target as any
      const meTests = psychotests.map(t => ({ testType: t.testType, score: t.score || 0, result: t.result || '' }))
      const otherTests = (cand.psychotests || []).map((t: any) => ({ testType: t.testType, score: t.score || 0, result: t.result || '' }))
      const expected = calculateAdvancedMatchScore(meTests, otherTests)
      const emotional = (match as any).emotionalStabilityScore ?? expected.emotionalStability
      const conflict = (match as any).conflictRiskScore ?? expected.conflictRisk
      const marriageStability = calculateMarriageStability(emotional, conflict)
      const readinessMe = calculateMarriageReadiness(meTests)
      const readinessTarget = calculateMarriageReadiness(otherTests)
      const displayName = cand.profile?.fullName || cand.name || 'Unknown'
      const seed = `${user.id}-${cand.id}-${match.id}`
      return {
        id: match.id,
        targetId: cand.id,
        targetName: displayName,
        targetInitials: getInitials(displayName || ''),
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
        aiInsight: buildHumanInsightAdvanced(meTests, otherTests, {
          matchPct: match.matchPercentage || 0,
          compatibility: (match as any).compatibilityScore ?? expected.compatibility,
          conflictRisk: (match as any).conflictRiskScore ?? expected.conflictRisk,
          emotionalStability: (match as any).emotionalStabilityScore ?? expected.emotionalStability,
          lifeAlignment: (match as any).lifeAlignmentScore ?? expected.lifeAlignment
        }, seed),
        enterprise: (() => {
          const meV = extractEnterpriseTraitVector(meTests)
          const otV = extractEnterpriseTraitVector(otherTests)
          const m = match.matchPercentage || expected.finalScore
          return calculateEnterpriseCompatibility({ profile: user.profile }, { profile: cand.profile }, meV, otV, m || 0)
        })(),
        matchStatus: match.status,
        matchStep: match.step,
        divorceRiskLevel: getDivorceRiskLevel((match as any).conflictRiskScore ?? expected.conflictRisk),
        marriageStability,
        readinessMe,
        readinessTarget
      }
    })
    const beforeFilterCount = formattedMatches.length

    const myGender2 = user.profile?.gender || null
    const myReligion2 = user.profile?.religion || null
    const passesDefault = (m: any) => {
      const okAdult = (m.targetAge ?? 0) >= 18
      const tg = m.targetGender
      const tr = m.targetReligion
      const okGender = myGender2 ? (tg != null ? tg !== myGender2 : false) : true
      const okReligion = myReligion2 ? (tr != null ? tr === myReligion2 : false) : true
      return okAdult && okGender && okReligion
    }

    formattedMatches = formattedMatches.filter(passesDefault)
    try {
      console.log('FORMATTED_BEFORE_FILTER:', beforeFilterCount)
      console.log('FORMATTED_AFTER_FILTER:', formattedMatches.length)
    } catch {}

    // Persist AI insight for weighted top-50 candidates (fire-and-forget)
    ;(async () => {
      try {
        const topSorted = [...formattedMatches].sort((a: any, b: any) => (b.matchPercentage || 0) - (a.matchPercentage || 0)).slice(0, 50)
        const totalWeight = topSorted.reduce((sum: number, _m: any, idx: number) => sum + (50 - idx), 0)
        let acc = 0
        const pick = (r: number) => {
          let t = 0
          for (let i = 0; i < topSorted.length; i++) {
            t += (50 - i) / totalWeight
            if (r <= t) return i
          }
          return topSorted.length - 1
        }
        const chosenIdx = new Set<number>()
        // choose up to 20 distinct indices with weighted prob for variety
        while (chosenIdx.size < Math.min(20, topSorted.length)) {
          const r = Math.random()
          chosenIdx.add(pick(r))
        }
        const chosen = Array.from(chosenIdx).map(i => topSorted[i])
        await Promise.all(
          chosen.map(async (m: any) => {
            try {
              await db.match.update({
                where: { id: m.id },
                data: { aiReasoning: m.aiInsight }
              })
            } catch (e) {
              try { logger.error?.('AI insight persist error', e) } catch {}
            }
          })
        )
      } catch (e) {
        try { logger.error?.('Weighted top-50 insight error', e) } catch {}
      }
    })()

    // Background persist trait vectors (current user + top candidates)
    ;(async () => {
      try {
        const myVec = extractTraitVector(psychotests)
        if ((user as any).traitVersion !== ENGINE_VERSION) {
          await db.user.update({
            where: { id: userId },
            data: { traitVector: myVec as any, traitVersion: ENGINE_VERSION, traitUpdatedAt: new Date() }
          })
        }
        const topTargets = existingMatchesFull.slice(0, 10).map((m: any) => m.target)
        await Promise.all(topTargets.map(async (t: any) => {
          if (!t) return
          if ((t as any).traitVersion !== ENGINE_VERSION) {
            const vec = extractTraitVector((t.psychotests || []).map((x: any) => ({ testType: x.testType, score: x.score })))
            await db.user.update({
              where: { id: t.id },
              data: { traitVector: vec as any, traitVersion: ENGINE_VERSION, traitUpdatedAt: new Date() }
            })
          }
        }))
      } catch {}
    })()

    // Fetch advertisements
    const now = new Date()
    const advertisements = await withRetry(() => db.advertisement.findMany({
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
    }))

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
