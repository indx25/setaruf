export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { adId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const adId = params.adId
    const existing = await db.advertisement.findUnique({ where: { id: adId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const data: any = {}
    if (typeof body.title === 'string') data.title = body.title
    if (typeof body.description === 'string' || body.description === null) data.description = body.description
    if (typeof body.imageUrl === 'string' || body.imageUrl === null) {
      const isValidImage = body.imageUrl === null ? true : /^(\/|https:\/\/)/.test(body.imageUrl) && !/^javascript:/i.test(body.imageUrl)
      if (!isValidImage) return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
      data.imageUrl = body.imageUrl
    }
    if (typeof body.linkUrl === 'string' || body.linkUrl === null) {
      const isValidLink = body.linkUrl === null ? true : /^https?:\/\//.test(body.linkUrl) && !/^javascript:/i.test(body.linkUrl)
      if (!isValidLink) return NextResponse.json({ error: 'Invalid link URL' }, { status: 400 })
      data.linkUrl = body.linkUrl
    }
    if (typeof body.position === 'string') {
      const allowedPositions = new Set([
        'dashboard_left',
        'dashboard_right',
        'dashboard_top',
        'dashboard_center',
        'dashboard_middle',
        'dashboard_bottom'
      ])
      if (!allowedPositions.has(body.position)) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
      data.position = body.position
    }
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive
    if (typeof body.startDate === 'string') data.startDate = new Date(body.startDate)
    if (typeof body.endDate === 'string' || body.endDate === null) data.endDate = body.endDate ? new Date(body.endDate) : null

    const updated = await db.advertisement.update({
      where: { id: adId },
      data
    })
    return NextResponse.json({ advertisement: updated })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update advertisement' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { adId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await db.user.findUnique({ where: { id: userId } })
    if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const adId = params.adId
    await db.advertisement.delete({ where: { id: adId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete advertisement' }, { status: 500 })
  }
}
