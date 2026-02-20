export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Resend } from 'resend'

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const adminUserId = (session?.user as any)?.id as string | undefined
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = await db.user.findUnique({ where: { id: adminUserId } })
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { userId } = params
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!user.isBlocked) return NextResponse.json({ success: true, message: 'Email sudah terverifikasi' })

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
          subject: 'Verifikasi Email — Setaruf (Resend)',
          html: `<p>Silakan verifikasi email Anda dengan klik tautan berikut:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
          text: `Verifikasi Email: ${verificationUrl}`
        })
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: 'Tautan verifikasi telah dikirim ulang',
      verificationUrl
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal mengirim ulang verifikasi: ${msg}` }, { status: 500 })
  }
}
