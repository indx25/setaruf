import { NextResponse } from 'next/server'

export async function GET() {
  const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const res = NextResponse.json(
    {
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      correlationId: cid
    },
    { status: 200 }
  )

  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')

  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')

  return res
}

