'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
// Kita tidak menggunakan komponen Card bawaan untuk fleksibilitas penuh antara 2 desain yang sangat berbeda
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, User, Camera, Upload, Save, X, ArrowLeft, MapPin, Briefcase, GraduationCap, Heart, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// 1. Type Definition (Tetap Sama)
interface ProfileFormData {
  photoUrl?: string;
  fullName: string;
  initials: string;
  gender: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  country: string;
  religion: string;
  maritalStatus: string;
  childrenCount?: number;
  hobbies?: string;
  interests?: string;
  preferredAgeMin?: number;
  preferredAgeMax?: number;
  preferredLocation?: string;
  expectations?: string;
  education?: string;
  workplace?: string;
  whatsapp?: string;
  instagram?: string;
  commitment?: string;
  aboutMe?: string;
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
  maritalStatus: '',
  childrenCount: undefined,
  hobbies: '',
  interests: '',
  preferredAgeMin: undefined,
  preferredAgeMax: undefined,
  preferredLocation: '',
  expectations: '',
  education: '',
  workplace: '',
  whatsapp: '',
  instagram: ''
}

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [maxDob, setMaxDob] = useState<string>('')
  
  useEffect(() => {
    setMaxDob(new Date().toISOString().split('T')[0])
  }, [])

  // Form State (Tetap Sama)
  const [formData, setFormData] = useState<ProfileFormData>(INITIAL_FORM_STATE)
  const [educations, setEducations] = useState<Array<{ level: string; institution: string; year: string; major: string }>>([])
  const [jobs, setJobs] = useState<Array<{ position: string; company: string; year: string; notes: string }>>([])
  const [matchInfo, setMatchInfo] = useState<{ status: 'pending' | 'approved' | 'rejected'; step?: string } | null>(null)
  const [kabkotaList, setKabkotaList] = useState<string[]>([])
  const [isKabKotaLoading, setIsKabKotaLoading] = useState(false)
  const [isKabKotaLoaded, setIsKabKotaLoaded] = useState(false)
  
  const computedAge = (() => {
    if (!formData.dateOfBirth) return ''
    const dob = new Date(formData.dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    return String(age)
  })()

  // Photo & Camera State (Tetap Sama)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 2. Load Data (Tetap Sama)
  useEffect(() => {
    loadProfile()
    loadMatchStatus()
    return () => stopCamera()
  }, [])

  const loadKabKotaList = async () => {
    if (isKabKotaLoaded || isKabKotaLoading) return
    setIsKabKotaLoading(true)
    try {
      const base = 'https://ibnux.github.io/data-indonesia'
      const provRes = await fetch(`${base}/provinsi.json`)
      const provs = await provRes.json()
      const tasks = (provs || []).map((p: any) =>
        Promise.all([
          fetch(`${base}/kabupaten/${p.id}.json`).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`${base}/kota/${p.id}.json`).then(r => r.ok ? r.json() : []).catch(() => []),
        ])
      )
      const results = await Promise.all(tasks)
      const names: string[] = []
      for (const [kabs, kotas] of results) {
        for (const item of (kabs || [])) names.push(item.nama)
        for (const item of (kotas || [])) names.push(item.nama)
      }
      const uniq = Array.from(new Set(names)).sort()
      setKabkotaList(uniq)
      setIsKabKotaLoaded(true)
    } catch { /* ignore */ } finally {
      setIsKabKotaLoading(false)
    }
  }

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
        const p = data.profile
        setFormData(prev => ({ ...prev, ...p }))
        if (p.education) {
          try { const arr = JSON.parse(p.education); if (Array.isArray(arr)) setEducations(arr) } catch {}
        }
        if (p.workplace) {
          try { const arr = JSON.parse(p.workplace); if (Array.isArray(arr)) setJobs(arr) } catch {}
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const loadMatchStatus = async () => {
    try {
      const res = await fetch('/api/match')
      const data = await res.json()
      if (res.ok) {
        setMatchInfo(data.match ? { status: data.match.status, step: data.match.step } : null)
      }
    } catch (err) { console.error(err) }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const validateForm = (): boolean => {
    const requiredFields = ['fullName', 'gender', 'dateOfBirth', 'religion', 'nationality', 'city']
    const missingFields = requiredFields.filter(field => !formData[field])
    
    if (missingFields.length > 0) {
      setError('Harap lengkapi informasi dasar (Nama, Jenis Kelamin, Tanggal Lahir, Agama)')
      return false
    }
    if (formData.phone && !/^\+?\d{8,15}$/.test(String(formData.phone))) {
      setError('Nomor HP/WhatsApp tidak valid')
      return false
    }
    if (formData.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(formData.email))) {
      setError('Email tidak valid')
      return false
    }
    if (formData.maritalStatus === 'married' && (!formData.childrenCount || Number(formData.childrenCount) < 0)) {
      setError('Jumlah anak tidak valid')
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
      const payload: any = {
        photoUrl: formData.photoUrl,
        fullName: formData.fullName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        placeOfBirth: formData.placeOfBirth,
        nationality: formData.nationality,
        city: formData.city,
        province: formData.province,
        country: formData.country,
        whatsapp: formData.whatsapp,
        instagram: formData.instagram,
        religion: formData.religion,
        maritalStatus: formData.maritalStatus,
        childrenCount: formData.childrenCount ? Number(formData.childrenCount) : undefined,
        hobbies: formData.hobbies,
        interests: formData.interests,
        preferredAgeMin: formData.preferredAgeMin ? Number(formData.preferredAgeMin) : undefined,
        preferredAgeMax: formData.preferredAgeMax ? Number(formData.preferredAgeMax) : undefined,
        preferredLocation: formData.preferredLocation,
        expectations: formData.expectations,
        aboutMe: (formData as any).aboutMe,
        commitment: (formData as any).commitment
      }
      if (educations.length > 0) payload.education = JSON.stringify(educations)
      if (jobs.length > 0) payload.workplace = JSON.stringify(jobs)
      
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan biodata')

      setSuccess('Biodata berhasil disimpan!')
      try {
        const dash = await fetch('/api/dashboard', { method: 'GET' })
        if (dash.ok) {
          const j = await dash.json()
          const psychDone = !!j?.flags?.psychotestCompleted
          const profileDone = !!j?.flags?.profileCompleted
          if (psychDone && profileDone) {
            router.push('/dashboard')
          } else {
            setTimeout(() => router.push('/dashboard/psychotest'), 1500)
          }
        } else {
          setTimeout(() => router.push('/dashboard/psychotest'), 1500)
        }
      } catch {
        setTimeout(() => router.push('/dashboard/psychotest'), 1500)
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Hanya file gambar yang diperbolehkan'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran foto maksimal 5MB'); return }

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
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } } 
      })
      setCameraStream(stream)
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setError('Izin kamera ditolak.')
      else if (err.name === 'NotFoundError') setError('Tidak ditemukan kamera.')
      else setError('Gagal mengakses kamera.')
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
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        await handleFileChange(file)
        stopCamera()
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 md:bg-pink-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="text-slate-600 font-medium tracking-wide">Memuat biodata...</p>
        </div>
      </div>
    )
  }

  return (
    // WRAPPER UTAMA
    // Mobile: Gray background, full width. Desktop: Pink background, centered.
    <div className="min-h-screen bg-gray-50 md:bg-pink-50 pb-24 md:pb-12">
      
      {/* MOBILE APP BAR (Hidden on Desktop) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 shadow-sm">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-slate-800 text-sm tracking-wide">Lengkapi Biodata</h1>
        <div className="w-8"></div> {/* Spacer for balance */}
      </header>

      {/* DESKTOP HEADER (Hidden on Mobile) */}
      <div className="hidden md:block text-center space-y-3 pt-12 pb-8 px-4">
        <h1 className="text-3xl font-bold text-pink-900 tracking-tight">Lengkapi Biodata</h1>
        <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
          Mohon lengkapi biodata Anda dengan jujur dan akurat.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        
        {/* CONTAINER FORM */}
        {/* Mobile: full width padding. Desktop: max-w-3xl centered. */}
        <div className="max-w-3xl mx-auto px-4 md:px-0 space-y-4 md:space-y-8">
          
          {/* SECTION: FOTO */}
          {/* Mobile: White Card, rounded-xl. Desktop: Glassmorphism Card, rounded-3xl. */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            
            {/* Mobile Header Section */}
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Foto Profil</h2>
              <span className="text-xs text-pink-500 font-medium bg-pink-50 px-2 py-1 rounded-full">Wajib</span>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900 flex items-center gap-2">
                <div className="p-1.5 bg-pink-100 text-pink-600 rounded-xl"><User className="w-5 h-5" /></div>
                Foto Diri
              </h2>
              <p className="text-slate-500 text-sm pl-11 mt-1">Tampilkan potongan wajah terbaik Anda.</p>
            </div>

            <div className="p-4 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start">
              {/* Avatar Preview */}
              <div className="flex-shrink-0 relative group">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white shadow-lg shadow-gray-200/50 md:shadow-pink-200/50 overflow-hidden bg-gray-100 flex items-center justify-center relative">
                  {photoPreview || formData.photoUrl ? (
                    <img 
                      src={photoPreview || formData.photoUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                {/* Mobile Edit Indicator Overlay (Only visible on mobile if image exists) */}
                {(photoPreview || formData.photoUrl) && (
                  <div className="md:hidden absolute bottom-0 right-0 bg-pink-500 p-1.5 rounded-full border-2 border-white text-white">
                    <Camera className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Tabs Upload/Camera */}
              <div className="flex-1 w-full max-w-md">
                <Tabs defaultValue="upload" className="w-full" onValueChange={(val) => val !== 'camera' && stopCamera()}>
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 md:bg-pink-100 p-1 h-9 mb-5 rounded-lg">
                    <TabsTrigger value="upload" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 md:data-[state=active]:text-pink-600 data-[state=active]:shadow-sm rounded-md text-xs md:text-sm font-medium transition-all">
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="camera" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 md:data-[state=active]:text-pink-600 data-[state=active]:shadow-sm rounded-md text-xs md:text-sm font-medium transition-all">
                      Kamera
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="space-y-3 mt-0">
                    <Label htmlFor="photo-file" className="cursor-pointer block group">
                      <div className="flex flex-col items-center justify-center w-full h-24 md:h-28 border-2 border-dashed border-gray-300 md:border-pink-200 rounded-xl md:rounded-2xl bg-gray-50 md:bg-pink-50/30 group-hover:bg-gray-100 md:group-hover:bg-pink-50 group-hover:border-gray-400 md:group-hover:border-pink-300 transition-all duration-300">
                        <div className="text-center space-y-2">
                          <Upload className="w-5 h-5 md:w-6 md:h-6 mx-auto text-gray-400 md:text-pink-300 group-hover:text-gray-600 md:group-hover:text-pink-500 transition-colors" />
                          <p className="text-[10px] md:text-xs text-slate-500 font-medium">Pilih Foto</p>
                        </div>
                      </div>
                      <Input id="photo-file" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isUploadingPhoto} />
                    </Label>
                    {isUploadingPhoto && <p className="text-xs text-pink-500 font-medium animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> Mengunggah...</p>}
                  </TabsContent>

                  <TabsContent value="camera" className="space-y-3 mt-0">
                    {!cameraStream ? (
                      <Button type="button" onClick={startCamera} variant="outline" className="w-full h-24 md:h-28 border-dashed rounded-xl md:rounded-2xl border-gray-300 md:border-pink-200 text-slate-500 hover:text-slate-800 md:hover:text-pink-600 hover:border-gray-400 md:hover:border-pink-300 hover:bg-gray-50 md:hover:bg-pink-50 transition-all bg-white">
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="w-5 h-5 md:w-6 md:h-6" />
                          <span className="text-xs md:text-sm font-medium">Buka Kamera</span>
                        </div>
                      </Button>
                    ) : (
                      <div className="space-y-3 bg-black rounded-xl md:rounded-2xl overflow-hidden relative aspect-video shadow-lg">
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-4">
                          <Button type="button" size="icon" onClick={capturePhoto} className="rounded-full bg-white hover:bg-gray-100 h-10 w-10 md:h-12 md:w-12 p-0 transition-transform active:scale-95 border border-gray-200">
                            <div className="w-4 h-4 md:w-5 md:h-5 bg-pink-500 rounded-full border-2 border-white"></div>
                          </Button>
                          <Button type="button" size="icon" onClick={stopCamera} variant="secondary" className="rounded-full h-8 w-8 md:h-10 md:w-10 p-0 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20">
                            <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>


          {/* SECTION: INFORMASI DASAR */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100">
               <h2 className="font-semibold text-slate-800 text-sm">Informasi Pribadi</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Informasi Dasar</h2>
            </div>
            
            <div className="p-4 md:p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="fullName" className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Nama Lengkap <span className="text-pink-500">*</span></Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder="Sesuai KTP"
                    // Mobile Style: Large, gray bg, no border. Desktop Style: Pink bg, border.
                    className="h-11 md:h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 focus-visible:ring-gray-200 md:focus-visible:ring-pink-500/20 focus-visible:border-gray-400 md:focus-visible:border-pink-400 rounded-xl text-base"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Jenis Kelamin <span className="text-pink-500">*</span></Label>
                  <Select value={formData.gender} onValueChange={(value) => handleChange('gender', value)}>
                    <SelectTrigger className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 focus:ring-gray-200 md:focus:ring-pink-500/20 focus:border-gray-400 md:focus:border-pink-400 rounded-xl text-base">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Pria</SelectItem>
                      <SelectItem value="female">Wanita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Agama <span className="text-pink-500">*</span></Label>
                  <Select value={formData.religion} onValueChange={(value) => handleChange('religion', value)}>
                    <SelectTrigger className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 focus:ring-gray-200 md:focus:ring-pink-500/20 focus:border-gray-400 md:focus:border-pink-400 rounded-xl text-base">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="dateOfBirth" className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Tanggal Lahir <span className="text-pink-500">*</span></Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    max={maxDob}
                    className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Usia</Label>
                  <Input value={computedAge} readOnly className="h-11 bg-gray-100 md:bg-pink-100/50 text-slate-500 cursor-not-allowed rounded-xl" />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="placeOfBirth" className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Tempat Lahir</Label>
                  <Input
                    id="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                    list="kabkota-list"
                    onFocus={loadKabKotaList}
                    className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Kewarganegaraan</Label>
                  <Input value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base" />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Status Pernikahan</Label>
                  <Select value={formData.maritalStatus} onValueChange={(value) => handleChange('maritalStatus', value)}>
                    <SelectTrigger className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Belum Menikah</SelectItem>
                      <SelectItem value="married">Pernah Menikah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.maritalStatus === 'married' && (
                  <div className="space-y-1.5 md:space-y-2">
                    <Label htmlFor="childrenCount" className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Jumlah Anak</Label>
                    <Input
                      id="childrenCount"
                      type="number"
                      min={0}
                      value={formData.childrenCount ?? ''}
                      onChange={(e) => handleChange('childrenCount', e.target.value)}
                      className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Kota/Kabupaten Domisili</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    list="kabkota-list"
                    onFocus={loadKabKotaList}
                    className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                  />
                  {isKabKotaLoading && !isKabKotaLoaded && (
                    <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">Memuat daftar kota/kabupaten…</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: RIWAYAT PENDIDIKAN */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center gap-2">
               <GraduationCap className="w-4 h-4 text-slate-400" />
               <h2 className="font-semibold text-slate-800 text-sm">Riwayat Pendidikan</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Riwayat Pendidikan</h2>
            </div>
            <div className="p-4 md:p-6 md:p-8 space-y-6">
              {educations.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input value={row.level} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, level: v } : r))
                  }} placeholder="Jenjang" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                  <Input value={row.institution} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, institution: v } : r))
                  }} placeholder="Institusi" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                  <Input value={row.year} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, year: v } : r))
                  }} placeholder="Tahun" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                  <Input value={row.major} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, major: v } : r))
                  }} placeholder="Jurusan" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEducations(prev => [...prev, { level: '', institution: '', year: '', major: '' }])} className="rounded-xl border-gray-200 md:border-pink-200 text-slate-700 md:text-pink-700 hover:bg-gray-50 md:hover:bg-pink-50 hover:border-gray-300 md:hover:border-pink-300 transition-colors text-xs md:text-sm px-4 h-9">
                  + Tambah Pendidikan
                </Button>
                {educations.length > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setEducations(prev => prev.slice(0, -1))} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors text-xs md:text-sm px-2">
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* SECTION: PEKERJAAN */}
          {/* SECTION: KONTAK SOSIAL */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center gap-2">
               <MessageSquare className="w-4 h-4 text-slate-400" />
               <h2 className="font-semibold text-slate-800 text-sm">Kontak Sosial</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Kontak Sosial</h2>
            </div>
            <div className="p-4 md:p-6 md:p-8 space-y-4">
              <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertDescription>Opsional: WhatsApp dan Instagram boleh dikosongkan. Dengan mengisi, Anda menyetujui kontak ini dapat ditampilkan di rekomendasi.</AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">WhatsApp</Label>
                  <Input
                    value={formData.whatsapp || ''}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    placeholder="Contoh: +6281234567890"
                    className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Instagram</Label>
                  <Input
                    value={formData.instagram || ''}
                    onChange={(e) => handleChange('instagram', e.target.value)}
                    placeholder="Contoh: @username atau link"
                    className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* SECTION: PEKERJAAN */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center gap-2">
               <Briefcase className="w-4 h-4 text-slate-400" />
               <h2 className="font-semibold text-slate-800 text-sm">Pekerjaan / Karir</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Pekerjaan / Karir</h2>
            </div>
            <div className="p-4 md:p-6 md:p-8 space-y-6">
              {jobs.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input value={row.position} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, position: v } : r))
                  }} placeholder="Posisi" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                  <Input value={row.company} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, company: v } : r))
                  }} placeholder="Perusahaan" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                  <Input value={row.year} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, year: v } : r))
                  }} placeholder="Tahun" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                  <Input value={row.notes} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, notes: v } : r))
                  }} placeholder="Keterangan" className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-sm md:text-base h-11" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setJobs(prev => [...prev, { position: '', company: '', year: '', notes: '' }])} className="rounded-xl border-gray-200 md:border-pink-200 text-slate-700 md:text-pink-700 hover:bg-gray-50 md:hover:bg-pink-50 hover:border-gray-300 md:hover:border-pink-300 transition-colors text-xs md:text-sm px-4 h-9">
                  + Tambah Pekerjaan
                </Button>
                {jobs.length > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setJobs(prev => prev.slice(0, -1))} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors text-xs md:text-sm px-2">
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* SECTION: HOBI & MINAT */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center gap-2">
               <Heart className="w-4 h-4 text-slate-400" />
               <h2 className="font-semibold text-slate-800 text-sm">Hobi & Minat</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Hobi & Minat</h2>
            </div>
            <div className="p-4 md:p-6 md:p-8">
              <Textarea value={formData.hobbies} onChange={(e) => handleChange('hobbies', e.target.value)} placeholder="Ceritakan hobi Anda di waktu luang..." className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 min-h-[100px] resize-none focus-visible:ring-gray-200 md:focus-visible:ring-pink-500/20 focus-visible:border-gray-400 md:focus-visible:border-pink-400 rounded-xl text-base" />
            </div>
          </div>
          
          {/* SECTION: PREFERENSI PASANGAN */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center gap-2">
               <User className="w-4 h-4 text-slate-400" />
               <h2 className="font-semibold text-slate-800 text-sm">Preferensi Pasangan</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Preferensi Pasangan</h2>
            </div>
            <div className="p-4 md:p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Usia Ideal Min</Label>
                  <Input type="number" value={formData.preferredAgeMin ?? ''} onChange={(e) => handleChange('preferredAgeMin', e.target.value)} className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base" />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Usia Ideal Max</Label>
                  <Input type="number" value={formData.preferredAgeMax ?? ''} onChange={(e) => handleChange('preferredAgeMax', e.target.value)} className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base" />
                </div>
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Domisili (Kota/Kabupaten)</Label>
                <Input
                  value={formData.preferredLocation}
                  onChange={(e) => handleChange('preferredLocation', e.target.value)}
                  list="kabkota-list"
                  onFocus={loadKabKotaList}
                  className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Kriteria & Harapan</Label>
                <Textarea value={formData.expectations} onChange={(e) => handleChange('expectations', e.target.value)} placeholder="Tuliskan kriteria pasangan ideal Anda..." className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 min-h-[100px] resize-none focus-visible:ring-gray-200 md:focus-visible:ring-pink-500/20 focus-visible:border-gray-400 md:focus-visible:border-pink-400 rounded-xl text-base" />
              </div>
            </div>
          </div>
          
          <datalist id="kabkota-list">
            {kabkotaList.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          
          {/* SECTION: KESIAPAN PERNIKAHAN */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-100 flex items-center gap-2">
               <Heart className="w-4 h-4 text-slate-400" />
               <h2 className="font-semibold text-slate-800 text-sm">Kesiapan Pernikahan</h2>
            </div>
            <div className="hidden md:block bg-pink-50/50 border-b border-pink-100 p-6 pb-4">
              <h2 className="text-lg font-semibold text-pink-900">Kesiapan Pernikahan</h2>
            </div>
            <div className="p-4 md:p-6 md:p-8 space-y-6">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Status Kesiapan</Label>
                <Select value={(formData as any).aboutMe || ''} onValueChange={(value) => handleChange('aboutMe', value)}>
                  <SelectTrigger className="h-11 bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 rounded-xl text-base">
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ya">Sudah Siap</SelectItem>
                    <SelectItem value="tidak">Belum Siap</SelectItem>
                    <SelectItem value="dalam_persiapan">Dalam Tahap Persiapan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-slate-600 md:text-slate-700 font-medium text-xs md:text-sm">Motivasi Menikah</Label>
                <Textarea
                  value={formData.interests}
                  onChange={(e) => handleChange('interests', e.target.value)}
                  placeholder="Bagikan alasan dan motivasi pribadi Anda..."
                  className="bg-gray-50 md:bg-pink-50/30 border-gray-200 md:border-pink-200 min-h-[100px] resize-none focus-visible:ring-gray-200 md:focus-visible:ring-pink-500/20 focus-visible:border-gray-400 md:focus-visible:border-pink-400 rounded-xl text-base"
                />
              </div>
            </div>
          </div>
          
          {/* COMMITMENT */}
          <div className="bg-white md:bg-white/80 md:backdrop-blur-sm rounded-xl md:rounded-3xl border border-gray-100 md:border-pink-200/60 shadow-sm md:shadow-sm md:shadow-pink-100/40 overflow-hidden">
            <div className="p-4 md:p-6">
              <div className="flex items-start gap-3 p-3 md:p-4 bg-gray-50 md:bg-pink-50 rounded-xl md:rounded-2xl border border-gray-100 md:border-pink-100">
                <div className="relative flex items-center mt-0.5">
                  <input type="checkbox" id="commitment" checked={(formData as any).commitment === 'true'} onChange={(e) => handleChange('commitment', e.target.checked ? 'true' : '')} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 md:border-pink-300 shadow-sm transition-all checked:border-pink-500 md:checked:border-pink-500 checked:bg-pink-500 md:checked:bg-pink-500" />
                  <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <Label htmlFor="commitment" className="cursor-pointer text-slate-700 font-medium leading-snug text-sm md:text-base">Saya menyatakan data di atas benar dan serius mengikuti proses Setaruf.</Label>
              </div>
            </div>
          </div>

          {/* SPACER for fixed bottom button on mobile */}
          <div className="h-16 md:hidden"></div>

        </div>
        
        {/* ALERTS */}
        <div className="max-w-3xl mx-auto px-4 mt-4 space-y-2">
          {error && (
            <Alert variant="destructive" className="rounded-xl bg-red-50 border-red-100 text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs md:text-sm font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="rounded-xl bg-green-50 border-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-xs md:text-sm font-medium">{success}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* ACTION BUTTON */}
        {/* Mobile: Fixed Bottom Bar. Desktop: Static Centered. */}
        <div className="fixed bottom-0 left-0 right-0 md:static bg-white md:bg-transparent border-t md:border-none border-gray-200 p-3 md:p-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-none">
          <div className="max-w-3xl mx-auto">
             <Button
              type="submit"
              size="lg"
              disabled={isSaving}
              className="w-full md:w-auto md:mx-auto md:flex md:justify-center bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-6 md:px-12 py-6 md:py-6 text-base md:text-lg rounded-xl md:rounded-full shadow-lg md:shadow-xl md:shadow-pink-500/30 transition-all active:scale-[0.98] h-12 md:h-auto font-medium"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">Menyimpan...</span>
              ) : (
                <>
                  <Save className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Simpan & Lanjutkan
                </>
              )}
            </Button>
          </div>
        </div>

      </form>
    </div>
  )
}
