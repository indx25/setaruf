'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Heart, ArrowLeft, CheckCircle } from 'lucide-react'

export default function MessagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard')
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'Gagal memuat data')
        }
        if (mounted) {
          setMatches(json.matches || [])
        }
      } catch (e: any) {
        setError(e?.message || 'Terjadi kesalahan')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const mutualLiked = matches.filter(
    (m) => m.matchStep === 'mutual_liked' || m.matchStep === 'chatting' || m.matchStatus === 'approved'
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat halaman chat...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Pesan</h1>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-rose-500" />
              Chat
            </CardTitle>
            <CardDescription>Chat akan terbuka jika terjadi Mutual Suka</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mutualLiked.length === 0 ? (
              <>
                <Alert className="bg-rose-50 border-rose-200 text-rose-800">
                  <Heart className="h-4 w-4 text-rose-600" />
                  <AlertDescription>
                    Chat belum tersedia. Chat akan terbuka otomatis ketika Anda dan pasangan sama‑sama menekan Suka (Mutual Suka).
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Link href="/dashboard">
                    <Button className="bg-rose-600 hover:bg-rose-700 text-white">Lihat Rekomendasi</Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="outline">Kembali</Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    Kamu punya pasangan Mutual Suka. Pilih salah satu untuk membuka chat.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mutualLiked.map((m) => (
                    <Card key={m.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{m.targetName}</div>
                          <div className="mt-1">
                            <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[10px]">Mutual Suka</Badge>
                          </div>
                        </div>
                        <Button onClick={() => router.push(`/dashboard/matches/${m.id}/chat`)} className="bg-rose-600 hover:bg-rose-700 text-white">
                          Buka Chat
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
