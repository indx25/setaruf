import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { verifyQuiz } from '@/lib/quiz'
import { isBlocked, recordWrongQuizAttempt } from '@/lib/rate-limit'

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
    const { email, password, quiz } = await request.json()

    // Validasi input
    if (!email || !password) {
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

    const xf = request.headers.get('x-forwarded-for') || ''
    const ip = request.ip || xf.split(',')[0]?.trim() || 'unknown'
    const rlKey = `quiz:register:${ip}`
    if (isBlocked(rlKey)) {
      return NextResponse.json(
        { error: 'Terlalu banyak jawaban salah. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const quizResult = await verifyQuiz(quiz)
    if (!quizResult.success) {
      recordWrongQuizAttempt(rlKey)
      return NextResponse.json(
        { error: quizResult.error || 'Verifikasi keamanan gagal' },
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

    // Catatan: validasi usia dihapus sesuai perubahan form signup

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
        email: normalizedEmail,
        password: hashedPassword,
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

    // Sesi akan dikelola oleh NextAuth setelah sign-in di client

    return response

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    )
  }
}
