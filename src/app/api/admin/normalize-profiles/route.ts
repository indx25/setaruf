export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function normGender(s?: string | null) {
  const t = (s || '').toLowerCase().trim()
  if (!t) return null
  if (['male', 'pria', 'laki', 'laki-laki', 'cowok'].includes(t)) return 'male'
  if (['female', 'wanita', 'perempuan', 'cewek'].includes(t)) return 'female'
  return null
}

function normReligion(s?: string | null) {
  const t = (s || '').toLowerCase().trim()
  if (!t) return null
  if (['islam', 'muslim', 'moslem'].includes(t)) return 'islam'
  if (['kristen', 'protestan', 'christian', 'protestant'].includes(t)) return 'kristen'
  if (['katolik', 'catholic'].includes(t)) return 'katolik'
  if (['hindu', 'hinduism'].includes(t)) return 'hindu'
  if (['buddha', 'buddhist', 'buddhism'].includes(t)) return 'buddha'
  if (['khonghucu', 'konghucu', 'confucian', 'confucianism'].includes(t)) return 'khonghucu'
  return null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const meId = (session?.user as any)?.id as string | undefined
  if (!meId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await db.user.findUnique({ where: { id: meId } })
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const dryRun = Boolean(body?.dryRun ?? true)
  const limit = Math.max(1, Math.min(5000, Number(body?.limit ?? 1000)))

  const profiles = await db.profile.findMany({
    where: {
      OR: [
        { gender: { notIn: ['male', 'female'], mode: 'insensitive' as any } as any },
        { religion: { notIn: ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'khonghucu'], mode: 'insensitive' as any } as any }
      ]
    },
    select: { id: true, gender: true, religion: true },
    take: limit,
    orderBy: { updatedAt: 'asc' }
  })

  if (profiles.length === 0) {
    return NextResponse.json({ total: 0, updated: 0, dryRun })
  }

  if (dryRun) {
    let toFix = 0
    for (const p of profiles) {
      const g = normGender(p.gender)
      const r = normReligion(p.religion)
      if (g !== (p.gender || null) || r !== (p.religion || null)) toFix++
    }
    return NextResponse.json({ total: profiles.length, updated: 0, toFix, dryRun })
  }

  let updated = 0
  for (const p of profiles) {
    const g = normGender(p.gender)
    const r = normReligion(p.religion)
    const needs = (g !== (p.gender || null)) || (r !== (p.religion || null))
    if (!needs) continue
    await db.profile.update({
      where: { id: p.id },
      data: { gender: g as any, religion: r }
    })
    updated++
  }
  return NextResponse.json({ total: profiles.length, updated, dryRun: false })
}

