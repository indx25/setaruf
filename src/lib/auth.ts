import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { verifyQuiz } from '@/lib/quiz'
import { isBlocked, recordWrongQuizAttempt } from '@/lib/rate-limit'

const shouldDebug = process.env.AUTH_DEBUG === 'true' || process.env.NODE_ENV !== 'production'

let adapter: any = undefined
let db: any = undefined
if (process.env.DATABASE_URL) {
  const { PrismaAdapter } = require('@next-auth/prisma-adapter')
  const mod = require('@/lib/db')
  db = mod.db
  const base = PrismaAdapter(db)
  adapter = {
    ...base,
    async createUser(data: any) {
      const code =
        `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const sanitized = { ...data }
      if ('image' in sanitized) delete (sanitized as any).image
      if ('emailVerified' in sanitized) delete (sanitized as any).emailVerified
      return base.createUser({ ...sanitized, uniqueCode: code })
    }
  }
}

export const authOptions: NextAuthOptions = {
  trustHost: true,
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
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try { if (shouldDebug) console.warn('NEXTAUTH_SIGNIN', { provider: account?.provider, email: user?.email }) } catch {}
      try {
        try { if (shouldDebug) console.warn('AUTO_LINK_START', { provider: account?.provider, email: user?.email }) } catch {}
        if (db && user?.email) {
          const sameEmail = await db.user.findUnique({ where: { email: user.email } })
          if (sameEmail && (user as any).id !== sameEmail.id) {
            ;(user as any).id = sameEmail.id
            try { if (shouldDebug) console.warn('AUTO_LINK_SAME_EMAIL', { sameEmailId: sameEmail.id }) } catch {}
          }
        }
        if (db && account && account.provider !== 'credentials' && user?.email) {
          const existingUser = await db.user.findUnique({
            where: { email: user.email }
          })
          if (existingUser) {
            const exists = await db.account.findFirst({
              where: {
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            })
            if (!exists) {
              await db.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token ?? null,
                  refresh_token: account.refresh_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                  session_state: (account as any).session_state ?? null
                }
              })
              try { if (shouldDebug) console.warn('AUTO_LINK_CREATED_ACCOUNT', { provider: account.provider, userId: existingUser.id }) } catch {}
            }
          }
        }
        try { if (shouldDebug) console.warn('AUTO_LINK_END', { provider: account?.provider, email: user?.email }) } catch {}
      } catch (e) {
        try { if (shouldDebug) console.warn('AUTO_LINK_ERROR', e) } catch {}
      }
      return true
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id as string
      }
      return token
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        ;(session.user as any).id = token.id
        if (db) {
          try {
            const uid = token.id as string
            const profile = await db.profile.findUnique({
              where: { userId: uid }
            })
            if (!profile) {
              await db.profile.create({
                data: {
                  userId: uid,
                  fullName: session.user.name || '',
                  age: 0,
                  maritalStatus: 'single'
                }
              })
            }
          } catch (e) {
            try { console.warn('SESSION_PROFILE_CREATE_ERROR', e) } catch {}
          }
        }
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      try {
        if (db) {
          await db.profile.create({
            data: {
              userId: user.id,
              fullName: user.name || '',
              gender: null,
              religion: null,
              age: 0,
              maritalStatus: 'single'
            }
          })
        }
      } catch (e) {
        try { if (shouldDebug) console.warn('CREATE_USER_PROFILE_ERROR', e) } catch {}
      }
    },
    async error(message) {
      try { if (shouldDebug) console.warn('NEXTAUTH_EVENT_ERROR', message) } catch {}
    },
    async signIn(message) {
      try { if (shouldDebug) console.warn('NEXTAUTH_EVENT_SIGNIN', message?.account?.provider) } catch {}
    },
    async linkAccount(message) {
      try { if (shouldDebug) console.warn('NEXTAUTH_EVENT_LINKED', { provider: message?.account?.provider, userId: message?.user?.id }) } catch {}
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
}
