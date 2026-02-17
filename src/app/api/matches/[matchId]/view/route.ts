import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { matchId } = params
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { requester: { include: { profile: true } }, target: { include: { profile: true } } }
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isRequester = match.requesterId === userId
    const other = isRequester ? match.target : match.requester
    const me = isRequester ? match.requester : match.target
    if (me.profile?.religion && other.profile?.religion && me.profile.religion !== other.profile.religion) {
      return NextResponse.json({ error: 'Agama berbeda, tidak dapat melihat profil' }, { status: 400 })
    }

    const activeViews = await db.match.count({
      where: {
        requesterId: userId,
        status: { in: ['pending', 'approved'] },
        step: 'profile_viewed'
      }
    })
    if (activeViews >= 5 && match.step !== 'profile_viewed') {
      return NextResponse.json({ error: 'Kuota melihat profil habis (maks. 5 aktif)' }, { status: 400 })
    }

    const updated = await db.match.update({
      where: { id: matchId },
      data: {
        step: 'profile_viewed',
        requesterViewed: isRequester ? true : match.requesterViewed,
        targetViewed: !isRequester ? true : match.targetViewed
      }
    })

    const remaining = Math.max(0, 5 - (activeViews + (match.step === 'profile_viewed' ? 0 : 1)))
    return NextResponse.json({ ok: true, remaining, match: updated })
  } catch (error) {
    console.error('View profile error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 })
  }
}
