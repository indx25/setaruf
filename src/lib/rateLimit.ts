import { throttle } from './rate-limit'

export async function enforceRateLimit(userId: string, ip?: string) {
  const okMin = await throttle(`action:${userId}:min`, 30, 60_000)
  const okHour = await throttle(`action:${userId}:hour`, 300, 60 * 60_000)
  if (!okMin || !okHour) {
    const e: any = new Error('RATE_LIMITED')
    e.code = 'RATE_LIMITED'
    throw e
  }
  if (ip) {
    const okIp = await throttle(`ip:${ip}:min`, 120, 60_000)
    if (!okIp) {
      const e: any = new Error('RATE_LIMITED')
      e.code = 'RATE_LIMITED'
      throw e
    }
  }
}

