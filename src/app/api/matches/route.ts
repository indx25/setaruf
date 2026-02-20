import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import * as logger from '@/lib/logger'

function normalizeGender(s?: string | null): string | null {
  const t = (s || '').toLowerCase()
  if (!t) return null
  if (/^(male|pria|laki|cowok|laki-laki)$/i.test(t)) return 'male'
  if (/^(female|wanita|perempuan|cewek)$/i.test(t)) return 'female'
  return t
}

function normalizeReligion(s?: string | null): string | null {
  const t = (s || '').toLowerCase()
  if (!t) return null
  if (/^islam$/i.test(t) || /^moslem$/i.test(t) || /^muslim$/i.test(t)) return 'islam'
  if (/^kristen$/i.test(t) || /^protestan$/i.test(t)) return 'kristen'
  if (/^katolik$/i.test(t) || /^catholic$/i.test(t)) return 'katolik'
  return t
}

// Helper function to calculate match percentage based on psychotest scores
function calculateMatchPercentage(
  userPsychotests: any[],
  targetPsychotests: any[]
): number {
  if (!userPsychotests.length || !targetPsychotests.length) {
    return Math.random() * 40 + 30 // Random 30-70% if no tests
  }

  let totalScore = 0
  let count = 0

  const testTypes = ['pre_marriage', 'disc', 'clinical', '16pf']

  for (const testType of testTypes) {
    const userTest = userPsychotests.find(t => t.testType === testType)
    const targetTest = targetPsychotests.find(t => t.testType === testType)

    if (userTest && targetTest && userTest.score && targetTest.score) {
      // Calculate similarity: lower difference = higher match
      const difference = Math.abs(userTest.score - targetTest.score)
      const similarity = 100 - difference
      totalScore += similarity
      count++
    }
  }

  if (count === 0) {
    return Math.random() * 40 + 30 // Random 30-70%
  }

  // Add some randomness to simulate AI reasoning
  const baseScore = totalScore / count
  const aiVariation = (Math.random() - 0.5) * 20 // ±10% variation
  let finalScore = baseScore + aiVariation

  // Ensure score is between 0 and 100
  finalScore = Math.max(0, Math.min(100, finalScore))

  return Math.round(finalScore * 100) / 100
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const allowed = await throttle(`matches:get:${userId}`, 6, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
        { status: 429 }
      )
    }

    // Get current user's data
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        psychotests: true
      }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user's gender preference (opposite gender for matching)
  const userGender = normalizeGender(currentUser.profile?.gender) || null
  const targetGender = userGender === 'male' ? 'female' : 'female' === userGender ? 'male' : null

    // Get existing matches to avoid duplicates
    const existingMatches = await db.match.findMany({
      where: { requesterId: userId },
      select: { targetId: true }
    })
    const existingTargetIds = new Set(existingMatches.map(m => m.targetId))

    // Find potential matches (opposite gender, not blocked, not self)
    const potentialMatches = await db.user.findMany({
      where: {
        id: { not: userId },
        isBlocked: false,
        profile: {
        ...(targetGender ? { gender: { equals: targetGender, mode: 'insensitive' } } : {}),
        ...(currentUser.profile?.religion ? { religion: { equals: normalizeReligion(currentUser.profile?.religion)!, mode: 'insensitive' } } : {})
        }
      },
      include: {
        profile: true,
        psychotests: true
      },
      take: 20
    })

    // Calculate match percentages and filter
    const matches = []
    for (const target of potentialMatches) {
      // Skip if already matched
      if (existingTargetIds.has(target.id)) {
        continue
      }

      // Calculate match percentage
      const matchPercentage = calculateMatchPercentage(
        currentUser.psychotests,
        target.psychotests
      )

      // Only include if match percentage is decent (> 40%)
      if (matchPercentage >= 40) {
        matches.push({
          targetId: target.id,
          matchPercentage
        })
      }
    }

    // Sort by match percentage and take top 10
    matches.sort((a, b) => b.matchPercentage - a.matchPercentage)
    const topMatches = matches.slice(0, 10)

    // Create or update match records
    const results = []
    for (const match of topMatches) {
      // Check if match already exists
      const existingMatch = await db.match.findUnique({
        where: {
          requesterId_targetId: {
            requesterId: userId,
            targetId: match.targetId
          }
        }
      })

      if (!existingMatch) {
        // Get AI reasoning (optional - using simple logic for now)
        let aiReasoning = 'Berdasarkan analisis psikotes dan kriteria kecocokan'

        // If AI SDK is available, try to get reasoning
        try {
          const zai = await ZAI.create()
          const targetUser = potentialMatches.find(p => p.id === match.targetId)

          if (targetUser && targetUser.profile) {
            const prompt = `Jelaskan secara singkat mengapa user ini cocok untuk taaruf:
- User A (gender: ${userGender}): ${currentUser.profile.fullName || currentUser.name}
- User B (gender: ${targetGender}): ${targetUser.profile.fullName || targetUser.name}
- Match percentage: ${match.matchPercentage.toFixed(0)}%
- B User occupation: ${targetUser.profile.occupation || 'N/A'}
- B User city: ${targetUser.profile.city || 'N/A'}

Berikan alasan dalam 1-2 kalimat dalam Bahasa Indonesia.`

            const completion = await zai.chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful matchmaker assistant for a taaruf platform.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 150
            })

            aiReasoning = completion.choices[0]?.message?.content || aiReasoning
          }
        } catch (aiError) {
          console.error('AI reasoning error:', aiError)
          // Use default reasoning if AI fails
        }

        // Create match record
        const newMatch = await db.match.create({
          data: {
            requesterId: userId,
            targetId: match.targetId,
            matchPercentage: match.matchPercentage,
            aiReasoning,
            status: 'pending',
            step: 'profile_request'
          }
        })

        // Get target user details
        const targetUser = await db.user.findUnique({
          where: { id: match.targetId },
          include: { profile: true }
        })

        if (targetUser) {
          const getInitials = (name?: string | null) => {
            if (!name) return ''
            return name.split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0, 2)
          }
          results.push({
            id: newMatch.id,
            targetId: targetUser.id,
            targetName: targetUser.name || 'Unknown',
            targetInitials: getInitials(targetUser.name || ''),
            targetAvatar: targetUser.avatar,
            targetAge: targetUser.profile?.age,
            targetOccupation: targetUser.profile?.occupation,
            targetCity: targetUser.profile?.city,
            matchPercentage: match.matchPercentage
          })
        }
      }
    }

    // Also return existing matches
    const existingMatchesData = await db.match.findMany({
      where: {
        requesterId: userId,
        targetId: { not: userId },
        status: { in: ['pending', 'approved'] }
      },
      include: {
        target: {
          include: { profile: true }
        }
      },
      orderBy: { matchPercentage: 'desc' },
      take: 10
    })

    const getInitials2 = (name?: string | null) => {
      if (!name) return ''
      return name.split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0, 2)
    }
    const formattedExistingMatches = existingMatchesData.map(match => ({
      id: match.id,
      targetId: match.targetId,
      targetName: match.target.name || 'Unknown',
      targetInitials: getInitials2(match.target.name || ''),
      targetAvatar: match.target.avatar,
      targetAge: match.target.profile?.age,
      targetOccupation: match.target.profile?.occupation,
      targetCity: match.target.profile?.city,
      matchPercentage: match.matchPercentage || 0
    }))

    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    const res = NextResponse.json({
      matches: formattedExistingMatches,
      newMatches: results
    })
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    res.headers.set('X-Request-ID', cid)
    return res

  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Matches API error:', { error, cid })
    try { logger.record({ type: 'error', action: 'matches_get', detail: `Matches API error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil rekomendasi' },
      { status: 500 }
    )
  }
}
