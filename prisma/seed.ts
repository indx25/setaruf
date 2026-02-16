import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data (optional - comment out if you want to keep existing data)
  // await prisma.message.deleteMany()
  // await prisma.match.deleteMany()
  // await prisma.psychoTest.deleteMany()
  // await prisma.payment.deleteMany()
  // await prisma.subscription.deleteMany()
  // await prisma.notification.deleteMany()
  // await prisma.profile.deleteMany()
  // await prisma.user.deleteMany()

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@setaruf.com' },
    update: {},
    create: {
      email: 'admin@setaruf.com',
      name: 'Admin Setaruf',
      password: adminPassword,
      uniqueCode: 'STRF-ADMIN-001',
      isAdmin: true,
      workflowStatus: 'completed'
    }
  })
  console.log('✅ Admin user created')

  // Create Mock Users
  const mockUsers = [
    {
      name: 'Ahmad Fauzi',
      email: 'ahmad@example.com',
      password: 'user123',
      gender: 'male',
      age: 27,
      city: 'Jakarta',
      occupation: 'Software Engineer',
      religion: 'islam'
    },
    {
      name: 'Siti Aminah',
      email: 'siti@example.com',
      password: 'user123',
      gender: 'female',
      age: 25,
      city: 'Jakarta',
      occupation: 'Teacher',
      religion: 'islam'
    },
    {
      name: 'Budi Santoso',
      email: 'budi@example.com',
      password: 'user123',
      gender: 'male',
      age: 29,
      city: 'Bandung',
      occupation: 'Entrepreneur',
      religion: 'islam'
    },
    {
      name: 'Dewi Lestari',
      email: 'dewi@example.com',
      password: 'user123',
      gender: 'female',
      age: 26,
      city: 'Bandung',
      occupation: 'Doctor',
      religion: 'islam'
    },
    {
      name: 'Rizky Pratama',
      email: 'rizky@example.com',
      password: 'user123',
      gender: 'male',
      age: 28,
      city: 'Surabaya',
      occupation: 'Architect',
      religion: 'islam'
    },
    {
      name: 'Ani Wijaya',
      email: 'ani@example.com',
      password: 'user123',
      gender: 'female',
      age: 24,
      city: 'Surabaya',
      occupation: 'Nurse',
      religion: 'islam'
    },
    {
      name: 'Dimas Anggara',
      email: 'dimas@example.com',
      password: 'user123',
      gender: 'male',
      age: 30,
      city: 'Yogyakarta',
      occupation: 'Lecturer',
      religion: 'islam'
    },
    {
      name: 'Rina Marlina',
      email: 'rina@example.com',
      password: 'user123',
      gender: 'female',
      age: 27,
      city: 'Yogyakarta',
      occupation: 'Accountant',
      religion: 'islam'
    }
  ]

  const createdUsers = []

  for (const userData of mockUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 10)
    const uniqueCode = `STRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        uniqueCode,
        dateOfBirth: new Date(new Date().getFullYear() - userData.age, 0, 1),
        isAdmin: false,
        isBlocked: false,
        workflowStatus: 'matching',
        isPremium: Math.random() > 0.7 // 30% chance to be premium
      }
    })

    // Create Profile
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: userData.name,
        initials: userData.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        gender: userData.gender,
        age: userData.age,
        city: userData.city,
        occupation: userData.occupation,
        religion: userData.religion,
        education: 'S1',
        maritalStatus: 'single',
        aboutMe: `Saya adalah ${userData.occupation} yang berdedikasi tinggi.`,
        expectations: 'Mencari pasangan yang taat dan baik.',
        religiousLevel: 'taat',
        prayerFrequency: '5_waktu'
      }
    })

    // Create Psychotests
    const testTypes = ['pre_marriage', 'disc', 'clinical', '16pf']
    for (const testType of testTypes) {
      const score = Math.random() * 40 + 60 // 60-100
      await prisma.psychoTest.create({
        data: {
          userId: user.id,
          testType,
          score,
          result: score >= 80 ? 'Sangat Baik' : score >= 60 ? 'Baik' : 'Cukup',
          completedAt: new Date()
        }
      })
    }

    // Create Subscription
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 30))
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    await prisma.subscription.create({
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

    // Create Payment for premium users
    if (user.isPremium) {
      const uniqueCode = Math.floor(Math.random() * 900) + 100
      await prisma.payment.create({
        data: {
          userId: user.id,
          uniqueCode: uniqueCode.toString(),
          amount: 50000 + uniqueCode,
          paymentMethod: 'transfer_bca',
          bankName: 'BCA',
          accountName: 'Indra Gunawan',
          accountNumber: '1084421955',
          status: 'approved',
          approvedBy: admin.id,
          approvedAt: new Date()
        }
      })
    }

    createdUsers.push(user)
    console.log(`✅ User created: ${userData.name}`)
  }

  // Create Matches (male-female pairs)
  const maleUsers = createdUsers.filter(u => (u.email.includes('ahmad') || u.email.includes('budi') || u.email.includes('rizky') || u.email.includes('dimas')))
  const femaleUsers = createdUsers.filter(u => (u.email.includes('siti') || u.email.includes('dewi') || u.email.includes('ani') || u.email.includes('rina')))

  let matchCount = 0
  for (const male of maleUsers) {
    for (const female of femaleUsers) {
      // Check if match already exists
      const existingMatch = await prisma.match.findUnique({
        where: {
          requesterId_targetId: {
            requesterId: male.id,
            targetId: female.id
          }
        }
      })

      if (existingMatch) {
        continue
      }

      // Create match from male to female
      const match = await prisma.match.create({
        data: {
          requesterId: male.id,
          targetId: female.id,
          matchPercentage: Math.random() * 30 + 60, // 60-90%
          aiReasoning: 'Kecocokan tinggi berdasarkan analisis psikotes dan kriteria yang sesuai.',
          status: Math.random() > 0.5 ? 'approved' : 'pending',
          step: Math.random() > 0.5 ? 'chatting' : 'profile_viewed'
        }
      })

      // Create some messages for chatting pairs
      if (match.step === 'chatting' && Math.random() > 0.5) {
        await prisma.message.createMany({
          data: [
            {
              senderId: male.id,
              receiverId: female.id,
              content: 'Halo, senang bertemu Anda. Saya ingin mengenal lebih lanjut.',
              isRead: true
            },
            {
              senderId: female.id,
              receiverId: male.id,
              content: 'Halo juga! Saya juga senang bisa mengenal Anda.',
              isRead: true
            }
          ]
        })
      }

      matchCount++
    }
  }

  // Create Advertisements
  const ads = [
    {
      title: 'Pernikahan Impian',
      description: 'Wujudkan pernikahan impian Anda bersama Setaruf',
      imageUrl: '/ads/wedding.jpg',
      position: 'dashboard_top'
    },
    {
      title: 'Konseling Pra-Nikah',
      description: 'Dapatkan konseling pra-nikah gratis untuk member baru',
      imageUrl: '/ads/counseling.jpg',
      position: 'dashboard_middle'
    },
    {
      title: 'Event Taaruf',
      description: 'Ikuti event taaruf offline di kota Anda',
      imageUrl: '/ads/event.jpg',
      position: 'dashboard_bottom'
    }
  ]

  for (const ad of ads) {
    const existing = await prisma.advertisement.findFirst({
      where: { title: ad.title }
    })

    if (!existing) {
      await prisma.advertisement.create({
        data: {
          ...ad,
          isActive: true
        }
      })
    }
  }

  // Create Notifications
  for (const user of createdUsers) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'welcome',
        title: 'Selamat Datang di Setaruf!',
        message: 'Mulailah perjalanan taaruf Anda menuju pernikahan yang bahagia.',
        link: '/dashboard'
      }
    })

    if (user.isPremium) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'payment_approved',
          title: 'Premium Aktif!',
          message: 'Terima kasih telah berlangganan. Nikmati fitur premium.',
          link: '/dashboard'
        }
      })
    }
  }

  console.log('✅ Advertisements created')
  console.log(`✅ Created ${matchCount} matches`)
  console.log(`✅ Created ${createdUsers.length} users with complete data`)
  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
