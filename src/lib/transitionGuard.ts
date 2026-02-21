export function validateTransition(current: string | null, next: string) {
  const allowed: Record<string, string[]> = {
    profile_request: ['profile_viewed', 'rejected'],
    profile_viewed: ['photo_requested', 'rejected'],
    photo_requested: ['photo_approved', 'photo_rejected'],
    photo_approved: ['full_data_requested', 'rejected'],
    full_data_requested: ['full_data_approved', 'full_data_rejected'],
    full_data_approved: ['chatting'],
  }
  const key = current || 'profile_request'
  const options = allowed[key] || []
  if (!options.includes(next)) {
    const e: any = new Error('INVALID_TRANSITION')
    e.code = 'INVALID_TRANSITION'
    throw e
  }
}

