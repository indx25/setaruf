import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Load profile
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const profile = await db.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ profile: null })
    }
    const { phone: _phone, email: _email, initials: _initials, ...safeProfile } = profile as any
    return NextResponse.json({ profile: safeProfile })

  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil biodata' },
      { status: 500 }
    )
  }
}

// POST - Save or update profile
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await request.json()
    delete (data as any).phone
    delete (data as any).email
    delete (data as any).initials
    // Buat payload yang aman hanya berisi kolom yang ada di schema utama (PostgreSQL)
    const allowedKeys = new Set([
      'fullName',
      'gender',
      'dateOfBirth',
      'nationality',
      'city',
      'province',
      'country',
      'education',
      'occupation',
      'company',
      'income',
      'workplace',
      'height',
      'weight',
      'bodyType',
      'skinColor',
      'faceShape',
      'religion',
      'religiousLevel',
      'prayerFrequency',
      'quranAbility',
      'maritalStatus',
      'childrenCount',
      'fatherName',
      'fatherOccupation',
      'motherName',
      'motherOccupation',
      'siblingsCount',
      'hobbies',
      'interests',
      'preferredAgeMin',
      'preferredAgeMax',
      'preferredEducation',
      'preferredOccupation',
      'preferredLocation',
      'preferredReligionLevel',
      'healthCondition',
      'disabilities',
      'photoUrl',
      'ktpUrl',
      'aboutMe',
      'expectations',
      'quote'
    ])
    const sanitized: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      if (allowedKeys.has(key)) sanitized[key] = value
    }
    // Normalisasi tipe
    if (typeof sanitized.quote === 'string') {
      sanitized.quote = sanitized.quote.slice(0, 100)
    }
    if (sanitized.dateOfBirth) {
      const dob = new Date(sanitized.dateOfBirth as string)
      sanitized.dateOfBirth = isNaN(dob.getTime()) ? undefined : dob
    }
    if (sanitized.childrenCount !== undefined) sanitized.childrenCount = Number(sanitized.childrenCount)
    if (sanitized.preferredAgeMin !== undefined) sanitized.preferredAgeMin = Number(sanitized.preferredAgeMin)
    if (sanitized.preferredAgeMax !== undefined) sanitized.preferredAgeMax = Number(sanitized.preferredAgeMax)

    // Cek apakah profile sudah ada
    const existingProfile = await db.profile.findUnique({
      where: { userId }
    })

    let profile

    if (existingProfile) {
      // Update existing profile
      profile = await db.profile.update({
        where: { userId },
        data: {
          ...sanitized,
          age: sanitized.dateOfBirth ? Math.floor((new Date().getTime() - new Date(sanitized.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : undefined,
          updatedAt: new Date(),
        }
      })
    } else {
      // Create new profile
      profile = await db.profile.create({
        data: {
          userId,
          ...sanitized,
          age: sanitized.dateOfBirth ? Math.floor((new Date().getTime() - new Date(sanitized.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : undefined,
        }
      })

      // Update user workflow status
      await db.user.update({
        where: { id: userId },
        data: { workflowStatus: 'psychotest' }
      })
    }
    if (sanitized.photoUrl) {
      await db.user.update({
        where: { id: userId },
        data: { avatar: sanitized.photoUrl }
      })
    }

    const { phone: _phone, email: _email, ...safeProfile } = profile as any
    return NextResponse.json({
      success: true,
      message: 'Biodata berhasil disimpan',
      profile: safeProfile
    })

  } catch (error) {
    console.error('Save profile error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan biodata' },
      { status: 500 }
    )
  }
}
