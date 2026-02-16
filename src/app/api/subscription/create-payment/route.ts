import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

// Create new payment with unique code
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if there's a pending payment
    const pendingPayment = await db.payment.findFirst({
      where: {
        userId,
        status: 'pending'
      }
    })

    if (pendingPayment) {
      return NextResponse.json({
        success: true,
        message: 'Payment sudah ada, silakan upload bukti transfer',
        payment: pendingPayment
      })
    }

    // Generate unique code (3 digit random number)
    const uniqueCode = Math.floor(Math.random() * 900) + 100
    const baseAmount = 50000
    const totalAmount = baseAmount + uniqueCode

    // Create payment record
    const payment = await db.payment.create({
      data: {
        userId,
        uniqueCode: uniqueCode.toString(),
        amount: totalAmount,
        paymentMethod: 'transfer_bca',
        bankName: 'BCA',
        accountName: 'Indra Gunawan',
        accountNumber: '1084421955',
        status: 'pending',
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Payment berhasil dibuat',
      payment
    })

  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat payment' },
      { status: 500 }
    )
  }
}
