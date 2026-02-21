import { PrismaClient } from '@prisma/client'
import { validateTransition } from '@/lib/transitionGuard'
import { queueNotification } from '@/lib/notificationQueue'

type Context = {
  matchId: string
  userId: string
  action: string
}

export async function handleMatchAction(tx: PrismaClient, ctx: Context) {
  const match = await tx.match.findUnique({ where: { id: ctx.matchId } })
  if (!match) {
    const e: any = new Error('Not found')
    e.code = 'NOT_FOUND'
    throw e
  }
  if (match.requesterId !== ctx.userId && match.targetId !== ctx.userId) {
    const e: any = new Error('Forbidden')
    e.code = 'FORBIDDEN'
    throw e
  }
  const isRequester = match.requesterId === ctx.userId
  const otherUserId = isRequester ? match.targetId : match.requesterId

  const handlers: Record<string, () => Promise<any>> = {
    like: async () => {
      await tx.match.update({ where: { id: ctx.matchId }, data: { status: 'liked', updatedAt: new Date() } })
      return { id: ctx.matchId, status: 'liked' }
    },
    dislike: async () => {
      await tx.match.update({ where: { id: ctx.matchId }, data: { status: 'disliked', updatedAt: new Date() } })
      return { id: ctx.matchId, status: 'disliked' }
    },
    approve_profile: async () => {
      validateTransition(match.step || 'profile_request', 'profile_viewed')
      if (isRequester) {
        const e: any = new Error('Forbidden')
        e.code = 'FORBIDDEN'
        throw e
      }
      await tx.match.updateMany({
        where: { id: ctx.matchId, step: match.step },
        data: { status: 'approved', step: 'profile_viewed', requesterViewed: true, targetViewed: true, updatedAt: new Date() }
      })
      await queueNotification({
        userId: otherUserId,
        type: 'profile_viewed',
        title: 'Profil Disetujui',
        message: 'Permintaan lihat profil disetujui.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `profile_viewed:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, step: 'profile_viewed', status: 'approved' }
    },
    reject_profile: async () => {
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { status: 'rejected', step: 'rejected', updatedAt: new Date() } })
      await queueNotification({
        userId: otherUserId,
        type: 'match_rejected',
        title: 'Permintaan Ditolak',
        message: 'Permintaan lihat profil ditolak.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `match_rejected:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, status: 'rejected', step: 'rejected' }
    },
    request_photo: async () => {
      validateTransition(match.step || 'profile_request', 'photo_requested')
      await tx.match.updateMany({ where: { id: ctx.matchId, step: match.step }, data: { step: 'photo_requested', updatedAt: new Date() } })
      await queueNotification({
        userId: match.requesterId,
        type: 'photo_request',
        title: 'Rekomendasi Foto',
        message: 'Sistem merekomendasikan melihat foto.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `photo_request:${ctx.matchId}:${match.requesterId}`
      })
      await queueNotification({
        userId: match.targetId,
        type: 'photo_request',
        title: 'Rekomendasi Foto',
        message: 'Sistem merekomendasikan melihat foto.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `photo_request:${ctx.matchId}:${match.targetId}`
      })
      return { id: ctx.matchId, step: 'photo_requested' }
    },
    approve_photo: async () => {
      validateTransition(match.step || 'profile_request', 'photo_approved')
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { step: 'photo_approved', updatedAt: new Date() } })
      await queueNotification({
        userId: otherUserId,
        type: 'photo_approved',
        title: 'Foto Disetujui',
        message: 'Akses foto disetujui.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `photo_approved:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, step: 'photo_approved' }
    },
    reject_photo: async () => {
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { status: 'rejected', step: 'photo_rejected', updatedAt: new Date() } })
      await queueNotification({
        userId: otherUserId,
        type: 'photo_rejected',
        title: 'Foto Ditolak',
        message: 'Permintaan foto ditolak.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `photo_rejected:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, status: 'rejected', step: 'photo_rejected' }
    },
    request_full_biodata: async () => {
      validateTransition(match.step || 'profile_request', 'full_data_requested')
      await tx.match.updateMany({ where: { id: ctx.matchId, step: match.step }, data: { step: 'full_data_requested', updatedAt: new Date() } })
      await queueNotification({
        userId: match.requesterId,
        type: 'full_data_request',
        title: 'Rekomendasi Biodata',
        message: 'Sistem merekomendasikan melihat biodata lengkap.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `full_data_request:${ctx.matchId}:${match.requesterId}`
      })
      await queueNotification({
        userId: match.targetId,
        type: 'full_data_request',
        title: 'Rekomendasi Biodata',
        message: 'Sistem merekomendasikan melihat biodata lengkap.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `full_data_request:${ctx.matchId}:${match.targetId}`
      })
      return { id: ctx.matchId, step: 'full_data_requested' }
    },
    approve_full_biodata: async () => {
      validateTransition(match.step || 'profile_request', 'full_data_approved')
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { step: 'full_data_approved', updatedAt: new Date() } })
      await tx.user.update({ where: { id: ctx.userId }, data: { workflowStatus: 'getting_to_know' } })
      await queueNotification({
        userId: otherUserId,
        type: 'full_data_approved',
        title: 'Biodata Disetujui',
        message: 'Akses biodata lengkap disetujui.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `full_data_approved:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, step: 'full_data_approved' }
    },
    reject_full_biodata: async () => {
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { status: 'rejected', step: 'full_data_rejected', updatedAt: new Date() } })
      await queueNotification({
        userId: otherUserId,
        type: 'full_data_rejected',
        title: 'Biodata Ditolak',
        message: 'Permintaan biodata lengkap ditolak.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `full_data_rejected:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, status: 'rejected', step: 'full_data_rejected' }
    },
    start_chatting: async () => {
      validateTransition(match.step || 'profile_request', 'chatting')
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { step: 'chatting', updatedAt: new Date() } })
      await tx.user.updateMany({ where: { id: { in: [match.requesterId, match.targetId] } }, data: { workflowStatus: 'getting_to_know' } })
      await queueNotification({
        userId: otherUserId,
        type: 'chat_enabled',
        title: 'Chat Aktif',
        message: 'Chat telah diaktifkan.',
        link: `/dashboard/matches/${ctx.matchId}`,
        dedupeKey: `chat_enabled:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, step: 'chatting' }
    },
    block: async () => {
      await tx.match.updateMany({ where: { id: ctx.matchId }, data: { status: 'blocked', updatedAt: new Date() } })
      await queueNotification({
        userId: otherUserId,
        type: 'match_blocked',
        title: 'Match Diblokir',
        message: 'Match telah diblokir.',
        link: `/dashboard`,
        dedupeKey: `match_blocked:${ctx.matchId}:${otherUserId}`
      })
      return { id: ctx.matchId, status: 'blocked' }
    },
  }

  const h = handlers[ctx.action]
  if (!h) {
    const e: any = new Error('INVALID_ACTION')
    e.code = 'INVALID_ACTION'
    throw e
  }
  const res = await h()
  return res
}

