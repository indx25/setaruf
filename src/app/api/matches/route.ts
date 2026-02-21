import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function calculateMarriageStability(emotionalStability: number, conflictRisk: number): number {
  return Math.round((emotionalStability * 0.5) + ((100 - conflictRisk) * 0.5))
}
function getDivorceRiskLevel(conflictRisk: number) {
  if (conflictRisk >= 70) return 'High'
  if (conflictRisk >= 40) return 'Moderate'
  return 'Low'
}
function buildAIInsightSimple(scores: { comp?: number | null, align?: number | null, calm?: number | null, risk?: number | null }): string {
  const c = Math.round(scores.comp ?? 70)
  const a = Math.round(scores.align ?? 70)
  const e = Math.round(scores.calm ?? 70)
  const r = Math.round(scores.risk ?? 30)
  const peace = Math.max(0, Math.min(100, 100 - r))
  return `Kayaknya kalian gampang nyambung, dari komposisi skor yang saling melengkapi. Peluang nyambung ${c}% • Selaras arah ${a}% • Tenang ${e}% • Minim konflik ${peace}%.`
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
  }
  return map[t] || null
}

function getDerivedOccupation(profile: any) {
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30))
    const ageMin = parseInt(searchParams.get('ageMin') || '', 10)
    const ageMax = parseInt(searchParams.get('ageMax') || '', 10)
    const city = (searchParams.get('city') || '').trim()
    const minMatchParam = searchParams.get('minMatch') || 'any'
    const minMatch = minMatchParam === 'any' ? undefined : (parseInt(minMatchParam, 10) || 0)

    const where: any = {
      requesterId: userId,
      status: 'pending',
      ...(typeof minMatch === 'number' ? { matchPercentage: { gte: minMatch } } : {}),
      ...(ageMin || ageMax || city
        ? {
            target: {
              profile: {
                ...(ageMin ? { age: { gte: ageMin } } : {}),
                ...(ageMax ? { age: { ...(ageMin ? { gte: ageMin } : {}), lte: ageMax } } : {}),
                ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
              },
            },
          }
        : {}),
    }

    const itemsRaw = await db.match.findMany({
      where,
      include: {
        target: { include: { profile: true } },
      },
      orderBy: { matchPercentage: 'desc' },
      skip: page * limit,
      take: limit,
    })

    const items = itemsRaw.map((match) => {
      const cand = match.target as any
      const displayName = cand?.profile?.fullName || cand?.name || 'Unknown'
      const comp = (match as any).compatibilityScore ?? null
      const risk = (match as any).conflictRiskScore ?? null
      const calm = (match as any).emotionalStabilityScore ?? null
      const align = (match as any).lifeAlignmentScore ?? null
      const aiInsight = (match as any).aiReasoning || buildAIInsightSimple({ comp, align, calm, risk })
      const marriageStability = calculateMarriageStability(Math.round(calm ?? 70), Math.round(risk ?? 30))
      const divorceRiskLevel = getDivorceRiskLevel(Math.round(risk ?? 30))
      return {
        id: match.id,
        targetId: cand?.id,
        targetName: displayName,
        targetAvatar: cand?.avatar || null,
        targetAge: cand?.profile?.age ?? null,
        targetGender: normalizeGender(cand?.profile?.gender),
        targetReligion: normalizeReligion(cand?.profile?.religion),
        targetOccupation: getDerivedOccupation(cand?.profile),
        targetWhatsapp: cand?.profile?.whatsapp || null,
        targetInstagram: cand?.profile?.instagram || null,
        targetCity: cand?.profile?.city || null,
        targetQuote: cand?.profile?.quote || null,
        matchPercentage: match.matchPercentage ?? 0,
        aiInsight,
        divorceRiskLevel,
        marriageStability,
        matchStatus: match.status,
        matchStep: (match as any).step ?? null,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Matches API error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat matches' }, { status: 500 })
  }
}
