import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true, until: Date.now() + 20_000 })
  res.cookies.set('sa_last', String(Date.now()), {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 20, // seconds
    path: '/',
  })
  return res
}
