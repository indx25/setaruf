export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { throttle } from '@/lib/rate-limit'

const maleNames = ['Ahmad', 'Budi', 'Dimas', 'Eko', 'Fajar', 'Gilang', 'Hendra', 'Ilham', 'Joko', 'Kurnia', 'Lutfi', 'Marlan', 'Naufal', 'Omar', 'Pandu']
const femaleNames = ['Aisyah', 'Bella', 'Citra', 'Dewi', 'Eka', 'Fani', 'Gita', 'Hana', 'Intan', 'Julia', 'Kartika', 'Lia', 'Maya', 'Nadia', 'Olivia', 'Putri']
const lastNames = ['Saputra', 'Wijaya', 'Pratama', 'Mahendra', 'Fauzan', 'Ramadhani', 'Siregar', 'Halim', 'Santoso', 'Permata']
const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Yogyakarta', 'Depok', 'Tangerang', 'Bekasi', 'Bogor', 'Malang']
const occupations = ['Software Engineer', 'Teacher', 'Designer', 'Nurse', 'Accountant', 'Marketing', 'Entrepreneur', 'Consultant', 'Student', 'Barista']
const religions = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu']

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })

    if (process.env.ALLOW_ADMIN_TOOLS !== 'true') {
      return NextResponse.json({ error: 'Admin tools disabled' }, { status: 403 })
    }

    const allowed = await throttle(`admin:${adminId}:seed-random`, 2, 10 * 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const body = await request.json().catch(() => ({}))
    const count = Math.min(Math.max(Number(body.count || 30), 1), 100)
    const passwordHash = await bcrypt.hash('user123', 10)

    let created = 0
    for (let i = 0; i < count; i++) {
      const isMale = Math.random() < 0.5
      const first = pick(isMale ? maleNames : femaleNames)
      const last = pick(lastNames)
      const fullName = `${first} ${last}`
      const email = `sample${Date.now()}${i}@example.com`
      const uniqueCode = `SET${Math.random().toString(36).substring(2, 6).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
      const gender = isMale ? 'male' : 'female'
      const age = randInt(20, 40)
      const city = pick(cities)
      const occupation = pick(occupations)
      const religion = pick(religions)

      const user = await db.user.create({
        data: {
          email,
          password: passwordHash,
          name: fullName,
          uniqueCode,
          isBlocked: false,
          isPremium: Math.random() < 0.2
        }
      })

      await db.profile.create({
        data: {
          userId: user.id,
          fullName,
          gender,
          age,
          city,
          occupation,
          religion,
          quote: 'Tetap semangat dan bersyukur setiap hari'
        }
      })

      const tests = ['pre_marriage', 'disc', 'clinical', '16pf']
      for (const t of tests) {
        await db.psychoTest.create({
          data: {
            userId: user.id,
            testType: t,
            score: randInt(40, 95),
            result: 'OK'
          }
        })
      }
      created++
    }

    return NextResponse.json({ success: true, created })
  } catch (error) {
    return NextResponse.json({ error: 'Gagal membuat sample data' }, { status: 500 })
  }
}
