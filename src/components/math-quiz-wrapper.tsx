'use client'

import { useEffect, useState } from 'react'

type Op = '+' | '-'

interface QuizPayload {
  a: number
  b: number
  op: Op
  answer: number
}

interface MathQuizWrapperProps {
  children: (executeQuiz: () => Promise<QuizPayload>) => React.ReactNode
  op?: Op | 'random'
}

export function MathQuizWrapper({ children, op = 'random' }: MathQuizWrapperProps) {
  const [answer, setAnswer] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [quiz, setQuiz] = useState<{ a: number; b: number; operator: Op; solution: number } | null>(null)

  useEffect(() => {
    const a = Math.floor(Math.random() * 5) + 2
    const b = Math.floor(Math.random() * 5) + 2
    const operator: Op = op === 'random' ? (Math.random() < 0.5 ? '+' : '-') : op as Op
    const solution = operator === '+' ? a + b : a - b
    setQuiz({ a, b, operator, solution })
    setAnswer('')
    setError('')
  }, [op])

  const executeQuiz = async (): Promise<QuizPayload> => {
    if (!quiz) {
      setError('Verifikasi belum siap')
      throw new Error('Verifikasi belum siap')
    }
    const num = Number(answer)
    if (!Number.isFinite(num)) {
      setError('Jawaban harus berupa angka')
      throw new Error('Jawaban tidak valid')
    }
    if (num !== quiz.solution) {
      setError('Jawaban salah')
      throw new Error('Jawaban salah')
    }
    setError('')
    return { a: quiz.a, b: quiz.b, op: quiz.operator, answer: num }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
        <span className="font-medium">Verifikasi:</span>
        <span className="font-mono">
          {quiz ? (
            <>
              {quiz.a} {quiz.operator} {quiz.b} = ?
            </>
          ) : (
            <>? = ?</>
          )}
        </span>
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Masukkan jawaban"
        className="w-full border rounded-md px-3 py-2 text-sm"
        disabled={!quiz}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {children(executeQuiz)}
    </div>
  )
}
