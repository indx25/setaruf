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
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (match.step !== 'profile_viewed' && match.step !== 'full_data_approved' && match.step !== 'chatting') {
      return NextResponse.json({ error: 'Belum dapat memulai chat' }, { status: 400 })
    }

    const activeChats = await db.match.count({
      where: {
        OR: [{ requesterId: userId }, { targetId: userId }],
        step: 'chatting',
        status: { in: ['pending', 'approved', 'chatting'] }
      }
    })
    if (activeChats >= 2 && match.step !== 'chatting') {
      return NextResponse.json({ error: 'Kuota chat aktif habis (maks. 2)' }, { status: 400 })
    }

    const updated = await db.match.update({
      where: { id: matchId },
      data: { step: 'chatting', status: 'chatting' }
    })
    const remaining = Math.max(0, 2 - (activeChats + (match.step === 'chatting' ? 0 : 1)))
    return NextResponse.json({ ok: true, remaining, match: updated })
  } catch (error) {
    console.error('Start chat error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 })
  }
}
