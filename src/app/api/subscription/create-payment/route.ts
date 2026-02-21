export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { ensureIdempotency } from '@/lib/idempotency'

export async function POST(request: NextRequest) {
  const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  try {
    let preferredBank: string | undefined
    try {
      const body = await request.json()
      if (body && typeof body.preferredBank === 'string') {
        preferredBank = body.preferredBank.toUpperCase()
      }
    } catch {}
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const idemKey = request.headers.get('x-idempotency-key')
    await ensureIdempotency(idemKey, userId)
    const ok = await throttle(`create-payment:${userId}:${ip || 'na'}`, 5, 60_000)
    if (!ok) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    // Extra safe: prevent spamming new payments within 30s (DB-backed)
    const lastPayment = await db.payment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    if (lastPayment && Date.now() - new Date(lastPayment.createdAt).getTime() < 30_000) {
      return NextResponse.json({ error: 'Terlalu cepat membuat payment baru' }, { status: 429 })
    }

    const payment = await db.$transaction(async (tx) => {
      // Strong check for existing pending payment
      const pending = await tx.payment.findFirst({
        where: { userId, status: 'pending' }
      })
      if (pending) return pending

      // Collision-safe unique code based on resulting amount (base + code)
      const baseAmount = 50_000
      let uniqueCode: number = 0
      let totalAmount: number = 0
      for (let i = 0; i < 100; i++) {
        uniqueCode = Math.floor(Math.random() * 900) + 100
        totalAmount = baseAmount + uniqueCode
        const exists = await tx.payment.findFirst({
          where: { amount: totalAmount, status: 'pending' }
        })
        if (!exists) break
        if (i === 99) throw new Error('UNIQUE_CODE_EXHAUSTED')
      }

      // Future-ready 6 bank support
      const banks = [
        { name: 'BCA', number: '1084421955', method: 'transfer_bca' },
        { name: 'MANDIRI', number: '1234567890', method: 'transfer_mandiri' },
        { name: 'BRI', number: '9876543210', method: 'transfer_bri' },
        { name: 'BNI', number: '1112223334', method: 'transfer_bni' },
        { name: 'OCBC', number: '4445556667', method: 'transfer_ocbc' },
        { name: 'SINARMAS', number: '7778889990', method: 'transfer_sinarmas' }
      ]
      const map: Record<string, number> = {
        'BCA': 0, 'MANDIRI': 1, 'BRI': 2, 'BNI': 3, 'OCBC': 4, 'SINARMAS': 5
      }
      let bankConfig = banks[Math.floor(Math.random() * banks.length)]
      if (preferredBank && preferredBank in map) {
        bankConfig = banks[map[preferredBank]]
      }

      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          userId,
          uniqueCode: uniqueCode.toString(),
          amount: totalAmount,
          paymentMethod: bankConfig.method,
          bankName: bankConfig.name,
          accountName: 'Indra Gunawan',
          accountNumber: bankConfig.number,
          status: 'pending',
          fraudScore: 0,
          fraudLevel: 'SAFE',
          autoDecision: 'PENDING'
        }
      })
      return newPayment
    })

    const res = NextResponse.json({
      success: true,
      message: payment.status === 'pending'
        ? 'Payment siap, silakan transfer'
        : 'Payment sudah ada, silakan upload bukti',
      payment
    })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('Referrer-Policy', 'no-referrer')
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res

  } catch (error) {
    console.error('Create payment error:', { error, cid })
    const res = NextResponse.json({ error: 'Terjadi kesalahan saat membuat payment' }, { status: 500 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}
