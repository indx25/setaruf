import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

// GET - Load all psychotest results
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const tests = await db.psychoTest.findMany({
      where: { userId }
    })

    return NextResponse.json({ tests })

  } catch (error) {
    console.error('Get psychotest error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil hasil psikotes' },
      { status: 500 }
    )
  }
}

// POST - Save psychotest result
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { testType, score, result, answers } = await request.json()

    // Check if test already exists
    const existingTest = await db.psychoTest.findFirst({
      where: {
        userId,
        testType
      }
    })

    let psychotest

    if (existingTest) {
      // Update existing test
      psychotest = await db.psychoTest.update({
        where: { id: existingTest.id },
        data: {
          score,
          result,
          answers: JSON.stringify(answers),
          completedAt: new Date(),
        }
      })
    } else {
      // Create new test
      psychotest = await db.psychoTest.create({
        data: {
          userId,
          testType,
          score,
          result,
          answers: JSON.stringify(answers),
          completedAt: new Date(),
        }
      })
    }

    // Check if all 4 tests are completed
    const allTests = await db.psychoTest.findMany({
      where: { userId },
      select: { testType: true }
    })

    const completedTypes = new Set(allTests.map(t => t.testType))
    const allCompleted = completedTypes.has('pre_marriage') &&
                       completedTypes.has('disc') &&
                       completedTypes.has('clinical') &&
                       completedTypes.has('16pf')

    // If all tests completed, update user workflow status
    if (allCompleted) {
      await db.user.update({
        where: { id: userId },
        data: { workflowStatus: 'matching' }
      })

      // Create notification
      await db.notification.create({
        data: {
          userId,
          type: 'psychotest_completed',
          title: 'Psikotes Selesai!',
          message: 'Selamat! Anda telah menyelesaikan semua psikotes. Silakan cek dashboard untuk rekomendasi pasangan.',
          link: '/dashboard'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Psikotes berhasil disimpan',
      psychotest,
      allCompleted
    })

  } catch (error) {
    console.error('Save psychotest error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan psikotes' },
      { status: 500 }
    )
  }
}
