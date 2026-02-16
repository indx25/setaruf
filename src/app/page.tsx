'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertCircle, 
  Heart, 
  Users, 
  ShieldCheck, 
  Shield, 
  Cpu, 
  Moon, 
  Target, 
  BrainCircuit, 
  GitCommit, 
  Gift 
} from 'lucide-react'
import { RecaptchaWrapper } from '@/components/recaptcha-wrapper'
import { signIn } from 'next-auth/react'

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

  // Data Fitur Baru
  const uniqueFeatures = [
    { text: "AI based compatibility", icon: Cpu },
    { text: "Exclusive halal system", icon: Moon },
    { text: "Tidak seperti dating app", icon: ShieldCheck },
    { text: "Serious marriage funnel", icon: Target },
    { text: "Psychological deep matching", icon: BrainCircuit },
    { text: "Structured taaruf flow", icon: GitCommit }
  ]

  const handleLogin = async (e: React.FormEvent, executeRecaptcha: () => Promise<string>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const recaptchaToken = await executeRecaptcha()
      if (!recaptchaToken) {
        throw new Error('Verifikasi keamanan gagal. Silakan coba lagi.')
      }

      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        recaptchaToken,
        redirect: false,
      })
      if (!result || result.error) {
        throw new Error(result?.error || 'Login gagal')
      }
      window.location.href = '/dashboard'
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

      const result = await signIn('credentials', {
        email: registerEmail,
        password: registerPassword,
        recaptchaToken,
        redirect: false,
      })
      if (!result || result.error) {
        throw new Error(result?.error || 'Login setelah registrasi gagal')
      }
      window.location.href = data.redirectTo || '/dashboard'
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 relative overflow-hidden p-4 flex items-center justify-center">
      {/* Background Decoration Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob hidden lg:block"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 hidden lg:block"></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 hidden lg:block"></div>

      <div className="container mx-auto max-w-6xl z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          {/* --- LEFT SIDE: BRANDING & ADVERTISING (Desktop Only) --- */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 animate-slide-up">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-rose-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-rose-500/20">
                  <Heart className="w-6 h-6 text-white fill-white/20" />
                </div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                  Setaruf
                </h1>
              </div>
              <p className="text-lg text-gray-600 font-medium leading-relaxed pl-1">
                "SEIYA SEKATA Kita Taaruf"
              </p>
            </div>

            {/* Advertising Block */}
            <div className="bg-gradient-to-br from-rose-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl shadow-rose-500/30 relative overflow-hidden group hover:shadow-rose-500/40 transition-all duration-300">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
              <div className="relative z-10">
                <div className="flex items-start gap-3 mb-2">
                  <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm mt-0.5">
                    <Gift className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-1">
                      Awali Setaruf dengan <span className="text-yellow-300 drop-shadow-sm">1 Bulan Gratis</span>
                    </h3>
                    <div className="h-0.5 w-12 bg-white/30 rounded-full mb-2"></div>
                  </div>
                </div>
                <p className="text-sm font-medium text-white/90 pl-14">
                  Kemudian cukup <span className="font-bold text-white border-b border-yellow-300/50">Rp50.000/bulan</span> untuk mendampingi proses menuju Pernikahan.
                </p>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {uniqueFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm border border-white/60 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
                    <feat.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 leading-tight">
                    {feat.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* --- RIGHT SIDE: FORM CARD --- */}
          <div className="w-full max-w-md mx-auto lg:ml-auto">
            <Card className="w-full shadow-xl border-0 bg-white/90 backdrop-blur-md relative overflow-hidden">
              {/* Decorative Circle Background */}
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Heart className="w-32 h-32 text-rose-600 fill-current" />
              </div>

              <CardHeader className="space-y-1 relative z-10 text-center">
                {/* Mobile Logo */}
                <div className="lg:hidden flex justify-center mb-4">
                  <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-xl shadow-md">
                    <Heart className="w-6 h-6 text-white fill-white/20" />
                  </div>
                </div>

                <CardTitle className="text-2xl font-bold text-gray-900">Selamat Datang</CardTitle>
                <CardDescription className="text-gray-500">
                  Mulai perjalanan taaruf Anda menuju pernikahan yang bahagia
                </CardDescription>

                {/* Mobile Only Promo Text */}
                <div className="lg:hidden mt-3 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-center gap-2">
                  <Gift className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-rose-600">Coba 1 Bulan Gratis</span>
                </div>
              </CardHeader>

              <CardContent className="relative z-10">
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100/50 border border-gray-200/50">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Daftar</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login">
                    <RecaptchaWrapper action="login">
                      {(executeRecaptcha) => (
                        <form onSubmit={(e) => handleLogin(e, executeRecaptcha)} className="space-y-4 mt-6">
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
                            <div className="flex items-center justify-between">
                              <Label htmlFor="login-password">Password</Label>
                              <a href="#" className="text-xs font-medium text-rose-600 hover:text-rose-500 hover:underline">Lupa password?</a>
                            </div>
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
                            className="w-full h-11 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.98]"
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
                        <form onSubmit={(e) => handleRegister(e, executeRecaptcha)} className="space-y-4 mt-6">
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
                          
                          {/* Grid Layout for DOB & Email */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="register-dob">Tgl Lahir</Label>
                              <Input
                                id="register-dob"
                                type="date"
                                value={registerDateOfBirth}
                                onChange={(e) => setRegisterDateOfBirth(e.target.value)}
                                required
                                disabled={isLoading}
                                max={new Date().toISOString().split('T')[0]}
                                className="text-sm"
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
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="register-password">Password</Label>
                            <Input
                              id="register-password"
                              type="password"
                              placeholder="•••••••• (Minimal 8 karakter + simbol)"
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
                            className="w-full h-11 mt-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.98]"
                            disabled={isLoading}
                          >
                            {isLoading ? 'Memproses...' : 'Daftar Sekarang'}
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
              
              <CardFooter className="flex justify-center relative z-10">
                <p className="text-[11px] text-gray-500 text-center leading-tight">
                  Dengan mendaftar, Anda menyetujui <br/>
                  <span className="text-gray-700 underline cursor-pointer hover:text-rose-500 font-medium">Syarat & Ketentuan</span> serta <span className="text-gray-700 underline cursor-pointer hover:text-rose-500 font-medium">Kebijakan Privasi</span> kami
                </p>
              </CardFooter>
            </Card>

            <div className="mt-8 text-center lg:text-right">
              <a
                href="/cooledition"
                className="text-xs font-medium text-gray-400 hover:text-rose-500 transition-colors flex items-center justify-center lg:justify-end gap-1.5"
              >
                <Shield className="w-3 h-3" />
                © 2026 Setaruf. Produced and Developed by Indra Kadx.
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}