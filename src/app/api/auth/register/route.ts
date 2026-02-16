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
  return `register:${ip}`
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, dateOfBirth, recaptchaToken } = await request.json()

    // Validasi input
    if (!name || !email || !password || !dateOfBirth) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi' },
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

    const pwd = String(password)
    const strongPwd =
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[^A-Za-z0-9]/.test(pwd)
    if (!strongPwd) {
      return NextResponse.json(
        { error: 'Password wajib minimal 8 karakter dan kombinasi huruf besar, kecil, angka, dan simbol' },
        { status: 400 }
      )
    }

    // Validasi usia (minimal 17 tahun)
    const dob = new Date(dateOfBirth)
    const today = new Date()
    const age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    let actualAge = age
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      actualAge = age - 1
    }

    if (actualAge < 17) {
      return NextResponse.json(
        { error: 'Maaf, usia minimal 17 tahun untuk mendaftar' },
        { status: 400 }
      )
    }

    // Cek apakah email sudah terdaftar
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate unique code
    const uniqueCode = `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Buat user baru
    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        dateOfBirth: dob,
        uniqueCode,
        isBlocked: false,
        workflowStatus: 'biodata',
      }
    })

    // Buat subscription free 1 bulan pertama
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    await db.subscription.create({
      data: {
        userId: user.id,
        planType: 'free',
        amount: 0,
        duration: 1,
        startDate,
        endDate,
        isActive: true,
        isTrial: true,
      }
    })

    // Buat notifikasi selamat datang
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'welcome',
        title: 'Selamat Datang di Setaruf!',
        message: 'Silakan lengkapi biodata Anda untuk memulai perjalanan taaruf.',
        link: '/dashboard/profile'
      }
    })

    const response = NextResponse.json({
      success: true,
      message: 'Registrasi berhasil',
      redirectTo: '/dashboard/profile',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    })

    // Set cookie sesi seperti proses login
    response.cookies.set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })

    return response

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    )
  }
}
