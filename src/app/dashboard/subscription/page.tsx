'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Upload,
  Copy,
  ArrowLeft,
  Crown,
  RefreshCw
} from 'lucide-react'

export default function SubscriptionPage() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState<any>(null)
  const [pendingPayment, setPendingPayment] = useState<any>(null)
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })
  const [proofUrl, setProofUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  useEffect(() => {
    if (subscription?.endDate) {
      const checkExpiry = () => {
        const now = new Date()
        const endDate = new Date(subscription.endDate)
        const diff = endDate.getTime() - now.getTime()

        if (diff <= 0) {
          setTimeLeft({ days: 0, hours: 0, minutes: 0 })
          setShowExpiryWarning(false)
          return
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

        setTimeLeft({ days, hours, minutes })

        // Show warning if less than 7 days
        if (days < 7 && days >= 0) {
          setShowExpiryWarning(true)
        }
      }

      checkExpiry()
      const interval = setInterval(checkExpiry, 60000) // Update every minute

      return () => clearInterval(interval)
    }
  }, [subscription])

  const loadSubscriptionData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/subscription')
      const data = await response.json()

      if (response.ok) {
        setSubscription(data.subscription)
        setPendingPayment(data.pendingPayment)
      } else {
        throw new Error(data.error || 'Gagal memuat data subscription')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePayment = async () => {
    try {
      const response = await fetch('/api/subscription/create-payment', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat payment')
      }

      setPendingPayment(data.payment)
      setShowPaymentDialog(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUploadProof = async () => {
    if (!proofUrl.trim()) {
      setError('URL bukti transfer wajib diisi')
      return
    }

    setIsUploading(true)

    try {
      const response = await fetch('/api/payment/upload-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: pendingPayment.id,
          proofUrl
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal upload bukti')
      }

      setPendingPayment(data.payment)
      setProofUrl('')
      setShowPaymentDialog(false)
      setError('')

      // Show success message
      alert('Bukti transfer berhasil diupload! Mohon tunggu approval 1x24 jam.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Berhasil disalin!')
  }

  const isExpired = subscription && new Date(subscription.endDate) < new Date()
  const isExpiringSoon = showExpiryWarning && !isExpired

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data subscription...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription</h1>
          <p className="text-gray-600">Kelola subscription premium Anda</p>
        </div>

        {/* Expiry Warning */}
        {isExpiringSoon && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Peringatan:</strong> Subscription Anda akan berakhir dalam{' '}
              {timeLeft.days} hari {timeLeft.hours} jam. Segera perpanjang untuk menghindari gangguan layanan.
            </AlertDescription>
          </Alert>
        )}

        {isExpired && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Subscription Berakhir:</strong> Subscription Anda telah berakhir. Silakan perpanjang untuk melanjutkan penggunaan fitur premium.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Subscription Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${subscription?.planType === 'premium' ? 'bg-gradient-to-br from-amber-400 to-yellow-500' : 'bg-gray-200'}`}>
                  <Crown className={`w-6 h-6 ${subscription?.planType === 'premium' ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div>
                  <CardTitle>Subscription {subscription?.planType === 'premium' ? 'Premium' : 'Gratis'}</CardTitle>
                  <CardDescription>
                    {subscription?.isTrial && '(Trial 1 Bulan Pertama)'}
                  </CardDescription>
                </div>
              </div>
              <Badge className={`${isExpired ? 'bg-red-500' : subscription?.planType === 'premium' ? 'bg-green-500' : 'bg-gray-500'} text-white`}>
                {isExpired ? 'Berakhir' : 'Aktif'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tanggal Mulai</p>
                  <p className="font-semibold">
                    {subscription?.startDate ? new Date(subscription.startDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tanggal Berakhir</p>
                  <p className={`font-semibold ${isExpired ? 'text-red-600' : ''}`}>
                    {subscription?.endDate ? new Date(subscription.endDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) : '-'}
                  </p>
                </div>
              </div>

              {!isExpired && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Sisa Waktu</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={subscription ? ((new Date(subscription.endDate).getTime() - new Date().getTime()) / (30 * 24 * 60 * 60 * 1000)) * 100 : 0} />
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="bg-gray-100 px-3 py-1 rounded">{timeLeft.days} hari</span>
                      <span className="bg-gray-100 px-3 py-1 rounded">{timeLeft.hours} jam</span>
                      <span className="bg-gray-100 px-3 py-1 rounded">{timeLeft.minutes} menit</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-rose-500" />
              Informasi Pembayaran
            </CardTitle>
            <CardDescription>
              Harga subscription: Rp 50.000/bulan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bank</Label>
                    <p className="font-semibold text-lg">BCA</p>
                  </div>
                  <div>
                    <Label>No. Rekening</Label>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg">1084421955</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard('1084421955')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Atas Nama</Label>
                    <p className="font-semibold text-lg">Indra Gunawan</p>
                  </div>
                </div>
              </div>

              {pendingPayment ? (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Anda memiliki payment pending. Kode unik: <strong>{pendingPayment.uniqueCode}</strong><br />
                    Total transfer: <strong>Rp {pendingPayment.amount?.toLocaleString('id-ID')}</strong>
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={handleCreatePayment}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Buat Payment Baru
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Payment Actions */}
        {pendingPayment && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">Payment Pending</CardTitle>
              <CardDescription>
                Silakan upload bukti transfer untuk melanjutkan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Kode Unik</p>
                  <p className="text-2xl font-bold text-rose-600 mb-4">{pendingPayment.uniqueCode}</p>

                  <p className="text-sm text-gray-500 mb-1">Total Transfer</p>
                  <p className="text-3xl font-bold text-gray-900 mb-4">
                    Rp {pendingPayment.amount?.toLocaleString('id-ID')}
                  </p>

                  <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <p className="text-sm text-rose-700">
                      Pastikan jumlah transfer sesuai dengan kode unik untuk verifikasi otomatis
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="proofUrl">URL Bukti Transfer</Label>
                  <Input
                    id="proofUrl"
                    type="url"
                    placeholder="https://example.com/bukti-transfer.jpg"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    disabled={!!pendingPayment.proofUrl}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload bukti transfer ke layanan gambar dan masukkan URL di sini
                  </p>
                </div>

                {!pendingPayment.proofUrl ? (
                  <Button
                    onClick={handleUploadProof}
                    disabled={isUploading || !proofUrl.trim()}
                    className="w-full bg-green-500 hover:bg-green-600"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Mengupload...' : 'Upload Bukti Transfer'}
                  </Button>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Bukti transfer telah diupload. Menunggu approval admin (maksimal 1x24 jam).
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-center text-sm text-gray-500">
                  <p>Status: <Badge className="bg-yellow-500">Pending Approval</Badge></p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits Section */}
        <Card>
          <CardHeader>
            <CardTitle>Keuntungan Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Akses tidak terbatas ke rekomendasi pasangan</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Fitur chat tanpa batas</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Akses ke fitur premium mendatang</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Baru Dibuat</DialogTitle>
            <DialogDescription>
              Silakan transfer sesuai jumlah berikut:
            </DialogDescription>
          </DialogHeader>
          {pendingPayment && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-rose-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Kode Unik</p>
                <p className="text-4xl font-bold text-rose-600 mb-4">{pendingPayment.uniqueCode}</p>

                <p className="text-sm text-gray-500 mb-1">Total Transfer</p>
                <p className="text-3xl font-bold text-gray-900">
                  Rp {pendingPayment.amount?.toLocaleString('id-ID')}
                </p>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Transfer ke BCA 1084421955 atas nama Indra Gunawan. Pastikan jumlah transfer sesuai dengan kode unik.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPaymentDialog(false)}>
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
