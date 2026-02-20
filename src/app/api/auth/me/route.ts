import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  const res = NextResponse.json({
    user: {
      id: userId,
      name: session?.user?.name || null,
      email: session?.user?.email || null,
      image: (session?.user as any)?.image || null,
    }
  })
  res.headers.set('Cache-Control', 'no-store, private, max-age=0')
  res.headers.set('X-Request-ID', cid)
  return res
}
