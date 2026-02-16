import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { verifyRecaptchaToken } from '@/lib/recaptcha'

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
        recaptchaToken: { label: 'recaptchaToken', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const email = String(credentials?.email || '').trim().toLowerCase()
          const password = String(credentials?.password || '')
          const recaptchaToken = String(credentials?.recaptchaToken || '')

          const recaptchaResult = await verifyRecaptchaToken(recaptchaToken)
          if (!recaptchaResult.success) {
            return null
          }

          const user = await db.user.findUnique({
            where: { email },
          })

          if (!user || user.isBlocked) {
            return null
          }

          const valid = await bcrypt.compare(password, user.password)
          if (!valid) {
            return null
          }

          return {
            id: user.id,
            name: user.name || '',
            email: user.email,
          }
        } catch {
          return null
        }
      }
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
