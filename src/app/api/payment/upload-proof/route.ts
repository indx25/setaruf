import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
    if (typeof proofUrl !== 'string' || proofUrl.length > 2048) {
      return NextResponse.json({ error: 'URL bukti tidak valid' }, { status: 400 })
    }
    try {
      const u = new URL(proofUrl)
      if (!['http:', 'https:'].includes(u.protocol)) {
        return NextResponse.json({ error: 'URL harus http/https' }, { status: 400 })
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

    // Update payment with proof
    const payment = await db.payment.update({
      where: {
        id: paymentId,
        userId
      },
      data: {
        proofUrl,
      }
    })

    // Set auto-approval timeout (24 hours)
    // This would typically be handled by a background job/cron
    // For now, we'll just set a flag that can be checked by admin

    return NextResponse.json({
      success: true,
      message: 'Bukti transfer berhasil diupload. Mohon tunggu approval 1x24 jam.',
      payment
    })

  } catch (error) {
    console.error('Upload proof error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat upload bukti transfer' },
      { status: 500 }
    )
  }
}
