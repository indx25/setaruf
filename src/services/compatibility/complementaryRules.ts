import type { TraitVector } from './traitExtractor'

export function applyComplementaryRules(
  a: TraitVector,
  b: TraitVector,
  baseScore: number
) {
  let penalty = 0
  if (a.dominance > 0.8 && b.dominance > 0.8) {
    penalty += 5
  }
  if (Math.abs(a.emotionalControl - b.emotionalControl) > 0.7) {
    penalty += 3
  }
  return Math.max(0, baseScore - penalty)
}
