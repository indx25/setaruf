import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET - Get match details
export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { matchId } = params

    const match = await db.match.findFirst({
      where: {
        id: matchId,
        OR: [
          { requesterId: userId },
          { targetId: userId }
        ]
      },
      include: {
        requester: {
          include: { profile: true, psychotests: true }
        },
        target: {
          include: { profile: true, psychotests: true }
        }
      }
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }

    // Determine which user is the current user
    const isRequester = match.requesterId === userId
    const otherUser = isRequester ? match.target : match.requester

    return NextResponse.json({
      match,
      otherUser,
      isRequester,
      canViewProfile: match.status === 'approved' || match.step === 'profile_viewed',
      canViewPhoto: match.step === 'photo_approved' || match.step === 'full_data_approved',
      canViewFullBiodata: match.step === 'full_data_approved' || match.step === 'chatting',
      canChat: match.step === 'chatting' || match.step === 'full_data_approved'
    })

  } catch (error) {
    console.error('Get match error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data match' },
      { status: 500 }
    )
  }
}

// POST - Handle match actions (approve, reject, etc.)
export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { matchId } = params
    const { action } = await request.json()

    const match = await db.match.findFirst({
      where: {
        id: matchId,
        OR: [
          { requesterId: userId },
          { targetId: userId }
        ]
      },
      include: {
        requester: true,
        target: true
      }
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }

    const isRequester = match.requesterId === userId
    const otherUserId = isRequester ? match.targetId : match.requesterId

    let updatedMatch
    let notificationType = ''
    let notificationTitle = ''
    let notificationMessage = ''

    switch (action) {
      case 'approve_profile':
        // Only target can approve profile view
        if (isRequester) {
          return NextResponse.json(
            { error: 'Hanya penerima yang dapat menyetujui' },
            { status: 403 }
          )
        }

        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            status: 'approved',
            step: 'profile_viewed',
            targetViewed: true,
            requesterViewed: true,
            updatedAt: new Date()
          }
        })

        notificationType = 'profile_viewed'
        notificationTitle = 'Permintaan Lihat Profil Disetujui!'
        notificationMessage = 'Anda sekarang dapat melihat profil pasangan yang cocok.'
        break

      case 'reject_profile':
        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            status: 'rejected',
            updatedAt: new Date()
          }
        })

        notificationType = 'match_rejected'
        notificationTitle = 'Permintaan Lihat Profil Ditolak'
        notificationMessage = 'Maaf, permintaan Anda untuk melihat profil telah ditolak.'
        break

      case 'request_photo':
        if (match.step !== 'profile_viewed') {
          return NextResponse.json(
            { error: 'Tahap tidak valid untuk request foto' },
            { status: 400 }
          )
        }

        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            step: 'photo_requested',
            updatedAt: new Date()
          }
        })

        // Create notifications for both users
        await db.notification.createMany({
          data: [
            {
              userId: match.requesterId,
              type: 'photo_request',
              title: 'Rekomendasi Lihat Foto',
              message: 'Sistem merekomendasikan Anda untuk melihat foto pasangan. Silakan setujui atau tolak.',
              link: `/dashboard/matches/${matchId}`
            },
            {
              userId: match.targetId,
              type: 'photo_request',
              title: 'Rekomendasi Lihat Foto',
              message: 'Sistem merekomendasikan Anda untuk melihat foto pasangan. Silakan setujui atau tolak.',
              link: `/dashboard/matches/${matchId}`
            }
          ]
        })

        return NextResponse.json({
          success: true,
          message: 'Request foto dikirim',
          match: updatedMatch
        })

      case 'approve_photo':
        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            step: 'photo_approved',
            updatedAt: new Date()
          }
        })

        // Check if both approved
        const photoApprovals = await db.match.findUnique({
          where: { id: matchId },
          select: { step: true }
        })

        // If at photo_approved stage, both have approved
        notificationType = 'photo_approved'
        notificationTitle = 'Foto Disetujui!'
        notificationMessage = 'Anda sekarang dapat melihat foto pasangan.'
        break

      case 'reject_photo':
        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            status: 'rejected',
            step: 'photo_rejected',
            updatedAt: new Date()
          }
        })

        await db.notification.create({
          data: {
            userId: otherUserId,
            type: 'photo_rejected',
            title: 'Permintaan Foto Ditolak',
            message: 'Permintaan untuk melihat foto telah ditolak.',
            link: `/dashboard/matches/${matchId}`
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Request foto ditolak',
          match: updatedMatch
        })

      case 'request_full_biodata':
        if (match.step !== 'photo_approved') {
          return NextResponse.json(
            { error: 'Tahap tidak valid untuk request biodata lengkap' },
            { status: 400 }
          )
        }

        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            step: 'full_data_requested',
            updatedAt: new Date()
          }
        })

        // Create notifications for both users
        await db.notification.createMany({
          data: [
            {
              userId: match.requesterId,
              type: 'full_data_request',
              title: 'Rekomendasi Lihat Biodata Lengkap',
              message: 'Sistem merekomendasikan Anda untuk melihat biodata lengkap pasangan. Silakan setujui atau tolak.',
              link: `/dashboard/matches/${matchId}`
            },
            {
              userId: match.targetId,
              type: 'full_data_request',
              title: 'Rekomendasi Lihat Biodata Lengkap',
              message: 'Sistem merekomendasikan Anda untuk melihat biodata lengkap pasangan. Silakan setujui atau tolak.',
              link: `/dashboard/matches/${matchId}`
            }
          ]
        })

        return NextResponse.json({
          success: true,
          message: 'Request biodata lengkap dikirim',
          match: updatedMatch
        })

      case 'approve_full_biodata':
        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            step: 'full_data_approved',
            updatedAt: new Date()
          }
        })

        // Update user workflow status to getting_to_know
        await db.user.update({
          where: { id: userId },
          data: { workflowStatus: 'getting_to_know' }
        })

        notificationType = 'full_data_approved'
        notificationTitle = 'Biodata Lengkap Disetujui!'
        notificationMessage = 'Anda sekarang dapat melihat biodata lengkap pasangan dan mulai chat.'
        break

      case 'reject_full_biodata':
        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            status: 'rejected',
            step: 'full_data_rejected',
            updatedAt: new Date()
          }
        })

        await db.notification.create({
          data: {
            userId: otherUserId,
            type: 'full_data_rejected',
            title: 'Permintaan Biodata Lengkap Ditolak',
            message: 'Permintaan untuk melihat biodata lengkap telah ditolak.',
            link: `/dashboard/matches/${matchId}`
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Request biodata lengkap ditolak',
          match: updatedMatch
        })

      case 'start_chatting':
        if (match.step !== 'full_data_approved') {
          return NextResponse.json(
            { error: 'Tidak dapat memulai chat sebelum biodata lengkap disetujui' },
            { status: 400 }
          )
        }

        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            step: 'chatting',
            updatedAt: new Date()
          }
        })

        await db.user.updateMany({
          where: {
            id: { in: [match.requesterId, match.targetId] }
          },
          data: { workflowStatus: 'getting_to_know' }
        })

        notificationType = 'chat_enabled'
        notificationTitle = 'Chat Aktif!'
        notificationMessage = 'Anda sekarang dapat mengobrol dengan pasangan.'
        break

      case 'block':
        updatedMatch = await db.match.update({
          where: { id: matchId },
          data: {
            status: 'blocked',
            updatedAt: new Date()
          }
        })

        await db.notification.create({
          data: {
            userId: otherUserId,
            type: 'match_blocked',
            title: 'Match Diblokir',
            message: 'Pengguna lain telah memblokir match ini.',
            link: '/dashboard'
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Match berhasil diblokir',
          match: updatedMatch
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Create notification if there's one
    if (notificationType) {
      await db.notification.create({
        data: {
          userId: otherUserId,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          link: `/dashboard/matches/${matchId}`
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Action berhasil',
      match: updatedMatch
    })

  } catch (error) {
    console.error('Match action error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat melakukan action' },
      { status: 500 }
    )
  }
}
