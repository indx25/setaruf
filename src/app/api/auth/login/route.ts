import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Silakan gunakan NextAuth Credentials di /api/auth/[...nextauth]' },
    { status: 400 }
  )
}
