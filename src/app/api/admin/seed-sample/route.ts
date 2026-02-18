export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

type SampleUser = {
  name: string
  email: string
  password: string
  gender: 'male' | 'female'
  age: number
  city: string
  occupation: string
  religion: string
  premium: boolean
  blocked?: boolean
}

function uc() {
  return `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

const baseSamples: SampleUser[] = [
  { name: 'Ahmad Fauzi', email: 'ahmad.fauzi@sample.setaruf.id', password: 'Rahasia123!', gender: 'male', age: 27, city: 'Jakarta', occupation: 'Software Engineer', religion: 'islam', premium: true },
  { name: 'Siti Aminah', email: 'siti.aminah@sample.setaruf.id', password: 'Rahasia123!', gender: 'female', age: 25, city: 'Jakarta', occupation: 'Teacher', religion: 'islam', premium: false },
  { name: 'Budi Santoso', email: 'budi.santoso@sample.setaruf.id', password: 'Rahasia123!', gender: 'male', age: 29, city: 'Bandung', occupation: 'Entrepreneur', religion: 'islam', premium: true },
  { name: 'Dewi Lestari', email: 'dewi.lestari@sample.setaruf.id', password: 'Rahasia123!', gender: 'female', age: 26, city: 'Bandung', occupation: 'Doctor', religion: 'islam', premium: true },
  { name: 'Rizky Pratama', email: 'rizky.pratama@sample.setaruf.id', password: 'Rahasia123!', gender: 'male', age: 28, city: 'Surabaya', occupation: 'Architect', religion: 'islam', premium: false },
  { name: 'Ani Wijaya', email: 'ani.wijaya@sample.setaruf.id', password: 'Rahasia123!', gender: 'female', age: 24, city: 'Surabaya', occupation: 'Nurse', religion: 'islam', premium: false },
  { name: 'Dimas Anggara', email: 'dimas.anggara@sample.setaruf.id', password: 'Rahasia123!', gender: 'male', age: 30, city: 'Yogyakarta', occupation: 'Lecturer', religion: 'islam', premium: true },
  { name: 'Rina Marlina', email: 'rina.marlina@sample.setaruf.id', password: 'Rahasia123!', gender: 'female', age: 27, city: 'Yogyakarta', occupation: 'Accountant', religion: 'islam', premium: false },
  { name: 'Farhan Hakim', email: 'farhan.hakim@sample.setaruf.id', password: 'Rahasia123!', gender: 'male', age: 31, city: 'Depok', occupation: 'Data Analyst', religion: 'islam', premium: true },
  { name: 'Putri Ramadhani', email: 'putri.ramadhani@sample.setaruf.id', password: 'Rahasia123!', gender: 'female', age: 23, city: 'Bekasi', occupation: 'Content Creator', religion: 'islam', premium: false },
]

const namesMale = ['Andi Saputra', 'Fajar Maulana', 'Gilang Nugraha', 'Hendra Pratama', 'Irfan Ramadhan', 'Joko Widodo', 'Kevin Aditya', 'Lukman Hakim', 'Mahendra Putra', 'Naufal Rizky', 'Omar Alif', 'Prasetyo Ari', 'Qomarudin', 'Raffi Ahmad', 'Samuel Putra', 'Teguh Wicaksono', 'Umar Faruq', 'Vino G Bastian', 'Wahyu Kurniawan', 'Yoga Pramana']
const namesFemale = ['Aisyah Rahma', 'Bella Safira', 'Citra Kirana', 'Diana Puspita', 'Eka Lestari', 'Fani Putri', 'Gita Savitri', 'Hana Zahra', 'Intan Kusuma', 'Jihan Audy', 'Kartika Putri', 'Larasati Dewi', 'Maya Sari', 'Nia Ramadhani', 'Oktavia Dwi', 'Putri Ayu', 'Qory Sandyorini', 'Reni Marlina', 'Sari Ayu', 'Tiara Andini']
const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Semarang', 'Depok', 'Bekasi', 'Bogor', 'Malang', 'Makassar']
const occupations = ['Software Engineer', 'Teacher', 'Doctor', 'Nurse', 'Entrepreneur', 'Architect', 'Lecturer', 'Accountant', 'Designer', 'Photographer', 'Journalist', 'Banker', 'Lawyer', 'Civil Engineer', 'Product Manager', 'Marketing Specialist']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const usersSeed: SampleUser[] = [...baseSamples]

    // Generate additional 40 realistic users with varied conditions
    for (let i = 0; i < 40; i++) {
      const isMale = i % 2 === 0
      const name = isMale ? namesMale[i % namesMale.length] : namesFemale[i % namesFemale.length]
      const slug = name.toLowerCase().replace(/\s+/g, '.')
      const email = `${slug}.${i + 1}@sample.setaruf.id`
      const password = 'User123!'
      const age = 20 + Math.floor(Math.random() * 20) // 20-39
      const city = cities[i % cities.length]
      const occupation = occupations[i % occupations.length]
      const premium = Math.random() > 0.5
      const blocked = Math.random() < 0.15
      usersSeed.push({
        name, email, password, gender: isMale ? 'male' : 'female', age, city, occupation, religion: 'islam', premium, blocked
      })
    }

    const createdUsers: { id: string, email: string }[] = []

    for (const u of usersSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10)
      const uniqueCode = uc()
      const dateOfBirth = new Date(new Date().getFullYear() - u.age, 0, 1)

      const user = await db.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          password: hashedPassword,
          isPremium: u.premium,
          isBlocked: !!u.blocked,
          workflowStatus: 'matching'
        },
        create: {
          email: u.email,
          name: u.name,
          password: hashedPassword,
          uniqueCode,
          dateOfBirth,
          isAdmin: false,
          isBlocked: !!u.blocked,
          isPremium: u.premium,
          workflowStatus: 'matching'
        }
      })

      createdUsers.push({ id: user.id, email: user.email })

      await db.profile.upsert({
        where: { userId: user.id },
        update: {
          fullName: u.name,
          initials: u.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          gender: u.gender,
          age: u.age,
          city: u.city,
          occupation: u.occupation,
          religion: u.religion,
          education: 'S1',
          maritalStatus: 'single',
          aboutMe: `Saya adalah ${u.occupation} yang berdedikasi.`,
          expectations: 'Mencari pasangan yang taat dan baik.',
          religiousLevel: 'taat',
          prayerFrequency: '5_waktu'
        },
        create: {
          userId: user.id,
          fullName: u.name,
          initials: u.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          gender: u.gender,
          age: u.age,
          city: u.city,
          occupation: u.occupation,
          religion: u.religion,
          education: 'S1',
          maritalStatus: 'single',
          aboutMe: `Saya adalah ${u.occupation} yang berdedikasi.`,
          expectations: 'Mencari pasangan yang taat dan baik.',
          religiousLevel: 'taat',
          prayerFrequency: '5_waktu'
        }
      })

      // Psychotests variety
      const testTypes = ['pre_marriage', 'disc', 'clinical', '16pf']
      for (const testType of testTypes) {
        const includeTest = Math.random() > 0.2 // 80% users have tests
        if (!includeTest) continue
        const score = Math.round(Math.random() * 40 + 60) // 60-100
        await db.psychoTest.create({
          data: {
            userId: user.id,
            testType,
            score,
            result: score >= 85 ? 'Sangat Baik' : score >= 70 ? 'Baik' : 'Cukup',
            completedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000)
          }
        })
      }

      // Subscription + payments
      if (u.premium) {
        const startDate = new Date()
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1)
        await db.subscription.create({
          data: {
            userId: user.id,
            planType: 'premium',
            amount: 50000,
            duration: 1,
            startDate,
            endDate,
            isActive: true,
            isTrial: false
          }
        })
        const uniq = (Math.floor(Math.random() * 900) + 100).toString()
        const status = Math.random() > 0.2 ? 'approved' : (Math.random() > 0.5 ? 'pending' : 'rejected')
        await db.payment.create({
          data: {
            userId: user.id,
            uniqueCode: uniq + user.id.substring(0, 5),
            amount: 50000 + parseInt(uniq),
            paymentMethod: 'transfer_bca',
            bankName: 'BCA',
            accountName: 'Indra Gunawan',
            accountNumber: '1084421955',
            status,
            approvedBy: status === 'approved' ? adminId : null,
            approvedAt: status === 'approved' ? new Date() : null,
            rejectedAt: status === 'rejected' ? new Date() : null
          }
        })
      } else {
        // Free plan trial
        const startDate = new Date()
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1)
        await db.subscription.create({
          data: {
            userId: user.id,
            planType: 'free',
            duration: 1,
            startDate,
            endDate,
            isActive: true,
            isTrial: true
          }
        })
      }
    }

    // Create some matches and messages among created users
    const ids = createdUsers.map(u => u.id)
    for (let i = 0; i < Math.min(12, ids.length - 1); i++) {
      const requesterId = ids[i]
      const targetId = ids[ids.length - 1 - i]
      if (requesterId === targetId) continue
      const match = await db.match.create({
        data: {
          requesterId,
          targetId,
          matchPercentage: Math.round(Math.random() * 50 + 50),
          aiReasoning: 'Kecocokan tinggi berdasarkan preferensi dan hasil psikotes.',
          status: Math.random() > 0.3 ? 'approved' : 'pending',
          step: 'chatting'
        }
      })
      // Messages
      for (let m = 0; m < 3; m++) {
        await db.message.create({
          data: {
            senderId: requesterId,
            receiverId: targetId,
            matchId: match.id,
            content: `Halo, perkenalkan saya. Ini pesan ke-${m + 1}.`
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalInserted: createdUsers.length,
      note: '50 sample users dibuat atau diperbarui, termasuk profil, psikotes, langganan, pembayaran, dan sebagian match/messages.'
    })
  } catch (error) {
    console.error('Seed sample users error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal membuat sample users: ${msg}` }, { status: 500 })
  }
}
