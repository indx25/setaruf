export interface TraitVector {
  dominance: number
  stability: number
  empathy: number
  logic: number
  religiosity: number
  emotionalControl: number
}

export function normalize(value: number, min: number, max: number) {
  if (typeof value !== 'number' || !isFinite(value)) return 0
  const v = (value - min) / (max - min)
  return Math.max(0, Math.min(1, v))
}

function parseResult(r: any): any {
  if (!r) return {}
  if (typeof r === 'string') {
    try { return JSON.parse(r) } catch { return {} }
  }
  if (typeof r === 'object') return r
  return {}
}

export function extractTraits(tests: any[]): TraitVector {
  const disc = parseResult(tests.find(t => t.testType === 'disc')?.result) || {}
  const pf16 = parseResult(tests.find(t => t.testType === '16pf')?.result) || {}
  const clinical = parseResult(tests.find(t => t.testType === 'clinical')?.result) || {}
  const premarriage = parseResult(tests.find(t => t.testType === 'pre_marriage')?.result) || {}

  return {
    dominance: normalize((disc.D as number) || 0, 0, 100),
    stability: normalize((clinical.stability as number) || 0, 0, 100),
    empathy: normalize((pf16.warmth as number) || 0, 0, 100),
    logic: normalize((pf16.reasoning as number) || 0, 0, 100),
    religiosity: normalize((premarriage.religiosity as number) || 0, 0, 100),
    emotionalControl: normalize((clinical.emotionalRegulation as number) || 0, 0, 100)
  }
}
