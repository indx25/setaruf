import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { verifyRecaptchaToken } from '@/lib/recaptcha'

const rateStore = new Map<string, number[]>()
const RATE_LIMIT = 5
const WINDOW_MS = 60_000

function getClientKey(request: NextRequest) {
  const xf = request.headers.get('x-forwarded-for') || ''
  const ip = request.ip || xf.split(',')[0]?.trim() || 'unknown'
  return `login:${ip}`
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, recaptchaToken } = await request.json()

    // Validasi input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    const key = getClientKey(request)
    const now = Date.now()
    const timestamps = (rateStore.get(key) || []).filter(t => now - t < WINDOW_MS)
    if (timestamps.length >= RATE_LIMIT) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429 }
      )
    }
    timestamps.push(now)
    rateStore.set(key, timestamps)

    // Verifikasi reCAPTCHA
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken || '')
    if (!recaptchaResult.success) {
      return NextResponse.json(
        { error: recaptchaResult.error || 'Verifikasi keamanan gagal' },
        { status: 400 }
      )
    }

    // Normalisasi email
    const normalizedEmail = String(email).trim().toLowerCase()

    // Cari user berdasarkan email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        profile: true,
        subscriptions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Cek apakah user diblokir
    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Akun Anda telah diblokir' },
        { status: 403 }
      )
    }

    // Verifikasi password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Tentukan redirect berdasarkan workflow status
    let redirectTo = '/dashboard'

    switch (user.workflowStatus) {
      case 'biodata':
        redirectTo = '/dashboard/profile'
        break
      case 'psychotest':
        redirectTo = '/dashboard/psychotest'
        break
      case 'matching':
        redirectTo = '/dashboard'
        break
      case 'view_profile':
        redirectTo = '/dashboard'
        break
      case 'getting_to_know':
        redirectTo = '/dashboard'
        break
      default:
        redirectTo = '/dashboard'
    }

    // Set user session (simplified, in production use proper auth like NextAuth)
    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      redirectTo,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        workflowStatus: user.workflowStatus,
        hasProfile: !!user.profile,
      }
    })

    // Set cookie for session (simplified)
    response.cookies.set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login' },
      { status: 500 }
    )
  }
}
