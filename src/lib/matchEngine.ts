export enum MatchStep {
  INITIAL = 'initial',
  PHOTO_PENDING = 'photo_pending',
  PHOTO_APPROVED = 'photo_approved',
  FULL_DATA_REQUESTED = 'full_data_requested',
  FULL_DATA_APPROVED = 'full_data_approved',
  BIODATA_OPENED = 'biodata_opened',
  AI_ANALYZING = 'ai_analyzing',
  AI_RECOMMENDATION_READY = 'ai_recommendation_ready',
  MEETING_SCHEDULED = 'meeting_scheduled',
  MARRIAGE_INTENT = 'marriage_intent',
  CLOSED = 'closed'
}

const allowedTransitions: Record<MatchStep, MatchStep[]> = {
  [MatchStep.INITIAL]: [MatchStep.PHOTO_PENDING],
  [MatchStep.PHOTO_PENDING]: [MatchStep.PHOTO_APPROVED, MatchStep.CLOSED],
  [MatchStep.PHOTO_APPROVED]: [MatchStep.FULL_DATA_REQUESTED, MatchStep.CLOSED],
  [MatchStep.FULL_DATA_REQUESTED]: [MatchStep.FULL_DATA_APPROVED, MatchStep.CLOSED],
  [MatchStep.FULL_DATA_APPROVED]: [MatchStep.BIODATA_OPENED, MatchStep.CLOSED],
  [MatchStep.BIODATA_OPENED]: [MatchStep.AI_ANALYZING, MatchStep.CLOSED],
  [MatchStep.AI_ANALYZING]: [MatchStep.AI_RECOMMENDATION_READY],
  [MatchStep.AI_RECOMMENDATION_READY]: [MatchStep.MEETING_SCHEDULED, MatchStep.CLOSED],
  [MatchStep.MEETING_SCHEDULED]: [MatchStep.MARRIAGE_INTENT, MatchStep.CLOSED],
  [MatchStep.MARRIAGE_INTENT]: [MatchStep.CLOSED],
  [MatchStep.CLOSED]: []
}

export function canTransition(from: MatchStep, to: MatchStep): boolean {
  return allowedTransitions[from]?.includes(to) ?? false
}
