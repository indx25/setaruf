export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { throttle } from '@/lib/rate-limit'

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeCode() {
  return `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

const maleNames = [
  'Ahmad Fauzi','Budi Santoso','Rizky Pratama','Dimas Saputra','Arya Nugraha','Fajar Ramadhan','Hadi Putra','Yoga Prasetyo','Ilham Kurniawan','Naufal Hidayat',
  'Rafi Maulana','Farhan Wijaya','Andi Gunawan','Bagus Pamungkas','Galih Setiawan','Rendy Prakoso','Yusuf Aditya','Jojo Permana','Krisna Wibowo','Wahyu Hermawan',
  'Reza Firmansyah','Eko Pranoto','Alif Kurnia','Zaki Pawitra','Dwi Nugroho'
]
const femaleNames = [
  'Siti Aminah','Dewi Lestari','Ani Rahmawati','Rina Sari','Nadia Putri','Aulia Fitri','Maya Anindita','Vina Kartika','Intan Pramesti','Nisa Ramadhani',
  'Bella Safitri','Ayu Puspita','Citra Maharani','Fadhila Khairunnisa','Hana Pratiwi','Kezia Anindya','Laila Salsabila','Mutiara Zahra','Nurul Hidayah','Putri Ayuningtyas',
  'Rizka Amalia','Shafa Nabila','Tasya Kirana','Wulan Sari','Zahra Aqila'
]
const cities = ['Jakarta','Bandung','Surabaya','Yogyakarta','Semarang','Depok','Bekasi','Bogor','Tangerang','Malang','Solo','Makassar','Palembang','Banjarmasin']
const occupations = ['Software Engineer','Designer','Dokter','Guru','Akuntan','Marketing','Product Manager','Analis Data','Peneliti','Wiraswasta','Karyawan']
const religions = ['islam','kristen','katolik']
const edu = ['SMA','D3','S1','S2']

async function createPsychotests(userId: string) {
  const testTypes = ['pre_marriage','disc','clinical','16pf']
  for (const t of testTypes) {
    const score = randInt(40, 95)
    const result = score >= 85 ? 'Sangat cocok' : score >= 60 ? 'Cukup cocok' : 'Perlu pertimbangan'
    await db.psychoTest.create({
      data: {
        userId,
        testType: t,
        score,
        result,
        answers: JSON.stringify({}),
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id as string | undefined
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allowed = await throttle(`admin:${adminId}:seed-sample`, 1, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const body = await request.json().catch(() => ({}))
    const total = typeof body.total === 'number' && body.total > 0 ? Math.min(body.total, 200) : 50
    const passwordHash = await bcrypt.hash('user123', 10)

    const createdIds: string[] = []
    for (let i = 0; i < total; i++) {
      const gender = i % 2 === 0 ? 'male' : 'female'
      const name = gender === 'male' ? pick(maleNames) : pick(femaleNames)
      const email = `sample${Date.now().toString(36)}${i}@setaruf.test`
      const city = pick(cities)
      const occupation = pick(occupations)
      const religion = pick(religions)
      const age = randInt(20, 38)
      const dob = new Date()
      dob.setFullYear(dob.getFullYear() - age)
      dob.setMonth(randInt(0, 11))
      dob.setDate(randInt(1, 28))

      const user = await db.user.create({
        data: {
          email,
          name,
          password: passwordHash,
          uniqueCode: makeCode(),
          dateOfBirth: dob,
          isBlocked: false,
          workflowStatus: 'matching',
          isPremium: Math.random() < 0.3,
          avatar: undefined,
        }
      })

      await db.profile.create({
        data: {
          userId: user.id,
          fullName: name,
          initials: name.split(' ').map(n => n[0]).join('').toUpperCase(),
          gender,
          age,
          dateOfBirth: dob,
          city,
          occupation,
          religion,
          education: pick(edu),
          maritalStatus: 'single',
          aboutMe: `Saya ${occupation} yang menetap di ${city}.`,
          expectations: 'Mencari pasangan yang sevisi.',
          religiousLevel: 'taat',
          prayerFrequency: '5_waktu',
          whatsapp: `08${randInt(111111111, 999999999)}`,
          instagram: `${name.split(' ')[0].toLowerCase()}_${randInt(100,999)}`,
          quote: 'Hidup adalah perjalanan menuju kebaikan.',
          photoUrl: undefined,
        }
      })

      await createPsychotests(user.id)

      {
        const isPrem = user.isPremium
        const months = isPrem ? pick([1,3,6,12]) : pick([0,1])
        const start = new Date()
        const end = new Date(start)
        if (months > 0) end.setMonth(end.getMonth() + months)
        const amount = isPrem ? pick([49000, 99000, 199000]) : 0
        await db.subscription.create({
          data: {
            userId: user.id,
            planType: isPrem ? 'premium' : 'free',
            amount,
            duration: months,
            startDate: start,
            endDate: isPrem ? end : null,
            isActive: isPrem ? true : Math.random() < 0.5,
            isTrial: !isPrem,
          }
        })
        if (isPrem || Math.random() < 0.3) {
          const banks = ['BCA','Mandiri','BNI','BRI']
          const methods = ['bank_transfer','virtual_account','qris']
          const status = pick(['approved','pending','rejected'])
          await db.payment.create({
            data: {
              userId: user.id,
              uniqueCode: `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
              amount: amount || pick([29000, 49000, 99000]),
              paymentMethod: pick(methods),
              bankName: pick(banks),
              accountName: user.name || 'User',
              accountNumber: `00${randInt(100000000, 999999999)}`,
              status,
            }
          })
        }
      }

      createdIds.push(user.id)
    }

    const males = await db.user.findMany({ where: { id: { in: createdIds }, profile: { gender: 'male' } }, include: { profile: true } })
    const females = await db.user.findMany({ where: { id: { in: createdIds }, profile: { gender: 'female' } }, include: { profile: true } })
    let matchCreated = 0
    for (const m of males) {
      const picks = [...females].sort(() => Math.random() - 0.5).slice(0, 2)
      for (const f of picks) {
        if (m.id === f.id) continue
        try {
          await db.match.create({
            data: {
              requesterId: m.id,
              targetId: f.id,
              matchPercentage: randInt(35, 95),
              aiReasoning: 'Rekomendasi sample data.',
              status: Math.random() < 0.5 ? 'approved' : 'pending',
              step: Math.random() < 0.5 ? 'profile_viewed' : 'profile_request'
            }
          })
          matchCreated++
        } catch {}
      }
    }

    const subsCount = await db.subscription.count({ where: { userId: { in: createdIds } } })
    const paymentsCount = await db.payment.count({ where: { userId: { in: createdIds } } })
    return NextResponse.json({ success: true, users: createdIds.length, matches: matchCreated, subscriptions: subsCount, payments: paymentsCount })
  } catch (error) {
    console.error('Seed sample error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat membuat sample data' }, { status: 500 })
  }
}
