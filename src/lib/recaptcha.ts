/**
 * Verify reCAPTCHA token
 * Returns true if verification succeeds, false otherwise
 */
export async function verifyRecaptchaToken(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY

    if (!recaptchaSecretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not configured')
      // In development, we might skip verification
      if (process.env.NODE_ENV === 'development') {
        return { success: true }
      }

      return { success: false, error: 'Server configuration error' }
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
      return { success: false, error: 'reCAPTCHA verification failed' }
    }

    // Check score for v3 (lower score = more likely bot)
    const score = result.score || 1.0
    const threshold = 0.5 // Adjust based on your requirements

    if (score < threshold) {
      console.warn('reCAPTCHA score too low:', score)
      return { success: false, error: 'Verification failed - low score' }
    }

    return { success: true }

  } catch (error) {
    console.error('reCAPTCHA verification error:', error)

    // In development, allow the request to proceed
    if (process.env.NODE_ENV === 'development') {
      return { success: true }
    }

    return { success: false, error: 'Verification failed' }
  }
}
