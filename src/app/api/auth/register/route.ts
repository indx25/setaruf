import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { verifyQuiz } from '@/lib/quiz'
import { isBlocked, recordWrongQuizAttempt } from '@/lib/rate-limit'
import { Resend } from 'resend'

const rateStore = new Map<string, number[]>()
const RATE_LIMIT = 5
const WINDOW_MS = 60_000

function getClientKey(request: NextRequest) {
  const xf = request.headers.get('x-forwarded-for') || ''
  const ip = xf.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `register:${ip}`
}

export async function POST(request: NextRequest) {
  try {
    try {
      await db.$connect()
    } catch {
      return NextResponse.json(
        { error: 'Database tidak dapat diakses. Periksa DATABASE_URL di Vercel.' },
        { status: 500 }
      )
    }
    const { email, password, quiz, dateOfBirth } = await request.json()

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
    const ip = xf.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const rlKey = `quiz:register:${ip}`
    if (await isBlocked(rlKey)) {
      return NextResponse.json(
        { error: 'Terlalu banyak jawaban salah. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const quizResult = await verifyQuiz(quiz)
    if (!quizResult.success) {
      await recordWrongQuizAttempt(rlKey)
      return NextResponse.json(
        { error: quizResult.error || 'Verifikasi keamanan gagal' },
        { status: 400 }
      )
    }

    // Normalisasi email
    const normalizedEmail = String(email).trim().toLowerCase()
    if (!normalizedEmail.endsWith('@gmail.com')) {
      return NextResponse.json(
        { error: 'Harus menggunakan email Gmail untuk mendaftar' },
        { status: 400 }
      )
    }

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

    // Validasi usia minimal 18 tahun
    if (!dateOfBirth) {
      return NextResponse.json(
        { error: 'Tanggal lahir wajib diisi' },
        { status: 400 }
      )
    }
    const dob = new Date(dateOfBirth)
    if (isNaN(dob.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal lahir tidak valid' },
        { status: 400 }
      )
    }
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--
    }
    if (age < 18) {
      return NextResponse.json(
        { error: 'Umur minimal 18 tahun untuk mendaftar' },
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
        email: normalizedEmail,
        password: hashedPassword,
        uniqueCode,
        isBlocked: true,
        workflowStatus: 'biodata',
        profile: {
          create: {
            dateOfBirth: dob,
          }
        }
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

    // Create verification token
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour
    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires
      }
    })
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
    const origin = String(baseUrl).startsWith('http') ? String(baseUrl) : `https://${baseUrl}`
    const verificationUrl = `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(normalizedEmail)}`

    const resendKey = process.env.RESEND_API_KEY || ''
    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const from = process.env.RESEND_FROM || 'onboarding@resend.dev'
        await resend.emails.send({
          from,
          to: normalizedEmail,
          subject: 'Verifikasi Email — Setaruf',
          html: `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f9fafb;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #f1f5f9;overflow:hidden">
      <div style="background:linear-gradient(90deg,#f43f5e,#ec4899);padding:20px 24px;color:#fff;display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700">💗</div>
        <div style="font-size:18px;font-weight:800;letter-spacing:.2px">Setaruf</div>
      </div>
      <div style="padding:24px 24px 8px 24px">
        <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:8px">Verifikasi Email Anda</div>
        <div style="font-size:14px;color:#334155;line-height:1.6">
          Terima kasih telah mendaftar. Klik tombol di bawah untuk mengaktifkan akun Anda dan mulai proses ta’aruf yang terstruktur dan aman.
        </div>
        <div style="margin:18px 0">
          <a href="${verificationUrl}" style="display:inline-block;background:#f43f5e;color:#fff;padding:12px 16px;border-radius:9999px;text-decoration:none;font-weight:600;box-shadow:0 8px 20px rgba(244,63,94,0.25)">Verifikasi Email</a>
        </div>
        <div style="font-size:12px;color:#64748b;line-height:1.6">
          Jika tombol tidak berfungsi, salin tautan berikut ke browser Anda:
          <div style="margin-top:8px;word-break:break-all"><a href="${verificationUrl}" style="color:#ea580c;text-decoration:underline">${verificationUrl}</a></div>
        </div>
      </div>
      <div style="padding:16px 24px 24px 24px">
        <div style="background:#f8fafc;border:1px dashed #e2e8f0;border-radius:12px;padding:12px 14px">
          <div style="font-size:12px;color:#475569">
            Tautan verifikasi berlaku selama 1 jam. Jika butuh bantuan, balas email ini.
          </div>
        </div>
      </div>
      <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f1f5f9">
        <div style="font-size:11px;color:#94a3b8">© Setaruf</div>
      </div>
    </div>
  </body>
</html>
          `,
          text: `Verifikasi Email — Setaruf\n\nKlik: ${verificationUrl}\nTautan berlaku 1 jam.`,
        })
      } catch (e) {
        try { console.warn('RESEND_SEND_ERROR', e) } catch {}
      }
    } else {
      try { console.warn('RESEND_API_KEY missing, falling back to returning verificationUrl in response') } catch {}
    }

    const response = NextResponse.json({
      success: true,
      message: 'Registrasi berhasil. Silakan verifikasi email Anda.',
      verifyRequired: true,
      verificationUrl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    })

    // Sesi akan dikelola oleh NextAuth setelah sign-in di client

    return response

  } catch (error) {
    const raw = error instanceof Error ? (error.message || '') : ''
    const migrationHint =
      /relation .* does not exist/i.test(raw) ||
      /table .* does not exist/i.test(raw) ||
      /no such table/i.test(raw)
        ? 'Database belum dimigrasi di produksi. Jalankan prisma migrate deploy.'
        : ''
    const message = migrationHint || (raw || 'Terjadi kesalahan saat registrasi')
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
