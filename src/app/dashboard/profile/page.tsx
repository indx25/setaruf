'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, User, Camera, Upload, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// 1. Type Definition untuk Data Form
interface ProfileFormData {
  // Foto
  photoUrl?: string;
  
  // Informasi Dasar
  fullName: string;
  initials: string;
  gender: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;

  // ... (lanjutkan field lainnya sama seperti kode asli) ...
  // Untuk contoh ini, saya fokus pada struktur yang diperbaiki.
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  country: string;
  religion: string;
  // Tambahkan sisa field sesuai kebutuhan asli Anda
  [key: string]: string | number | undefined; 
}

const INITIAL_FORM_STATE: ProfileFormData = {
  fullName: '',
  initials: '',
  gender: '',
  dateOfBirth: '',
  placeOfBirth: '',
  nationality: 'Indonesia',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  country: 'Indonesia',
  religion: '',
  // ... inisialisasi field lainnya
}

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form State
  const [formData, setFormData] = useState<ProfileFormData>(INITIAL_FORM_STATE)

  // Photo & Camera State
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  
  // Ref untuk elemen video
  const videoRef = useRef<HTMLVideoElement>(null)

  // 2. Load Data saat Mount
  useEffect(() => {
    loadProfile()
    
    // Cleanup function: Pastikan kamera mati saat user pergi
    return () => {
      stopCamera()
    }
  }, [])

  // 3. Sinkronisasi Stream Video ke elemen <video>
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/profile')
      const data = await response.json()

      if (response.ok && data.profile) {
        setFormData(prev => ({ ...prev, ...data.profile }))
      }
    } catch (err) {
      console.error('Error loading profile:', err)
      // Optional: Tampilkan error non-blocking toast
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user types
    if (error) setError('')
  }

  // 4. Validasi yang Lebih Terstruktur
  const validateForm = (): boolean => {
    const requiredFields = ['fullName', 'gender', 'dateOfBirth', 'religion']
    const missingFields = requiredFields.filter(field => !formData[field])
    
    if (missingFields.length > 0) {
      setError('Harap lengkapi informasi dasar (Nama, Jenis Kelamin, Tanggal Lahir, Agama)')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateForm()) return

    setIsSaving(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan biodata')
      }

      setSuccess('Biodata berhasil disimpan!')

      // Redirect ke psychotest page
      setTimeout(() => {
        router.push('/dashboard/psychotest')
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // 5. Logika File Upload
  const handleFileChange = async (file: File | null) => {
    if (!file) return
    
    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      setError('Hanya file gambar yang diperbolehkan')
      return
    }

    // Validasi ukuran (misal max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran foto maksimal 5MB')
      return
    }

    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
    
    const fd = new FormData()
    fd.append('photo', file)
    
    setIsUploadingPhoto(true)
    try {
      const res = await fetch('/api/profile/photo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload gagal')
      
      setFormData(prev => ({ ...prev, photoUrl: data.url }))
      setSuccess('Foto berhasil diunggah')
      setTimeout(() => setSuccess(''), 3000) // Auto hide success
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // 6. Logika Kamera dengan Cleanup yang Benar
  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } } 
      })
      setCameraStream(stream)
    } catch (err: any) {
      console.error(err)
      if (err.name === 'NotAllowedError') {
        setError('Izin kamera ditolak. Mohon izinkan akses kamera di browser Anda.')
      } else if (err.name === 'NotFoundError') {
        setError('Tidak ditemukan kamera pada perangkat ini.')
      } else {
        setError('Gagal mengakses kamera.')
      }
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      // Mirror effect handling jika perlu (optional, biasanya selfie perlu mirror)
      // ctx.translate(canvas.width, 0)
      // ctx.scale(-1, 1)
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      )
      
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        await handleFileChange(file)
        stopCamera() // Matikan kamera setelah capture
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto"></div>
          <p className="text-gray-600 font-medium">Memuat biodata...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lengkapi Biodata</h1>
          <p className="text-gray-500">Mohon lengkapi biodata Anda dengan jujur dan akurat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION: FOTO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-rose-500" />
                Foto Diri
              </CardTitle>
              <CardDescription>Unggah foto terbaru atau ambil langsung.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar Preview */}
                <div className="flex-shrink-0">
                  {photoPreview || formData.photoUrl ? (
                    <img 
                      src={photoPreview || formData.photoUrl} 
                      alt="Preview" 
                      className="w-32 h-32 rounded-xl object-cover border-2 border-white shadow-md" 
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                </div>

                {/* Tabs Upload/Camera */}
                <div className="flex-1">
                  <Tabs defaultValue="upload" className="w-full" onValueChange={(val) => val !== 'camera' && stopCamera()}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="upload">Upload File</TabsTrigger>
                      <TabsTrigger value="camera">Kamera</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="space-y-3">
                      <Label htmlFor="photo-file" className="cursor-pointer">
                        <div className="flex items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 hover:border-rose-400 transition-colors">
                          <div className="text-center">
                            <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                            <p className="text-xs text-gray-500">Klik untuk memilih foto</p>
                          </div>
                        </div>
                        <Input id="photo-file" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isUploadingPhoto} />
                      </Label>
                      {isUploadingPhoto && <p className="text-xs text-rose-500 animate-pulse">Mengunggah...</p>}
                    </TabsContent>

                    <TabsContent value="camera" className="space-y-3">
                      {!cameraStream ? (
                        <Button type="button" onClick={startCamera} variant="outline" className="w-full h-24 border-dashed">
                          <div className="flex flex-col items-center gap-2 text-gray-500">
                            <Camera className="w-6 h-6" />
                            <span>Buka Kamera</span>
                          </div>
                        </Button>
                      ) : (
                        <div className="space-y-3 bg-black rounded-lg overflow-hidden relative aspect-video">
                          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3">
                            <Button type="button" size="icon" onClick={capturePhoto} className="rounded-full bg-rose-500 hover:bg-rose-600 h-10 w-10 p-0">
                              <div className="w-4 h-4 bg-white rounded-full"></div>
                            </Button>
                            <Button type="button" size="icon" onClick={stopCamera} variant="secondary" className="rounded-full h-10 w-10 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm">
                              <X className="w-5 h-5 text-white" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION: INFORMASI DASAR (Contoh Implementasi Field) */}
          <Card>
            <CardHeader>
              <CardTitle>Informasi Dasar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama Lengkap <span className="text-red-500">*</span></Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder="Sesuai KTP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initials">Inisial</Label>
                  <Input
                    id="initials"
                    placeholder="A.B.S"
                    value={formData.initials}
                    onChange={(e) => handleChange('initials', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jenis Kelamin <span className="text-red-500">*</span></Label>
                  <Select value={formData.gender} onValueChange={(value) => handleChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Laki-laki</SelectItem>
                      <SelectItem value="female">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Agama <span className="text-red-500">*</span></Label>
                  <Select value={formData.religion} onValueChange={(value) => handleChange('religion', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="islam">Islam</SelectItem>
                      <SelectItem value="kristen">Kristen</SelectItem>
                      <SelectItem value="katolik">Katolik</SelectItem>
                      <SelectItem value="hindu">Hindu</SelectItem>
                      <SelectItem value="buddha">Buddha</SelectItem>
                      <SelectItem value="khonghucu">Khonghucu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Tanggal Lahir <span className="text-red-500">*</span></Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Tempat Lahir</Label>
                  <Input
                    id="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ALERTS */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* ACTION BUTTON */}
          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={isSaving}
              className="bg-rose-500 hover:bg-rose-600 text-white px-12 py-6 text-lg rounded-full shadow-lg shadow-rose-500/30 transition-all"
            >
              {isSaving ? (
                <>Menyimpan...</>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Simpan & Lanjutkan
                </>
              )}
            </Button>
          </div>

          {/* Placeholder for other sections to keep the code brief */}
          {/* Anda dapat menyalin sisa Card (Kontak, Pendidikan, dll) dari kode asli Anda 
              dan menerapkan pola handleChange yang sama */}
        </form>
      </div>
    </div>
  )
}