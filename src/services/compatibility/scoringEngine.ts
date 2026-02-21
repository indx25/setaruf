import type { TraitVector } from './traitExtractor'
import { applyComplementaryRules } from './complementaryRules'

const weight: Record<keyof TraitVector, number> = {
  dominance: 0.15,
  stability: 0.20,
  empathy: 0.20,
  logic: 0.10,
  religiosity: 0.20,
  emotionalControl: 0.15
}

export function calculateCompatibility(a: TraitVector, b: TraitVector) {
  let rawScore = 0
  const breakdown: Record<string, number> = {}
  for (const key in weight) {
    const k = key as keyof TraitVector
    const diff = Math.abs(a[k] - b[k])
    const similarity = 1 - diff
    const weighted = similarity * weight[k]
    breakdown[k] = Math.round(weighted * 100)
    rawScore += weighted
  }
  let finalScore = Math.round(rawScore * 100)
  finalScore = applyComplementaryRules(a, b, finalScore)
  return { score: finalScore, breakdown }
}
