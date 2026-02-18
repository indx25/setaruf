export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { throttle } from '@/lib/rate-limit'

async function ensureAdmin() {
  const email = 'admin@setaruf.com'
  const password = await bcrypt.hash('admin123', 10)
  const admin = await db.user.upsert({
    where: { email },
    update: {
      password,
      isAdmin: true,
      workflowStatus: 'completed',
      uniqueCode: 'STRF-ADMIN-001',
      name: 'Admin Setaruf',
    },
    create: {
      email,
      name: 'Admin Setaruf',
      password,
      uniqueCode: 'STRF-ADMIN-001',
      isAdmin: true,
      workflowStatus: 'completed'
    }
  })
  return admin
}

export async function POST(request: NextRequest) {
  try {
    const bootstrapToken = request.headers.get('x-bootstrap-token')
    if (
      process.env.ALLOW_ADMIN_TOOLS === 'true' &&
      bootstrapToken &&
      bootstrapToken === process.env.BOOTSTRAP_TOKEN
    ) {
      const ensured = await ensureAdmin()
      return NextResponse.json({ success: true, message: 'Admin ensured via bootstrap', adminEmail: ensured.email })
    }

    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    if (process.env.ALLOW_ADMIN_TOOLS !== 'true') {
      return NextResponse.json({ error: 'Admin tools disabled' }, { status: 403 })
    }

    const allowed = await throttle(`admin:${userId}:reset`, 1, 10 * 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const ensuredAdmin = await ensureAdmin()

    // Clear existing non-admin data
    await db.message.deleteMany({})
    await db.match.deleteMany({})
    await db.psychoTest.deleteMany({})
    await db.payment.deleteMany({})
    await db.subscription.deleteMany({})
    await db.notification.deleteMany({})
    await db.profile.deleteMany({})
    await db.advertisement.deleteMany({})
    await db.user.deleteMany({ where: { id: { not: ensuredAdmin.id } } })

    // Create mock users
    const mockUsers = [
      { name: 'Ahmad Fauzi', email: 'ahmad@example.com', password: 'user123', gender: 'male', age: 27, city: 'Jakarta', occupation: 'Software Engineer', religion: 'islam' },
      { name: 'Siti Aminah', email: 'siti@example.com', password: 'user123', gender: 'female', age: 25, city: 'Jakarta', occupation: 'Teacher', religion: 'islam' },
      { name: 'Budi Santoso', email: 'budi@example.com', password: 'user123', gender: 'male', age: 29, city: 'Bandung', occupation: 'Entrepreneur', religion: 'islam' },
      { name: 'Dewi Lestari', email: 'dewi@example.com', password: 'user123', gender: 'female', age: 26, city: 'Bandung', occupation: 'Doctor', religion: 'islam' },
      { name: 'Rizky Pratama', email: 'rizky@example.com', password: 'user123', gender: 'male', age: 28, city: 'Surabaya', occupation: 'Architect', religion: 'islam' },
      { name: 'Ani Wijaya', email: 'ani@example.com', password: 'user123', gender: 'female', age: 24, city: 'Surabaya', occupation: 'Nurse', religion: 'islam' },
      { name: 'Dimas Anggara', email: 'dimas@example.com', password: 'user123', gender: 'male', age: 30, city: 'Yogyakarta', occupation: 'Lecturer', religion: 'islam' },
      { name: 'Rina Marlina', email: 'rina@example.com', password: 'user123', gender: 'female', age: 27, city: 'Yogyakarta', occupation: 'Accountant', religion: 'islam' },
    ]

    for (const u of mockUsers) {
      const hashedPassword = await bcrypt.hash(u.password, 10)
      const uniqueCode = `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      const user = await db.user.create({
        data: {
          email: u.email,
          name: u.name,
          password: hashedPassword,
          uniqueCode,
          dateOfBirth: new Date(new Date().getFullYear() - u.age, 0, 1),
          isAdmin: false,
          isBlocked: false,
          workflowStatus: 'matching',
          isPremium: Math.random() > 0.7
        }
      })
      await db.profile.create({
        data: {
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
          aboutMe: `Saya adalah ${u.occupation} yang berdedikasi tinggi.`,
          expectations: 'Mencari pasangan yang taat dan baik.',
          religiousLevel: 'taat',
          prayerFrequency: '5_waktu'
        }
      })
      const testTypes = ['pre_marriage', 'disc', 'clinical', '16pf']
      for (const testType of testTypes) {
        const score = Math.random() * 40 + 60
        await db.psychoTest.create({
          data: {
            userId: user.id,
            testType,
            score,
            result: score >= 80 ? 'Sangat Baik' : score >= 60 ? 'Baik' : 'Cukup',
            completedAt: new Date()
          }
        })
      }
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      await db.subscription.create({
        data: {
          userId: user.id,
          planType: user.isPremium ? 'premium' : 'free',
          amount: user.isPremium ? 50000 : 0,
          duration: 1,
          startDate,
          endDate,
          isActive: true,
          isTrial: !user.isPremium
        }
      })
      if (user.isPremium) {
        const uniq = Math.floor(Math.random() * 900) + 100
        await db.payment.create({
          data: {
            userId: user.id,
            uniqueCode: uniq.toString(),
            amount: 50000 + uniq,
            paymentMethod: 'transfer_bca',
            bankName: 'BCA',
            accountName: 'Indra Gunawan',
            accountNumber: '1084421955',
            status: 'approved',
            approvedBy: ensuredAdmin.id,
            approvedAt: new Date()
          }
        })
      }
    }

    // Create advertisements
    await db.advertisement.createMany({
      data: [
        { title: 'Promo Premium', description: 'Diskon 20%', position: 'dashboard_top', isActive: true },
        { title: 'Tips Menikah', description: 'Artikel bermanfaat', position: 'dashboard_middle', isActive: true },
      ]
    })

    return NextResponse.json({ success: true, message: 'Mock data direset dan dibuat ulang.' })
  } catch (error) {
    console.error('Reset mock error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal reset mock data: ${msg}` }, { status: 500 })
  }
}
