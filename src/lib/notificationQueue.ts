import { db } from './db'

type Payload = {
  userId: string
  type: string
  title: string
  message: string
  link?: string | null
  dedupeKey?: string | null
}

export async function queueNotification(p: Payload) {
  try {
    await db.notification.create({
      data: {
        userId: p.userId,
        type: p.type,
        title: p.title,
        message: p.message,
        link: p.link || null,
        dedupeKey: p.dedupeKey || null,
      }
    })
  } catch {}
}

