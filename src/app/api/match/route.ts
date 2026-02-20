import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('targetId') || undefined

    let match
    if (targetId) {
      match = await db.match.findFirst({
        where: {
          OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
      })
    } else {
      match = await db.match.findFirst({
        where: {
          OR: [{ requesterId: userId }, { targetId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
      })
    }

    const hasActiveMatch = !!(match && match.status === 'approved')
    const res = NextResponse.json({
      hasActiveMatch,
      match: match ? { id: match.id, status: match.status, step: match.step, requesterId: match.requesterId, targetId: match.targetId } : null,
    })
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    return res
  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Match GET error:', { error, cid })
    try { logger.record({ type: 'error', action: 'match_get_status', detail: `Match GET error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json({ error: 'Gagal mengambil status match' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const decision = String(body?.decision || '')
    const targetId = String(body?.targetId || '')

    if (!decision || !targetId) {
      return NextResponse.json({ error: 'Decision dan targetId diperlukan' }, { status: 400 })
    }
  if (targetId === userId) {
    return NextResponse.json({ error: 'Tidak dapat mencocokkan dengan diri sendiri' }, { status: 400 })
  }

    if (decision === 'approve') {
      // Mutual approval: hanya approved jika kedua pihak sudah approve
      let match = await db.match.findFirst({
        where: { OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }] },
      })

      const isRequester = match ? match.requesterId === userId : true

      let becameApproved = false
      if (!match) {
        // Buat match pending dan tandai approval dari sisi yang mengklik
        match = await db.match.create({
          data: {
            requesterId: userId,
            targetId,
            status: 'pending',
            step: 'requester_approved'
          }
        })
        // Notifikasi ke target: pasangan menekan Lanjut
        await db.notification.create({
          data: {
            userId: targetId,
            type: 'match_request',
            title: 'Pasangan Memilih Lanjut',
            message: 'Pasangan Anda menekan Lanjut. Jika Anda setuju, pilih Lanjut untuk mengaktifkan match.',
            link: `/dashboard/matches/${match.id}`
          }
        })
      } else {
        // Update step untuk mencatat approval dari sisi user saat ini
        if (isRequester) {
          // Jika pihak lain sudah approve sebelumnya, finalisasi jadi approved
          if (match.step === 'target_approved') {
            match = await db.match.update({
              where: { id: match.id },
              data: { status: 'approved', step: 'chatting' }
            })
            becameApproved = true
          } else {
            match = await db.match.update({
              where: { id: match.id },
              data: { status: 'pending', step: 'requester_approved' }
            })
            // Notifikasi ke target: pasangan menekan Lanjut
            await db.notification.create({
              data: {
                userId: targetId,
                type: 'match_request',
                title: 'Pasangan Memilih Lanjut',
                message: 'Pasangan Anda menekan Lanjut. Jika Anda setuju, pilih Lanjut untuk mengaktifkan match.',
                link: `/dashboard/matches/${match.id}`
              }
            })
          }
        } else {
          // user sekarang adalah target
          if (match.step === 'requester_approved') {
            match = await db.match.update({
              where: { id: match.id },
              data: { status: 'approved', step: 'chatting' }
            })
            becameApproved = true
          } else {
            match = await db.match.update({
              where: { id: match.id },
              data: { status: 'pending', step: 'target_approved' }
            })
            // Notifikasi ke requester: pasangan menekan Lanjut
            await db.notification.create({
              data: {
                userId: match.requesterId,
                type: 'match_request',
                title: 'Pasangan Memilih Lanjut',
                message: 'Pasangan Anda menekan Lanjut. Jika Anda setuju, pilih Lanjut untuk mengaktifkan match.',
                link: `/dashboard/matches/${match.id}`
              }
            })
          }
        }
      }

      if (becameApproved || match.status === 'approved') {
        await db.user.update({
          where: { id: userId },
          data: { workflowStatus: 'getting_to_know' },
        })
        if (targetId) {
          await db.user.update({
            where: { id: targetId },
            data: { workflowStatus: 'getting_to_know' },
          })
        }
        // Notifikasi approved ke kedua pihak
        await db.notification.create({
          data: {
            userId: userId,
            type: 'match_approved',
            title: 'Match Aktif',
            message: 'Anda dan pasangan telah sama‑sama memilih Lanjut. Chat kini aktif.',
            link: `/dashboard/matches/${match.id}`
          }
        })
        await db.notification.create({
          data: {
            userId: targetId!,
            type: 'match_approved',
            title: 'Match Aktif',
            message: 'Anda dan pasangan telah sama‑sama memilih Lanjut. Chat kini aktif.',
            link: `/dashboard/matches/${match.id}`
          }
        })
      }

      return NextResponse.json({ success: true, match })
    }

    if (decision === 'reject') {
      const match = await db.match.findFirst({
        where: { OR: [{ requesterId: userId, targetId }, { requesterId: targetId, targetId: userId }] },
      })
      if (match) {
        await db.match.update({ where: { id: match.id }, data: { status: 'rejected', step: 'rejected' } })
        // Notifikasi penolakan ke kedua pihak
        await db.notification.create({
          data: {
            userId: userId,
            type: 'match_rejected',
            title: 'Match Ditolak',
            message: 'Anda telah menolak proses taaruf dengan pasangan ini.',
            link: `/dashboard/matches/${match.id}`
          }
        })
        await db.notification.create({
          data: {
            userId: userId === match.requesterId ? match.targetId : match.requesterId,
            type: 'match_rejected',
            title: 'Match Ditolak',
            message: 'Pasangan menolak proses taaruf.',
            link: `/dashboard/matches/${match.id}`
          }
        })
      } else {
        await db.match.create({
          data: { requesterId: userId, targetId, status: 'rejected', step: 'rejected' }
        })
        // Notifikasi penolakan ke kedua pihak (match baru)
        const created = await db.match.findFirst({
          where: { requesterId: userId, targetId, status: 'rejected' },
          orderBy: { createdAt: 'desc' }
        })
        if (created) {
          await db.notification.create({
            data: {
              userId: userId,
              type: 'match_rejected',
              title: 'Match Ditolak',
              message: 'Anda telah menolak proses taaruf dengan pasangan ini.',
              link: `/dashboard/matches/${created.id}`
            }
          })
          await db.notification.create({
            data: {
              userId: targetId,
              type: 'match_rejected',
              title: 'Match Ditolak',
              message: 'Pasangan menolak proses taaruf.',
              link: `/dashboard/matches/${created.id}`
            }
          })
        }
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Decision tidak dikenal' }, { status: 400 })
  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    console.error('Match POST error:', { error, cid })
    try { logger.record({ type: 'error', action: 'match_post', detail: `Match POST error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json({ error: 'Gagal memperbarui status match' }, { status: 500 })
  }
}
