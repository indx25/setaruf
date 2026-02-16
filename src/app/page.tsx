'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Heart, Users, ShieldCheck, Shield } from 'lucide-react'
import { RecaptchaWrapper } from '@/components/recaptcha-wrapper'

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [registerDateOfBirth, setRegisterDateOfBirth] = useState('')

  const handleLogin = async (e: React.FormEvent, executeRecaptcha: () => Promise<string>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Execute reCAPTCHA
      const recaptchaToken = await executeRecaptcha()
      if (!recaptchaToken) {
        throw new Error('Verifikasi keamanan gagal. Silakan coba lagi.')
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          recaptchaToken
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal')
      }

      // Redirect to dashboard or appropriate page
      if (data.redirectTo) {
        window.location.href = data.redirectTo
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent, executeRecaptcha: () => Promise<string>) => {
    e.preventDefault()
    setError('')

    // Validasi
    if (!registerName || !registerEmail || !registerPassword || !registerDateOfBirth) {
      setError('Semua field wajib diisi')
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      setError('Password tidak cocok')
      return
    }

    const pwd = registerPassword
    const strongPwd =
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[^A-Za-z0-9]/.test(pwd)
    if (!strongPwd) {
      setError('Password wajib minimal 8 karakter dan kombinasi huruf besar, kecil, angka, dan simbol')
      return
    }

    // Validasi usia (minimal 17 tahun)
    const dob = new Date(registerDateOfBirth)
    const today = new Date()
    const age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      if (age - 1 < 17) {
        setError('Maaf, usia minimal 17 tahun untuk mendaftar')
        return
      }
    } else if (age < 17) {
      setError('Maaf, usia minimal 17 tahun untuk mendaftar')
      return
    }

    setIsLoading(true)

    try {
      // Execute reCAPTCHA
      const recaptchaToken = await executeRecaptcha()
      if (!recaptchaToken) {
        throw new Error('Verifikasi keamanan gagal. Silakan coba lagi.')
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          dateOfBirth: registerDateOfBirth,
          recaptchaToken
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registrasi gagal')
      }

      // Redirect to dashboard or profile completion
      if (data.redirectTo) {
        window.location.href = data.redirectTo
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 p-4">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="order-2 md:order-1">
          <div className="text-center md:text-left mb-8">
            <div className="flex items-center md:justify-start justify-center mb-4">
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4 rounded-2xl shadow-lg">
                <Heart className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Setaruf
            </h1>
            <p className="text-lg text-gray-600 font-medium">"SEIYA SEKATA Kita Taaruf"</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-sm">
              <Users className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Pencocokan Berbasis AI</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-sm">
              <ShieldCheck className="w-8 h-8 text-pink-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Psikotes Terpercaya</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-sm">
              <Heart className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Semua Agama & Kalangan</p>
            </div>
          </div>
        </div>
        <div className="order-1 md:order-2 flex justify-end">
          <div className="w-full max-w-md">
            <Card className="w-full shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl text-center">Selamat Datang</CardTitle>
                <CardDescription className="text-center">
                  Mulai perjalanan taaruf Anda menuju pernikahan yang bahagia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Daftar</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login">
                    <RecaptchaWrapper action="login">
                      {(executeRecaptcha) => (
                        <form onSubmit={(e) => handleLogin(e, executeRecaptcha)} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="login-email">Email</Label>
                            <Input
                              id="login-email"
                              type="email"
                              placeholder="nama@email.com"
                              value={loginEmail}
                              onChange={(e) => setLoginEmail(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="login-password">Password</Label>
                            <Input
                              id="login-password"
                              type="password"
                              placeholder="••••••••"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                            disabled={isLoading}
                          >
                            {isLoading ? 'Memproses...' : 'Masuk'}
                          </Button>
                        </form>
                      )}
                    </RecaptchaWrapper>
                  </TabsContent>
                  <TabsContent value="register">
                    <RecaptchaWrapper action="register">
                      {(executeRecaptcha) => (
                        <form onSubmit={(e) => handleRegister(e, executeRecaptcha)} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="register-name">Nama Lengkap</Label>
                            <Input
                              id="register-name"
                              type="text"
                              placeholder="Masukkan nama lengkap"
                              value={registerName}
                              onChange={(e) => setRegisterName(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-email">Email</Label>
                            <Input
                              id="register-email"
                              type="email"
                              placeholder="nama@email.com"
                              value={registerEmail}
                              onChange={(e) => setRegisterEmail(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-dob">Tanggal Lahir</Label>
                            <Input
                              id="register-dob"
                              type="date"
                              value={registerDateOfBirth}
                              onChange={(e) => setRegisterDateOfBirth(e.target.value)}
                              required
                              disabled={isLoading}
                              max={new Date().toISOString().split('T')[0]}
                            />
                            <p className="text-xs text-gray-500">Minimal 17 tahun</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-password">Password</Label>
                            <Input
                              id="register-password"
                              type="password"
                              placeholder="••••••••"
                              value={registerPassword}
                              onChange={(e) => setRegisterPassword(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-confirm-password">Konfirmasi Password</Label>
                            <Input
                              id="register-confirm-password"
                              type="password"
                              placeholder="••••••••"
                              value={registerConfirmPassword}
                              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                            disabled={isLoading}
                          >
                            {isLoading ? 'Memproses...' : 'Daftar'}
                          </Button>
                        </form>
                      )}
                    </RecaptchaWrapper>
                  </TabsContent>
                </Tabs>
                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex justify-center">
                <p className="text-xs text-gray-500">
                  Dengan mendaftar, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi kami
                </p>
              </CardFooter>
            </Card>
            <div className="mt-8 text-center md:text-right">
              <a
                href="/cooledition"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Admin Portal
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
