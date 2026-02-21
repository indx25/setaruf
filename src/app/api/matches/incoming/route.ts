import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'

const PAGE_SIZE = 20

async function rateLimitUser(userId: string) {
  const ok = await throttle(`incoming:${userId}`, 60, 60_000)
  if (!ok) throw new Error('RATE_LIMIT')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await rateLimitUser(userId)

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')

    const matches = await db.match.findMany({
      where: { targetId: userId, status: { in: ['pending', 'approved'] } },
      orderBy: { updatedAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        status: true,
        step: true,
        matchPercentage: true,
        updatedAt: true,
        requester: {
          select: {
            id: true,
            name: true,
            avatar: true,
            profile: {
              select: {
                fullName: true,
                age: true,
                gender: true,
                religion: true,
                occupation: true,
                city: true,
                quote: true
              }
            }
          }
        }
      }
    })

    const hasNextPage = matches.length > PAGE_SIZE
    const data = hasNextPage ? matches.slice(0, -1) : matches
    const nextCursor = hasNextPage ? data[data.length - 1].id : null

    const items = data.map((match) => {
      const cand = match.requester as any
      return {
        id: match.id,
        targetId: cand?.id,
        targetName: cand?.profile?.fullName || cand?.name || 'Unknown',
        targetAvatar: cand?.avatar || null,
        targetAge: cand?.profile?.age ?? null,
        targetGender: cand?.profile?.gender ?? null,
        targetReligion: cand?.profile?.religion ?? null,
        targetOccupation: cand?.profile?.occupation || null,
        targetCity: cand?.profile?.city || null,
        targetQuote: cand?.profile?.quote || null,
        matchPercentage: match.matchPercentage ?? 0,
        matchStatus: match.status,
        matchStep: (match as any).step ?? null,
        isIncoming: true,
      }
    })

    const response = NextResponse.json({ items, nextCursor })
    response.headers.set('Cache-Control', 'private, max-age=5')
    return response
  } catch (error) {
    console.error('Incoming matches API error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat permintaan masuk' }, { status: 500 })
  }
}
