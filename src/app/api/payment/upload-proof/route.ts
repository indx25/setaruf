import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'

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
    } catch {
      return NextResponse.json({ error: 'URL bukti tidak valid' }, { status: 400 })
    }

    if (!paymentId || !proofUrl) {
      return NextResponse.json(
        { error: 'Payment ID dan bukti transfer wajib diisi' },
        { status: 400 }
      )
    }

    const payment = await db.payment.update({
      where: {
        id: paymentId,
        userId
      },
      data: {
        proofUrl,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Bukti transfer berhasil diupload. Mohon tunggu approval 1x24 jam.',
      payment
    })

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
