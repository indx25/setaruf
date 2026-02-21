import { db } from './db'
import { MatchStep } from './matchEngine'
import { transitionMatchStep } from './transitionEngine'

export async function runCompatibilityAI(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      requester: { include: { psychotests: true } },
      target: { include: { psychotests: true } }
    }
  })
  if (!match) {
    const e: any = new Error('NOT_FOUND')
    e.code = 'NOT_FOUND'
    throw e
  }
  const requesterScore = (match as any).requester?.psychotests?.[0]?.score ?? 50
  const targetScore = (match as any).target?.psychotests?.[0]?.score ?? 50
  const compatibility = 100 - Math.abs(requesterScore - targetScore)
  const summary =
    compatibility > 80
      ? 'Kecocokan sangat tinggi secara psikologis.'
      : compatibility > 60
      ? 'Cukup cocok dengan beberapa penyesuaian.'
      : 'Perlu diskusi lebih lanjut untuk memahami perbedaan.'
  return { score: compatibility, summary, userIds: [match.requesterId, match.targetId] }
}

export async function handleBiodataOpened(matchId: string) {
  try {
    await transitionMatchStep(matchId, MatchStep.AI_ANALYZING)
    const result = await runCompatibilityAI(matchId)
    await db.match.update({
      where: { id: matchId },
      data: { compatibilityScore: result.score, aiReasoning: result.summary }
    })
    await transitionMatchStep(matchId, MatchStep.AI_RECOMMENDATION_READY)
    await db.notification.createMany({
      data: (result.userIds as string[]).map((userId) => ({
        userId,
        type: 'ai_recommendation',
        title: 'Hasil Analisis Kecocokan Siap',
        message: 'AI telah menyelesaikan analisis kecocokan Anda.',
        link: `/dashboard/matches/${matchId}`
      }))
    })
  } catch {}
}

