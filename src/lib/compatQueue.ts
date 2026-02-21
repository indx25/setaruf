import { runCompatibility } from '@/services/compatibility'

export function isQueueEnabled() {
  return !!process.env.REDIS_URL
}

export async function enqueueCompatibilityJob(userAId: string, userBId: string) {
  if (!isQueueEnabled()) {
    return runCompatibility(userAId, userBId)
  }
  const { Queue } = await import('bullmq')
  const connection = { connection: { url: process.env.REDIS_URL as string } }
  const q = new Queue('compat', connection)
  await q.add('compatibility', { userAId, userBId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 100
  })
  return { enqueued: true }
}

export async function enqueueCompatibilityRecalc(userId: string) {
  if (!isQueueEnabled()) {
    return { enqueued: false }
  }
  const { Queue } = await import('bullmq')
  const connection = { connection: { url: process.env.REDIS_URL as string } }
  const q = new Queue('compat', connection)
  await q.add('recompute_for_user', { userId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 100
  })
  return { enqueued: true }
}
