import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || ''
    const identifier = (searchParams.get('identifier') || '').trim().toLowerCase()

    if (!token || !identifier) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
    }

    try { await db.$connect() } catch { return NextResponse.json({ error: 'Database tidak dapat diakses' }, { status: 500 }) }

    const vt = await db.verificationToken.findUnique({
      where: { token },
    })
    if (!vt || vt.identifier !== identifier) {
      return NextResponse.json({ error: 'Token verifikasi tidak valid' }, { status: 400 })
    }
    if (vt.expires && vt.expires < new Date()) {
      return NextResponse.json({ error: 'Token verifikasi kedaluwarsa' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: identifier } })
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    if (!user.isBlocked) {
      await db.verificationToken.delete({ where: { token } })
      {
        const res = NextResponse.json({ success: true, message: 'Email sudah diverifikasi sebelumnya' })
        res.headers.set('Cache-Control', 'no-store, private, max-age=0')
        return res
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: { isBlocked: false },
    })
    await db.verificationToken.delete({ where: { token } })

    {
      const res = NextResponse.redirect(new URL('/?verified=1', request.url))
      res.headers.set('Cache-Control', 'no-store, private, max-age=0')
      return res
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal verifikasi email: ${msg}` }, { status: 500 })
  }
}
