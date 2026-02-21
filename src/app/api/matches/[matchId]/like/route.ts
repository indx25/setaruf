export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { ensureIdempotency } from '@/lib/idempotency'

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const idemKey = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idemKey, userId)
    const ok = await throttle(`like:${userId}:${ip || 'na'}`, 20, 60_000)
    if (!ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const matchId = params.matchId
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { requester: true, target: true }
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    if (match.requesterId !== userId && match.targetId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow like after mutual profile view approval
    const isApproved = match.status === 'approved' || match.step === 'profile_viewed' || match.step === 'chatting'
    if (!isApproved) {
      return NextResponse.json({ error: 'Belum melewati approval profil' }, { status: 400 })
    }

    const receiverId = match.requesterId === userId ? match.targetId : match.requesterId
    const isRequester = match.requesterId === userId

    let newStep = match.step
    if (isRequester) {
      if (match.step === 'target_liked') {
        newStep = 'mutual_liked'
      } else {
        newStep = 'requester_liked'
      }
    } else {
      if (match.step === 'requester_liked') {
        newStep = 'mutual_liked'
      } else {
        newStep = 'target_liked'
      }
    }

    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: {
        step: newStep,
        updatedAt: new Date()
      }
    })

    await db.message.create({
      data: {
        senderId: userId,
        receiverId,
        matchId,
        content: 'Saya menyukai profil Anda dan ingin lanjut berkenalan.'
      }
    })

    await db.notification.create({
      data: {
        userId: receiverId,
        type: 'like',
        title: 'Seseorang menyukai profil Anda',
        message: `${match.requesterId === userId ? (match.requester.name || 'Pengguna') : (match.target.name || 'Pengguna')} menyukai profil Anda`,
        link: `/dashboard/matches/${matchId}`
      }
    })

    return NextResponse.json({ success: true, step: updatedMatch.step })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal mengirim suka: ${msg}` }, { status: 500 })
  }
}
