import 'dotenv/config'
import { Worker, QueueEvents } from 'bullmq'
import { runCompatibility } from '@/services/compatibility'

const url = process.env.REDIS_URL
if (!url) {
  console.error('REDIS_URL is not defined. Exiting worker.')
  process.exit(1)
}

const worker = new Worker('compat', async job => {
  const { userAId, userBId } = job.data as { userAId: string; userBId: string }
  return runCompatibility(userAId, userBId)
}, { connection: { url } })

const events = new QueueEvents('compat', { connection: { url } })
events.on('completed', ({ jobId }) => console.log('compat completed', jobId))
events.on('failed', ({ jobId, failedReason }) => console.error('compat failed', jobId, failedReason))

worker.on('ready', () => console.log('compat worker ready'))
worker.on('error', err => console.error('compat worker error', err))

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})
