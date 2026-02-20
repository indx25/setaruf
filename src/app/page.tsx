'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { 
  Heart, 
  Cpu, 
  Target, 
  BrainCircuit, 
  GitCommit, 
  Gift 
} from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Suspense } from 'react'

export default function AuthPage() {
  // Data Fitur (Desktop Only) - Updated Text
  const uniqueFeatures = [
    { text: "Kecocokan berbasis Kecerdasan Buatan (AI)", icon: Cpu },
    { text: "Bukan aplikasi kencan", icon: Gift },
    { text: "Alur terstruktur menuju pernikahan serius", icon: Target },
    { text: "Pencocokan mendalam berbasis psikologis", icon: BrainCircuit },
    { text: "Alur ta’aruf yang terstruktur dan terarah", icon: GitCommit }
  ]

  return (
    <>
      <style>{`
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        
        .text-luxury-emboss {
          background: linear-gradient(135deg, #831843 0%, #be185d 50%, #831843 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 1px 1px rgba(255, 255, 255, 0.5));
        }
      `}</style>

      <div className="flex flex-col lg:flex-row min-h-[100dvh] w-full bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-purple-50 -z-10"></div>

        {/* --- LEFT SIDE: BRANDING (Desktop Only) --- */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-rose-100 to-pink-100 items-center justify-center p-12 relative overflow-hidden">
          
          {/* Decorative Background Pattern: Hearts & Rings */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <Heart className="absolute top-[10%] left-[15%] text-rose-300/20 w-12 h-12 animate-pulse" />
            <Heart className="absolute bottom-[20%] right-[10%] text-purple-300/20 w-16 h-16" fill="currentColor" />
            <Heart className="absolute top-[40%] left-[80%] text-rose-400/10 w-8 h-8" />
            
            <div className="absolute top-[15%] right-[25%] w-16 h-16 rounded-full border-2 border-rose-300/20 rotate-12"></div>
            <div className="absolute bottom-[15%] left-[20%] w-24 h-24 rounded-full border border-purple-300/10 -rotate-6"></div>
            <div className="absolute top-[60%] left-[10%] w-8 h-8 rounded-full border border-rose-200/30 rotate-45"></div>
            
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-rose-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
          </div>

          <div className="relative z-10 max-w-lg w-full space-y-8 animate-fade-up">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-3">
                <div className="bg-white p-3 rounded-2xl shadow-xl shadow-rose-500/20">
                  <Heart className="w-8 h-8 text-rose-600 fill-rose-100" />
                </div>
                <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 font-serif">
                  Setaruf
                </h1>
              </div>
              
              {/* --- DESKTOP TAG: Dark Luxury Text --- */}
              <div className="pl-1">
                <h2 className="font-serif text-2xl lg:text-3xl italic leading-tight text-luxury-emboss">
                  The Hybrid Ta’aruf Platform <br/> for Commitment & Marriage
                </h2>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-rose-100 p-3 rounded-full text-rose-600">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 font-serif">Exclusive Access</h3>
                  <p className="text-sm text-gray-500">Mulai dengan 1 Bulan Gratis</p>
                </div>
              </div>
              <div className="space-y-3">
                {uniqueFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                    <span className="text-sm font-medium">{feat.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT SIDE: AUTH FORM (Mobile & Desktop) --- */}
        <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 w-full relative bg-white/30 backdrop-blur-sm">
          
          {/* Mobile Logo & Header */}
          <div className="lg:hidden w-full max-w-sm mx-auto mb-8 text-center animate-fade-up space-y-6">
            
            <div className="inline-flex items-center justify-center space-x-2 mb-2">
              <div className="bg-white p-2 rounded-xl shadow-md border border-rose-50">
                <Heart className="w-6 h-6 text-rose-600 fill-rose-100" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif">Setaruf</h1>
            </div>

            {/* --- MOBILE TAG --- */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <div className="w-full h-px bg-neutral-800"></div>
              </div>
              <span className="relative bg-white/90 px-4 font-serif italic tracking-[0.15em] text-rose-900 text-[11px] uppercase leading-relaxed">
                A Modern Hybrid Ta’aruf Platform
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-full text-xs font-semibold text-rose-700 shadow-sm animate-fade-up delay-100">
              <Gift className="w-3.5 h-3.5" />
              <span>Coba 1 Bulan Gratis</span>
            </div>
          </div>

          {/* Form Container Card */}
          <div className="w-full max-w-sm animate-fade-up delay-200">
            <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white/90 backdrop-blur-xl lg:rounded-3xl overflow-hidden">
              <CardContent className="p-6 lg:p-8 space-y-6">
                
                <div className="space-y-2 text-center">
                  <h3 className="text-lg font-semibold text-gray-800">Masuk ke Akun</h3>
                  <p className="text-sm text-gray-500">
                    Gunakan akun Google yang terhubung dengan identitas asli Anda.
                  </p>
                </div>
                
                <Suspense>
                  <AuthErrorAlert />
                </Suspense>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      className="w-full h-12 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md transition-all duration-200 font-medium text-base flex items-center justify-center gap-3 rounded-xl group"
                      onClick={() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
                        const url = `${origin}/dashboard`
                        signIn('google', { callbackUrl: url, redirect: true })
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 group-hover:scale-110 transition-transform duration-200">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 c0-6.627,5.373-12,12-12c3.059,0,5.84,1.162,7.951,3.049l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.815C14.264,16.16,18.801,14,24,14c3.059,0,5.84,1.162,7.951,3.049l5.657-5.657 C34.046,6.053,29.268,4,24,4C15.317,4,7.884,8.771,6.306,14.691z"/>
                        <path fill="#4CAF50" d="M24,44c5.18,0,9.9-1.986,13.453-5.219l-6.207-5.238C29.091,35.091,26.215,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.548,5.038C8.708,39.225,15.782,44,24,44z"/>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.793,2.239-2.231,4.162-4.091,5.543 c0.001-0.001,0.002-0.001,0.003-0.002l6.207,5.238C36.917,39.739,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                      </svg>
                      Lanjutkan dengan Google
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className="max-w-[260px] text-center">
                    Jika email pernah dipakai daftar dengan metode lain, gunakan metode itu.
                    Email yang sama akan otomatis ditautkan saat login Google.
                  </TooltipContent>
                </Tooltip>

                <div className="pt-2 text-center">
                  <p className="text-xs text-gray-400">
                    Terproteksi oleh reCAPTCHA Enterprise
                  </p>
                </div>

              </CardContent>
            </Card>

            <div className="mt-8 text-center animate-fade-up delay-300">
              <p className="text-[11px] text-gray-500 leading-relaxed px-4">
                Dengan melanjutkan, Anda menyetujui <br className="hidden sm:block" />
                <a href="/syarat-ketentuan" className="text-gray-700 font-semibold hover:text-rose-600 transition-colors">Syarat & Ketentuan</a> dan <a href="/kebijakan-privasi" className="text-gray-700 font-semibold hover:text-rose-600 transition-colors">Kebijakan Privasi</a> kami.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function AuthErrorAlert() {
  const params = useSearchParams()
  const err = params.get('error')
  if (!err) return null
  const msg =
    err === 'OAuthCreateAccount'
      ? 'Login Google gagal membuat akun. Jika email sudah terdaftar, masuk dengan metode yang sama seperti pendaftaran atau hubungi admin.'
      : err === 'OAuthAccountNotLinked'
      ? 'Email ini sudah terdaftar dengan metode berbeda. Silakan masuk menggunakan Google atau metode yang sama saat pendaftaran. Jika tetap bermasalah, hubungi admin.'
      : err === 'Callback'
      ? 'Kesalahan callback OAuth. Periksa NEXTAUTH_URL, Client ID/Secret, dan Redirect URL di Google Console.'
      : err === 'Configuration'
      ? 'Konfigurasi OAuth tidak lengkap. Pastikan NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, dan DATABASE_URL terisi.'
      : err === 'AccessDenied'
      ? 'Akses ditolak oleh provider. Coba ulang atau gunakan metode lain.'
      : 'Terjadi kesalahan saat login. Silakan coba lagi.'
  return (
    <Alert className="bg-rose-50 border-rose-200 text-rose-800">
      <AlertDescription>
        {msg}
        <span className="block mt-1 text-[11px] text-gray-600">Kode: {err}</span>
      </AlertDescription>
    </Alert>
  )
}
