export type Op = '+' | '-'

export interface QuizPayload {
  a: number
  b: number
  op: Op
  answer: number
}

export async function verifyQuiz(quiz: QuizPayload | null | undefined): Promise<{ success: boolean; error?: string }> {
  try {
    if (!quiz) {
      return { success: false, error: 'Quiz missing' }
    }
    const { a, b, op, answer } = quiz
    if (typeof a !== 'number' || typeof b !== 'number' || (op !== '+' && op !== '-') || typeof answer !== 'number') {
      return { success: false, error: 'Invalid quiz payload' }
    }
    const expected = op === '+' ? a + b : a - b
    if (answer !== expected) {
      return { success: false, error: 'Wrong answer' }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Quiz verification error' }
  }
}
