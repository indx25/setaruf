import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'reCAPTCHA token is required' },
        { status: 400 }
      )
    }

    const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY

    if (!recaptchaSecretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not configured')
      // In development, we might skip verification
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({ success: true, score: 1.0 })
      }

      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Verify token with Google reCAPTCHA API
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify'
    const formData = new URLSearchParams()
    formData.append('secret', recaptchaSecretKey)
    formData.append('response', token)

    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    })

    const result = await response.json()

    if (!result.success) {
      console.error('reCAPTCHA verification failed:', result['error-codes'])
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 }
      )
    }

    // Check score for v3 (lower score = more likely bot)
    // Score range: 0.0 (bot) to 1.0 (human)
    const score = result.score || 1.0
    const threshold = 0.5 // Adjust based on your requirements

    if (score < threshold) {
      console.warn('reCAPTCHA score too low:', score)
      return NextResponse.json(
        { error: 'Verification failed. Please refresh the page and try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      score,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname,
    })

  } catch (error) {
    console.error('reCAPTCHA verification error:', error)

    // In development, allow the request to proceed
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ success: true, score: 1.0 })
    }

    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    )
  }
}
