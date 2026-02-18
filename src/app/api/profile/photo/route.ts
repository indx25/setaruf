import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('photo') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext = file.type.includes('png') ? 'png' : 'jpg'
    const filename = `photo-${Date.now()}.${ext}`
    const key = `users/${userId}/${filename}`

    const bucket = process.env.S3_BUCKET_NAME || ''
    const region = process.env.AWS_REGION || ''
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || ''
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || ''

    let url = ''

    if (bucket && region && accessKeyId && secretAccessKey) {
      const s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      })
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
      }))
      const base = process.env.CDN_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`
      url = `${base}/${key}`
    } else {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'users', userId)
      fs.mkdirSync(uploadsDir, { recursive: true })
      const filePath = path.join(uploadsDir, filename)
      fs.writeFileSync(filePath, buffer)
      url = `/uploads/users/${userId}/${filename}`
    }

    await db.profile.upsert({
      where: { userId },
      update: { photoUrl: url },
      create: { userId, photoUrl: url },
    })
    await db.user.update({
      where: { id: userId },
      data: { avatar: url }
    })

    return NextResponse.json({ success: true, url })
  } catch (error) {
    return NextResponse.json({ error: 'Upload gagal' }, { status: 500 })
  }
}
