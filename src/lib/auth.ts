import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { verifyQuiz } from '@/lib/quiz'
import { isBlocked, recordWrongQuizAttempt } from '@/lib/rate-limit'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: '/',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        quiz: { label: 'quiz', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const email = String(credentials?.email || '').trim().toLowerCase()
          const password = String(credentials?.password || '')
          const quizPayloadRaw = String(credentials?.quiz || '')
          let quiz: any = null
          try { quiz = JSON.parse(quizPayloadRaw) } catch {}
          const log = (reason: string) => { try { console.warn('AUTH_DEBUG', { reason, email }) } catch {} }

          const user = await db.user.findUnique({
            where: { email },
          })

          if (!user || user.isBlocked) {
            log(!user ? 'user_not_found' : 'user_blocked')
            return null
          }

          if (!user.isAdmin) {
            const rlKey = `quiz:login:${email}`
            if (isBlocked(rlKey)) {
              log('rate_limited')
              throw new Error('Terlalu banyak jawaban salah. Coba lagi nanti.')
            }
            const quizResult = await verifyQuiz(quiz)
            if (!quizResult.success) {
              recordWrongQuizAttempt(rlKey)
              log('quiz_invalid')
              throw new Error('Verifikasi quiz gagal')
            }
          }

          const valid = await bcrypt.compare(password, user.password)
          if (!valid) {
            log('password_invalid')
            return null
          }

          return {
            id: user.id,
            name: user.name || '',
            email: user.email,
          }
        } catch {
          try { console.warn('AUTH_DEBUG', { reason: 'authorize_exception' }) } catch {}
          return null
        }
      }
    })
    ,
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id as string
      }
      return token
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        ;(session.user as any).id = token.id
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
