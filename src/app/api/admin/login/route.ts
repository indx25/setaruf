export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { throttle } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const xf = request.headers.get('x-forwarded-for') || ''
    const ip = xf.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const allowed = await throttle(`admin-login:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 })
    }
    const { email, password } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })

    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Akses admin ditolak' }, { status: 403 })
    }

    let valid = false
    // Fallback for seeded admin credentials
    if (normalizedEmail === 'admin@setaruf.com' && String(password || '') === 'admin123') {
      valid = true
    } else if (user.password) {
      valid = await bcrypt.compare(String(password || ''), user.password)
    }
    if (!valid) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set('userId', user.id, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 2,
    })
    return res
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Login admin gagal: ${msg}` }, { status: 500 })
  }
}
