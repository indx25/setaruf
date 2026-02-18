import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  // Use Report-Only to avoid breaking dev; tighten in prod if needed
  response.headers.set(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'"
    ].join('; ')
  )

  // Inactivity auto-logout (20s) based on heartbeat cookie
  const sessionToken = request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token')
  if (sessionToken) {
    const isProd = process.env.NODE_ENV === 'production'
    const last = request.cookies.get('sa_last')
    if (!last) {
      return response
    }
    const now = Date.now()
    const lastVal = parseInt(last.value || '0', 10)
    const delta = now - (isNaN(lastVal) ? now : lastVal)
    if (isProd && delta > 20_000) {
      response.cookies.delete('next-auth.session-token')
      response.cookies.delete('__Secure-next-auth.session-token')
      response.cookies.delete('next-auth.csrf-token')
      response.cookies.delete('__Secure-next-auth.csrf-token')
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
