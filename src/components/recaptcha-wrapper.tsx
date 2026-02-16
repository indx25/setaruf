'use client'

import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { useEffect, useState } from 'react'

interface RecaptchaWrapperProps {
  children: (executeRecaptcha: () => Promise<string>) => React.ReactNode
  onVerify?: (token: string) => void
  action: string
}

export function RecaptchaWrapper({ children, onVerify, action }: RecaptchaWrapperProps) {
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Check if recaptcha is ready
    if (executeRecaptcha) {
      setIsReady(true)
    }
  }, [executeRecaptcha])

  const handleExecute = async (): Promise<string> => {
    if (!executeRecaptcha) {
      throw new Error('reCAPTCHA not ready')
    }

    try {
      const token = await executeRecaptcha(action)

      if (onVerify) {
        onVerify(token)
      }

      return token
    } catch (error) {
      console.error('reCAPTCHA execution error:', error)
      throw new Error('reCAPTCHA verification failed')
    }
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-rose-500 border-t-transparent" />
          <span>Memuat verifikasi keamanan...</span>
        </div>
      </div>
    )
  }

  return <>{children(handleExecute)}</>
}
