export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const email = (searchParams.get('email') || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email diperlukan' }, { status: 400 })

    const user = await db.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

    const normalizedEmail = String(user.email).trim().toLowerCase()
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const expires = new Date(Date.now() + 1000 * 60 * 60)
    await db.verificationToken.create({
      data: { identifier: normalizedEmail, token, expires }
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
          subject: 'Verifikasi Email — Setaruf (Dev)',
          html: `<p>Silakan verifikasi email Anda dengan klik tautan berikut:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
          text: `Verifikasi Email: ${verificationUrl}`
        })
      } catch {}
    }

    return NextResponse.json({ success: true, verificationUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal mengirim verifikasi: ${msg}` }, { status: 500 })
  }
}
