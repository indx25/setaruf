import { db } from './db'
import { MatchStep, canTransition } from './matchEngine'

export async function transitionMatchStep(matchId: string, nextStep: MatchStep) {
  return await db.$transaction(async (tx) => {
    const cur = await tx.match.findUnique({ where: { id: matchId }, select: { step: true } })
    if (!cur) {
      const e: any = new Error('NOT_FOUND')
      e.code = 'NOT_FOUND'
      throw e
    }
    const from = (cur.step as MatchStep) || MatchStep.INITIAL
    if (!canTransition(from, nextStep)) {
      const e: any = new Error('INVALID_TRANSITION')
      e.code = 'INVALID_TRANSITION'
      throw e
    }
    return await tx.match.update({ where: { id: matchId }, data: { step: nextStep } })
  })
}

