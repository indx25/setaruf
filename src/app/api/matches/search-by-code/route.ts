import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import * as logger from '@/lib/logger'

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

    const { uniqueCode } = await request.json()

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

    // Check if match already exists
    const existingMatch = await db.match.findUnique({
      where: {
        requesterId_targetId: {
          requesterId: userId,
          targetId: targetUser.id
        }
      }
    })

    let matchPercentage: number

    if (existingMatch && existingMatch.matchPercentage) {
      matchPercentage = existingMatch.matchPercentage
    } else {
      // Calculate match percentage
      matchPercentage = calculateMatchPercentage(
        currentUser.psychotests,
        targetUser.psychotests
      )

      // Get AI reasoning
      let aiReasoning = 'Berdasarkan analisis psikotes dan kriteria kecocokan'

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
      } catch (aiError) {
        console.error('AI reasoning error:', aiError)
        // Use default reasoning if AI fails
      }

      // Create match record if it doesn't exist
      if (!existingMatch) {
        await db.match.create({
          data: {
            requesterId: userId,
            targetId: targetUser.id,
            matchPercentage,
            aiReasoning,
            status: 'pending',
            step: 'profile_request'
          }
        })

        // Create notification for target user (optional)
        await db.notification.create({
          data: {
            userId: targetUser.id,
            type: 'match_request',
            title: 'Ada yang tertarik dengan Anda!',
            message: `${currentUser.profile?.fullName || currentUser.name} mencoba mencocokkan kode unik Anda.`,
            link: '/dashboard/matches'
          }
        })
      }
    }

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
      uniqueCode: targetUser.uniqueCode
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
