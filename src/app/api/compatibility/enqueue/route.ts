export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { enqueueCompatibilityJob, enqueueCompatibilityRecalc } from '@/lib/compatQueue'
import { db } from '@/lib/db'

function noStoreHeaders(res: NextResponse) {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
}

export async function GET() {
  const res = NextResponse.json({
    ok: true,
    engineVersion: 3,
    capabilities: ['pair', 'recompute'],
  })
  noStoreHeaders(res)
  return res
}

export async function POST(request: NextRequest) {
  const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      noStoreHeaders(res)
      return res
    }

    const allowed = await throttle(`compat:${userId}`, 10, 60_000)
    if (!allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      noStoreHeaders(res)
      return res
    }

    const body = await request.json().catch(() => ({}))
    const mode = (body?.mode as string | undefined) || 'pair'

    if (mode === 'pair') {
      const targetId = body?.targetId as string | undefined
      if (!targetId) {
        const res = NextResponse.json({ error: 'targetId is required for mode=pair' }, { status: 400 })
        noStoreHeaders(res)
        return res
      }
      if (targetId === userId) {
        const res = NextResponse.json({ error: 'Cannot match with self' }, { status: 400 })
        noStoreHeaders(res)
        return res
      }
      const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } })
      if (!target) {
        const res = NextResponse.json({ error: 'Target user not found' }, { status: 404 })
        noStoreHeaders(res)
        return res
      }
      const result = await enqueueCompatibilityJob(userId, targetId)
      const res = NextResponse.json({ success: true, mode, result, correlationId: cid })
      noStoreHeaders(res)
      return res
    }

    if (mode === 'recompute') {
      const result = await enqueueCompatibilityRecalc(userId)
      const res = NextResponse.json({ success: true, mode, result, correlationId: cid })
      noStoreHeaders(res)
      return res
    }

    const res = NextResponse.json({ error: 'Unsupported mode', supported: ['pair', 'recompute'] }, { status: 400 })
    noStoreHeaders(res)
    return res
  } catch (error) {
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    noStoreHeaders(res)
    return res
  }
}

