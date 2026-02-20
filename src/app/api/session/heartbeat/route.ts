import { NextResponse } from 'next/server'

export async function GET() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store, private, max-age=0')
  return res
}

