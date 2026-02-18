import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { verifyQuiz } from '@/lib/quiz'
import { isBlocked, recordWrongQuizAttempt } from '@/lib/rate-limit'

let adapter: any = undefined
let db: any = undefined
if (process.env.DATABASE_URL) {
  const { PrismaAdapter } = require('@next-auth/prisma-adapter')
  const mod = require('@/lib/db')
  db = mod.db
  adapter = PrismaAdapter(db)
}

export const authOptions: NextAuthOptions = {
  ...(adapter ? { adapter } : {}),
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
          if (db) {
            try { await db.$connect() } catch { throw new Error('Database tidak dapat diakses') }
          }
          const email = String(credentials?.email || '').trim().toLowerCase()
          const password = String(credentials?.password || '')
          const quizPayloadRaw = String(credentials?.quiz || '')
          let quiz: any = null
          try { quiz = JSON.parse(quizPayloadRaw) } catch {}
          const log = (reason: string) => { try { console.warn('AUTH_DEBUG', { reason, email }) } catch {} }

          const adminEmail = process.env.ADMIN_EMAIL || 'admin@setaruf.com'
          const adminBootPassword = process.env.ADMIN_BOOT_PASSWORD || ''
          const gmailBootPassword = process.env.GMAIL_BOOT_PASSWORD || ''

          let user: any = null
          if (db) {
            user = await db.user.findUnique({
              where: { email },
            })
          }

          if (!user || user.isBlocked) {
            // Auto-bootstrap admin on production if enabled via env
            if (
              !user &&
              adminBootPassword &&
              (email === adminEmail || process.env.NODE_ENV !== 'production')
            ) {
              const hashed = await bcrypt.hash(adminBootPassword, 10)
              if (db) {
                user = await db.user.create({
                  data: {
                    email,
                    name: 'Admin Setaruf',
                    password: hashed,
                    uniqueCode: 'STRF-ADMIN-BOOT',
                    isAdmin: true,
                    workflowStatus: 'completed',
                  }
                })
              } else {
                user = {
                  id: 'admin-local',
                  email,
                  name: 'Admin Setaruf',
                  password: hashed,
                  isAdmin: true
                }
              }
            } else if (
              gmailBootPassword &&
              email.endsWith('@gmail.com') &&
              password === gmailBootPassword &&
              process.env.NODE_ENV !== 'production'
            ) {
              const hashed = await bcrypt.hash(gmailBootPassword, 10)
              if (!user && db) {
                user = await db.user.create({
                  data: {
                    email,
                    name: email.split('@')[0],
                    password: hashed,
                    uniqueCode: 'STRF-GMAIL-BOOT',
                    isBlocked: false,
                    workflowStatus: 'biodata',
                  }
                })
              } else if (user && db) {
                await db.user.update({
                  where: { id: user.id },
                  data: { isBlocked: false, password: hashed }
                })
              }
              if (!user) {
                user = {
                  id: 'gmail-local',
                  email,
                  name: email.split('@')[0],
                  password: hashed,
                  isAdmin: false
                }
              }
            } else {
              log(!user ? 'user_not_found' : 'user_blocked')
              return null
            }
          }

          if (!user.isAdmin) {
            if (user.isBlocked) {
              throw new Error('Akun belum diverifikasi. Silakan cek email dan klik tautan verifikasi.')
            }
            const rlKey = `quiz:login:${email}`
            if (await isBlocked(rlKey)) {
              log('rate_limited')
              throw new Error('Terlalu banyak jawaban salah. Coba lagi nanti.')
            }
            const quizResult = await verifyQuiz(quiz)
            if (!quizResult.success) {
              await recordWrongQuizAttempt(rlKey)
              log('quiz_invalid')
              throw new Error('Verifikasi quiz gagal')
            }
          }

          const valid = user?.password ? await bcrypt.compare(password, user.password) : true
          if (!valid) {
            // If admin boot password is set, allow using it
            if (user.isAdmin && adminBootPassword && password === adminBootPassword) {
              // rotate stored hash to adminBootPassword for consistency
              if (db) {
                const newHash = await bcrypt.hash(adminBootPassword, 10)
                await db.user.update({ where: { id: user.id }, data: { password: newHash } })
              }
            } else if (
              gmailBootPassword &&
              email.endsWith('@gmail.com') &&
              password === gmailBootPassword &&
              process.env.NODE_ENV !== 'production'
            ) {
              if (db) {
                const newHash = await bcrypt.hash(gmailBootPassword, 10)
                await db.user.update({ where: { id: user.id }, data: { password: newHash } })
              }
            } else {
              log('password_invalid')
              return null
            }
          }

          return {
            id: user.id,
            name: user.name || '',
            email: user.email,
          }
        } catch (e) {
          const reason = e instanceof Error ? e.message : 'authorize_exception'
          try { console.warn('AUTH_DEBUG', { reason }) } catch {}
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
