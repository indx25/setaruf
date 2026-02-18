export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const res = NextResponse.json({ ok: true, time: Date.now() })
  res.cookies.set('ping', '1', { path: '/', httpOnly: false })
  return res
}
