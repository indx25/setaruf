export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { throttle } from '@/lib/rate-limit'

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function slugify(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.') }

const maleFirst = ['Ahmad', 'Budi', 'Dimas', 'Fauzi', 'Rizky', 'Ilham', 'Wahyu', 'Naufal', 'Lukman', 'Teguh', 'Hendra', 'Arif', 'Bagus', 'Fajar', 'Yoga']
const femaleFirst = ['Aisyah', 'Bella', 'Citra', 'Dewi', 'Nadia', 'Rani', 'Hana', 'Intan', 'Maya', 'Putri', 'Laras', 'Salsabila', 'Zahra', 'Tia', 'Nisa']
const lastNames = ['Saputra', 'Wijaya', 'Pratama', 'Mahendra', 'Ramadhani', 'Halim', 'Santoso', 'Permata', 'Nurhalim', 'Hidayat']
const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Yogyakarta', 'Depok', 'Tangerang', 'Bekasi', 'Bogor', 'Malang']
const provinces = ['DKI Jakarta', 'Jawa Barat', 'Jawa Timur', 'Jawa Tengah', 'DIY', 'Jawa Barat', 'Banten', 'Jawa Barat', 'Jawa Barat', 'Jawa Timur']
const occupations = ['Software Engineer', 'Guru', 'Desainer', 'Perawat', 'Akuntan', 'Marketing', 'Wiraswasta', 'Konsultan', 'Mahasiswa', 'Barista', 'Analis Data', 'Arsitek', 'Dokter', 'Fotografer']
const religions = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu']

export async function GET() {
  try {
    const enabled = process.env.ALLOW_ADMIN_TOOLS === 'true'
    return NextResponse.json(
      {
        error: 'Use POST method',
        note: 'Endpoint ini membutuhkan POST, admin session, dan ALLOW_ADMIN_TOOLS=true',
        allowAdminTools: enabled
      },
      { status: enabled ? 405 : 403 }
    )
  } catch {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: adminId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })

    if (process.env.ALLOW_ADMIN_TOOLS !== 'true') {
      return NextResponse.json({ error: 'Admin tools disabled' }, { status: 403 })
    }

    const allowed = await throttle(`admin:${adminId}:seed-complete-30`, 2, 10 * 60_000)
    if (!allowed) return NextResponse.json({ error: 'Rate limit. Coba lagi nanti.' }, { status: 429 })

    const count = 30
    const passwordHash = await bcrypt.hash('user123', 10)

    let created = 0
    const createdUserIds: string[] = []

    for (let i = 0; i < count; i++) {
      const isMale = Math.random() < 0.5
      const first = pick(isMale ? maleFirst : femaleFirst)
      const last = pick(lastNames)
      const fullName = `${first} ${last}`
      const emailSlug = `${slugify(fullName)}.${Date.now().toString(36)}.${i}`
      const email = `${emailSlug}@sample.setaruf.id`
      const uniqueCode = `SET-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      const gender = isMale ? 'male' : 'female'
      const age = randInt(21, 40)
      const cityIdx = randInt(0, cities.length - 1)
      const city = cities[cityIdx]
      const province = provinces[cityIdx]
      const occupation = pick(occupations)
      const religion = pick(religions)
      const instagramHandle = slugify(fullName).replace(/\./g, '_')
      const whatsapp = `08${randInt(1111, 9999)}${randInt(1111, 9999)}${randInt(10, 99)}`
      const quote = 'Hidup sederhana, niat baik, dan terus belajar'

      const user = await db.user.create({
        data: {
          email,
          password: passwordHash,
          name: fullName,
          uniqueCode,
          workflowStatus: 'matching',
          isBlocked: false,
          isPremium: Math.random() < 0.3
        }
      })

      createdUserIds.push(user.id)

      const dob = new Date()
      dob.setFullYear(dob.getFullYear() - age)
      dob.setMonth(randInt(0, 11))
      dob.setDate(randInt(1, 28))

      await db.profile.create({
        data: {
          userId: user.id,
          fullName,
          initials: fullName.split(' ').map(n => n[0]).join('').toUpperCase(),
          gender,
          age,
          dateOfBirth: dob,
          placeOfBirth: city,
          nationality: 'Indonesia',
          city,
          province,
          country: 'Indonesia',
          education: pick(['SMA', 'D3', 'S1', 'S2']),
          occupation,
          company: pick(['PT Nusantara', 'CV Mandiri', 'Rumah Sakit Sehat', 'Universitas Bhakti', 'Agensi Kreatif']),
          income: pick(['<5jt', '5-10jt', '10-20jt', '>20jt']),
          workplace: city,
          height: randInt(155, 185),
          weight: randInt(45, 85),
          bodyType: pick(['slim', 'average', 'athletic']),
          skinColor: pick(['sawo matang', 'putih', 'kuning langsat']),
          faceShape: pick(['oval', 'round', 'square']),
          religion,
          religiousLevel: pick(['taat', 'sedang', 'pemula']),
          prayerFrequency: pick(['5_waktu', '3-4_waktu', 'kadang']),
          maritalStatus: 'single',
          childrenCount: 0,
          fatherName: pick(['Sutrisno', 'Halim', 'Hartono', 'Samsul']),
          fatherOccupation: pick(['PNS', 'Wiraswasta', 'Petani', 'Karyawan']),
          motherName: pick(['Sukma', 'Rohani', 'Siti', 'Sri']),
          motherOccupation: pick(['Ibu Rumah Tangga', 'Wiraswasta', 'Guru']),
          siblingsCount: randInt(0, 4),
          hobbies: pick(['membaca, bersepeda', 'memasak, traveling', 'fotografi, menulis']),
          interests: pick(['teknologi', 'pendidikan', 'kesehatan', 'bisnis']),
          preferredAgeMin: randInt(22, 26),
          preferredAgeMax: randInt(28, 40),
          preferredEducation: pick(['SMA', 'D3', 'S1']),
          preferredOccupation: pick(['Profesional', 'Wiraswasta', 'Akademisi']),
          preferredLocation: pick(['Jawa', 'Sumatera', 'Kalimantan', 'Sulawesi']),
          preferredReligionLevel: pick(['taat', 'sedang']),
          healthCondition: pick(['sehat', 'mata minus ringan', 'asma ringan']),
          disabilities: null,
          photoUrl: null,
          ktpUrl: null,
          aboutMe: `Saya ${occupation} di ${city}. Senang ${pick(['membaca', 'berolahraga', 'berdiskusi', 'menulis'])} dan menghargai proses taaruf.`,
          expectations: 'Membangun keluarga sakinah, mawaddah, warahmah dengan komunikasi baik.',
          instagram: `https://instagram.com/${instagramHandle}`,
          whatsapp,
          quote
        }
      })

      const tests = ['pre_marriage', 'disc', 'clinical', '16pf']
      for (const t of tests) {
        const score = randInt(70, 95)
        const answers = JSON.stringify({ q1: pick(['A', 'B', 'C']), q2: pick(['A', 'B', 'C']), q3: pick(['A', 'B', 'C']) })
        await db.psychoTest.create({
          data: {
            userId: user.id,
            testType: t,
            score,
            result: score >= 88 ? 'Sangat Baik' : score >= 78 ? 'Baik' : 'Cukup',
            answers,
            completedAt: new Date()
          }
        })
      }
      created++
    }

    return NextResponse.json({ success: true, created, note: '30 sample users lengkap dibuat (profil, psikotes lengkap, kontak).' })
  } catch (error) {
    console.error('Seed complete 30 error:', error)
    return NextResponse.json({ error: 'Gagal membuat sample lengkap' }, { status: 500 })
  }
}
