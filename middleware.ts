import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const isProd = process.env.NODE_ENV === 'production'
  const self = `'self'`
  const unsafeInline = `'unsafe-inline'`
  const unsafeEval = `'unsafe-eval'`

  const csp = [
    `default-src ${self}`,
    `script-src ${self} ${unsafeInline}${isProd ? '' : ' ' + unsafeEval}`,
    `style-src ${self} ${unsafeInline}`,
    `img-src ${self} data: https:`,
    `font-src ${self} data: https:`,
    `connect-src ${self} https:`,
    `frame-ancestors 'none'`,
    `base-uri ${self}`,
    `form-action ${self}`,
  ].join('; ')

  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), interest-cohort=()')
  if (req.nextUrl.protocol === 'https:') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
