export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enqueueCompatibilityRecalc } from '@/lib/compatQueue'
import * as logger from '@/lib/logger'

function calculateAge(dob: Date) {
  return Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function calculateProfileCompleteness(profile: Record<string, any>) {
  const important = [
    'fullName',
    'gender',
    'dateOfBirth',
    'city',
    'education',
    'occupation',
    'religion',
    'aboutMe',
    'expectations',
    'photoUrl'
  ]
  const filled = important.filter((k) => !!profile[k] && profile[k] !== '').length
  return Math.round((filled / important.length) * 100)
}

function sanitizeInput(data: any) {
  const allowed = new Set([
    'fullName',
    'gender',
    'dateOfBirth',
    'placeOfBirth',
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
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) {
    if (allowed.has(k)) clean[k] = v
  }
  if (typeof clean.fullName === 'string') clean.fullName = clean.fullName.trim().slice(0, 100)
  if (typeof clean.aboutMe === 'string') clean.aboutMe = clean.aboutMe.slice(0, 1000)
  if (typeof clean.expectations === 'string') clean.expectations = clean.expectations.slice(0, 1000)
  if (typeof clean.quote === 'string') clean.quote = clean.quote.slice(0, 100)
  if (clean.dateOfBirth) {
    const d = new Date(clean.dateOfBirth)
    clean.dateOfBirth = isNaN(d.getTime()) ? undefined : d
  }
  if (clean.childrenCount !== undefined) clean.childrenCount = Number(clean.childrenCount)
  if (clean.preferredAgeMin !== undefined) clean.preferredAgeMin = Number(clean.preferredAgeMin)
  if (clean.preferredAgeMax !== undefined) clean.preferredAgeMax = Number(clean.preferredAgeMax)
  if (clean.height !== undefined) clean.height = Number(clean.height)
  if (clean.weight !== undefined) clean.weight = Number(clean.weight)
  return clean
}

function validateBusinessRules(data: Record<string, any>) {
  if (
    data.preferredAgeMin !== undefined &&
    data.preferredAgeMax !== undefined &&
    data.preferredAgeMin > data.preferredAgeMax
  ) {
    throw new Error('Invalid preferred age range')
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const profile = await db.profile.findUnique({ where: { userId } })
    if (!profile) {
      return NextResponse.json({ profile: null })
    }
    const { phone: _phone, email: _email, initials: _initials, ...safeProfile } = profile as any
    const res = NextResponse.json({ profile: safeProfile })
    res.headers.set('Cache-Control', 'no-store, private, max-age=0')
    return res
  } catch (error) {
    const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
    try { logger.record({ type: 'error', action: 'profile_get', detail: `Get profile error: ${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil biodata' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const cid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const raw = await request.json()
    delete (raw as any).phone
    delete (raw as any).email
    delete (raw as any).initials
    const sanitized = sanitizeInput(raw)
    validateBusinessRules(sanitized)

    const existingProfile = await db.profile.findUnique({ where: { userId } })

    const updateData: any = {
      ...sanitized,
      updatedAt: new Date()
    }
    if (sanitized.dateOfBirth) {
      updateData.age = calculateAge(sanitized.dateOfBirth)
    }
    updateData.completionScore = calculateProfileCompleteness({ ...(existingProfile || {}), ...updateData })

    const profile = await db.profile.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...updateData }
    })
    if (!existingProfile) {
      try {
        await db.user.update({ where: { id: userId }, data: { workflowStatus: 'psychotest' } })
      } catch {}
    }
    if (sanitized.photoUrl) {
      await db.user.update({
        where: { id: userId },
        data: { avatar: sanitized.photoUrl }
      })
    }

    ;(async () => {
      try {
        await enqueueCompatibilityRecalc(userId)
      } catch {}
    })()

    try { logger.record({ type: 'info', action: 'profile_upsert', detail: `Profile updated (cid=${cid})` }) } catch {}

    const { phone: _phone, email: _email, initials: _initials, ...safeProfile } = profile as any
    const res = NextResponse.json({
      success: true,
      message: 'Biodata berhasil disimpan',
      profile: safeProfile
    })
    res.headers.set('Cache-Control', 'no-store')
    return res

  } catch (error) {
    try { logger.record({ type: 'error', action: 'profile_save', detail: `${error instanceof Error ? error.message : String(error)} (cid=${cid})` }) } catch {}
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan biodata' }, { status: 500 })
  }
}
