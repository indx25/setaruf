import { db } from '@/lib/db'
import { extractTraits } from './traitExtractor'
import { calculateCompatibility } from './scoringEngine'

export async function runCompatibility(userAId: string, userBId: string) {
  const [aTests, bTests] = await Promise.all([
    db.psychoTest.findMany({ where: { userId: userAId } }),
    db.psychoTest.findMany({ where: { userId: userBId } })
  ])
  const traitsA = extractTraits(aTests)
  const traitsB = extractTraits(bTests)
  const result = calculateCompatibility(traitsA, traitsB)
  const [id1, id2] = [userAId, userBId].sort()
  try {
    await db.compatibilityScore.upsert({
      where: { userAId_userBId: { userAId: id1, userBId: id2 } },
      update: { score: result.score, breakdown: result.breakdown },
      create: { userAId: id1, userBId: id2, score: result.score, breakdown: result.breakdown }
    })
  } catch {}
  return { ...result, userAId: id1, userBId: id2 }
}
