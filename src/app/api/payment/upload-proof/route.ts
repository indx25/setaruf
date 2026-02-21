export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'
import { runEnterpriseFraudCheck } from '@/lib/fraud/bankFraudEngine'

// Upload payment proof
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { paymentId, proofUrl } = await request.json()
    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'Payment ID tidak valid' }, { status: 400 })
    }
    if (typeof proofUrl !== 'string' || proofUrl.length > 2048) {
      return NextResponse.json({ error: 'URL bukti tidak valid' }, { status: 400 })
    }
    try {
      const u = new URL(proofUrl)
      if (u.protocol !== 'https:') {
        return NextResponse.json({ error: 'URL bukti harus HTTPS' }, { status: 400 })
      }
      const allowed = (process.env.ALLOWED_PROOF_HOSTS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
      if (allowed.length > 0) {
        const host = u.hostname.toLowerCase()
        const ok = allowed.some(h => host === h || host.endsWith(`.${h}`))
        if (!ok) {
          return NextResponse.json({ error: 'Domain URL bukti tidak diizinkan' }, { status: 400 })
        }
      }
    } catch {
      return NextResponse.json({ error: 'URL bukti tidak valid' }, { status: 400 })
    }

    if (!paymentId || !proofUrl) {
      return NextResponse.json(
        { error: 'Payment ID dan bukti transfer wajib diisi' },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId, userId },
        data: { proofUrl }
      })
      const fraud = await runEnterpriseFraudCheck({
        proofUrl,
        expectedAmount: payment.amount,
        expectedBank: payment.bankName,
        userId,
        paymentId,
        db: tx
      })
      let updatedStatus = payment.status
      let approvedBy: string | null = null
      let approvedAt: Date | null = null
      if (fraud.decision === 'AUTO_APPROVE') {
        updatedStatus = 'approved'
        approvedBy = 'system'
        approvedAt = new Date()
      } else {
        updatedStatus = 'pending'
      }
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          imageHash: fraud.imageHash,
          bankDetected: fraud.bankDetected,
          ocrAmount: fraud.extractedAmount,
          ocrAccount: fraud.extractedAccount,
          fraudScore: fraud.fraudScore,
          fraudLevel: fraud.fraudLevel,
          autoDecision: fraud.decision,
          status: updatedStatus,
          approvedBy: approvedBy || undefined,
          approvedAt: approvedAt || undefined
        }
      })
      if (updatedStatus === 'approved') {
        await tx.user.update({ where: { id: payment.userId }, data: { isPremium: true } })
        const existingSub = await tx.subscription.findFirst({ where: { userId: payment.userId, isActive: true } })
        if (existingSub) {
          const currentEnd = new Date(existingSub.endDate || new Date())
          currentEnd.setMonth(currentEnd.getMonth() + 1)
          await tx.subscription.update({ where: { id: existingSub.id }, data: { endDate: currentEnd } })
        } else {
          const start = new Date()
          const end = new Date()
          end.setMonth(end.getMonth() + 1)
          await tx.subscription.create({
            data: { userId: payment.userId, planType: 'premium', amount: payment.amount || 0, duration: 1, startDate: start, endDate: end, isActive: true, isTrial: false }
          })
        }
      }
      return updatedPayment
    })

    return NextResponse.json({ success: true, message: 'Bukti transfer diproses', payment: result })

  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Upload proof error:', { error, cid })
    try { logger.record({ type: 'error', action: 'payment_upload_proof', detail: `Upload proof error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    const code = (error as any)?.code
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Data pembayaran tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat upload bukti transfer' },
      { status: 500 }
    )
  }
}
