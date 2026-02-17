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

// 1. Type Definition
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
  workplace: ''
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

  // Form State
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

  // Photo & Camera State
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 2. Load Data
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
        religion: formData.religion,
        maritalStatus: formData.maritalStatus,
        childrenCount: formData.childrenCount ? Number(formData.childrenCount) : undefined,
        hobbies: formData.hobbies,
        interests: formData.interests,
        preferredAgeMin: formData.preferredAgeMin ? Number(formData.preferredAgeMin) : undefined,
        preferredAgeMax: formData.preferredAgeMax ? Number(formData.preferredAgeMax) : undefined,
        preferredLocation: formData.preferredLocation,
        expectations: formData.expectations,
        aboutMe: (formData as any).aboutMe
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
      setTimeout(() => router.push('/dashboard/psychotest'), 2000)

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
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="text-slate-600 font-medium tracking-wide">Memuat biodata...</p>
        </div>
      </div>
    )
  }

  return (
    // BACKGROUND PINK THEME
    <div className="min-h-screen bg-pink-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-3xl font-bold text-pink-900 tracking-tight">Lengkapi Biodata</h1>
          <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
            Mohon lengkapi biodata Anda dengan jujur dan akurat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* SECTION: FOTO */}
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-pink-800 text-lg font-semibold">
                <div className="p-1.5 bg-pink-100 text-pink-600 rounded-xl"><User className="w-5 h-5" /></div>
                Foto Diri
              </CardTitle>
              <CardDescription className="text-slate-500 text-sm pl-11">Tampilkan potongan wajah terbaik Anda.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start justify-center sm:justify-start">
                {/* Avatar Preview */}
                <div className="flex-shrink-0 relative group">
                  <div className="w-36 h-36 rounded-full border-4 border-white shadow-lg shadow-pink-200/50 overflow-hidden bg-pink-50 flex items-center justify-center relative">
                    {photoPreview || formData.photoUrl ? (
                      <img 
                        src={photoPreview || formData.photoUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <User className="w-14 h-14 text-pink-200" />
                    )}
                  </div>
                </div>

                {/* Tabs Upload/Camera */}
                <div className="flex-1 w-full max-w-md">
                  <Tabs defaultValue="upload" className="w-full" onValueChange={(val) => val !== 'camera' && stopCamera()}>
                    <TabsList className="grid w-full grid-cols-2 bg-pink-100 p-1 h-9 mb-5">
                      <TabsTrigger value="upload" className="data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm rounded-md text-sm font-medium transition-all">Upload File</TabsTrigger>
                      <TabsTrigger value="camera" className="data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm rounded-md text-sm font-medium transition-all">Kamera</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="space-y-3 mt-0">
                      <Label htmlFor="photo-file" className="cursor-pointer block group">
                        <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-pink-200 rounded-2xl bg-pink-50/30 group-hover:bg-pink-50 group-hover:border-pink-300 transition-all duration-300">
                          <div className="text-center space-y-2">
                            <Upload className="w-6 h-6 mx-auto text-pink-300 group-hover:text-pink-500 transition-colors" />
                            <p className="text-xs text-slate-500 font-medium">Klik untuk memilih foto</p>
                          </div>
                        </div>
                        <Input id="photo-file" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isUploadingPhoto} />
                      </Label>
                      {isUploadingPhoto && <p className="text-xs text-pink-500 font-medium animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> Mengunggah...</p>}
                    </TabsContent>

                    <TabsContent value="camera" className="space-y-3 mt-0">
                      {!cameraStream ? (
                        <Button type="button" onClick={startCamera} variant="outline" className="w-full h-28 border-dashed rounded-2xl border-pink-200 text-slate-500 hover:text-pink-600 hover:border-pink-300 hover:bg-pink-50 transition-all">
                          <div className="flex flex-col items-center gap-2">
                            <Camera className="w-6 h-6" />
                            <span className="text-sm font-medium">Buka Kamera</span>
                          </div>
                        </Button>
                      ) : (
                        <div className="space-y-3 bg-black rounded-2xl overflow-hidden relative aspect-video shadow-lg shadow-pink-200/20">
                          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-4">
                            <Button type="button" size="icon" onClick={capturePhoto} className="rounded-full bg-white hover:bg-pink-50 h-12 w-12 p-0 transition-transform active:scale-95 border border-pink-100">
                              <div className="w-5 h-5 bg-pink-500 rounded-full border-2 border-white"></div>
                            </Button>
                            <Button type="button" size="icon" onClick={stopCamera} variant="secondary" className="rounded-full h-10 w-10 p-0 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20">
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


          {/* SECTION: INFORMASI DASAR */}
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="text-lg font-semibold text-pink-900">Informasi Dasar</CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-700 font-medium text-sm">Nama Lengkap <span className="text-pink-500">*</span></Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder="Sesuai KTP"
                    className="h-11 bg-pink-50/30 border-pink-200 focus-visible:ring-pink-500/20 focus-visible:border-pink-400"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Jenis Kelamin <span className="text-pink-500">*</span></Label>
                  <Select value={formData.gender} onValueChange={(value) => handleChange('gender', value)}>
                    <SelectTrigger className="h-11 bg-pink-50/30 border-pink-200 focus:ring-pink-500/20 focus:border-pink-400">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Pria</SelectItem>
                      <SelectItem value="female">Wanita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Agama <span className="text-pink-500">*</span></Label>
                  <Select value={formData.religion} onValueChange={(value) => handleChange('religion', value)}>
                    <SelectTrigger className="h-11 bg-pink-50/30 border-pink-200 focus:ring-pink-500/20 focus:border-pink-400">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="text-slate-700 font-medium text-sm">Tanggal Lahir <span className="text-pink-500">*</span></Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    max={maxDob}
                    className="h-11 bg-pink-50/30 border-pink-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Usia</Label>
                  <Input value={computedAge} readOnly className="h-11 bg-pink-100/50 text-slate-500 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth" className="text-slate-700 font-medium text-sm">Tempat Lahir</Label>
                  <Input
                    id="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                    list="kabkota-list"
                    onFocus={loadKabKotaList}
                    className="h-11 bg-pink-50/30 border-pink-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Kewarganegaraan</Label>
                  <Input value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} className="h-11 bg-pink-50/30 border-pink-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Status Pernikahan</Label>
                  <Select value={formData.maritalStatus} onValueChange={(value) => handleChange('maritalStatus', value)}>
                    <SelectTrigger className="h-11 bg-pink-50/30 border-pink-200">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Belum Menikah</SelectItem>
                      <SelectItem value="married">Pernah Menikah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.maritalStatus === 'married' && (
                  <div className="space-y-2">
                    <Label htmlFor="childrenCount" className="text-slate-700 font-medium text-sm">Jumlah Anak</Label>
                    <Input
                      id="childrenCount"
                      type="number"
                      min={0}
                      value={formData.childrenCount ?? ''}
                      onChange={(e) => handleChange('childrenCount', e.target.value)}
                      className="h-11 bg-pink-50/30 border-pink-200"
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Kota/Kabupaten Domisili</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    list="kabkota-list"
                    onFocus={loadKabKotaList}
                    className="h-11 bg-pink-50/30 border-pink-200"
                  />
                  {isKabKotaLoading && !isKabKotaLoaded && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">Memuat daftar kota/kabupaten…</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          
          
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="text-lg font-semibold text-pink-900">Riwayat Pendidikan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              {educations.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <Input value={row.level} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, level: v } : r))
                  }} placeholder="Jenjang" className="bg-pink-50/30 border-pink-200" />
                  <Input value={row.institution} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, institution: v } : r))
                  }} placeholder="Institusi" className="bg-pink-50/30 border-pink-200" />
                  <Input value={row.year} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, year: v } : r))
                  }} placeholder="Tahun" className="bg-pink-50/30 border-pink-200" />
                  <Input value={row.major} onChange={(e) => {
                    const v = e.target.value
                    setEducations(prev => prev.map((r, i) => i === idx ? { ...r, major: v } : r))
                  }} placeholder="Jurusan" className="bg-pink-50/30 border-pink-200" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEducations(prev => [...prev, { level: '', institution: '', year: '', major: '' }])} className="rounded-xl border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 hover:border-pink-300 transition-colors">
                  + Tambah Baris
                </Button>
                {educations.length > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setEducations(prev => prev.slice(0, -1))} className="text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-xl transition-colors">
                    Hapus Terakhir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="text-lg font-semibold text-pink-900">Pekerjaan / Karir</CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              {jobs.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <Input value={row.position} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, position: v } : r))
                  }} placeholder="Posisi" className="bg-pink-50/30 border-pink-200" />
                  <Input value={row.company} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, company: v } : r))
                  }} placeholder="Perusahaan" className="bg-pink-50/30 border-pink-200" />
                  <Input value={row.year} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, year: v } : r))
                  }} placeholder="Tahun" className="bg-pink-50/30 border-pink-200" />
                  <Input value={row.notes} onChange={(e) => {
                    const v = e.target.value
                    setJobs(prev => prev.map((r, i) => i === idx ? { ...r, notes: v } : r))
                  }} placeholder="Keterangan" className="bg-pink-50/30 border-pink-200" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setJobs(prev => [...prev, { position: '', company: '', year: '', notes: '' }])} className="rounded-xl border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 hover:border-pink-300 transition-colors">
                  + Tambah Baris
                </Button>
                {jobs.length > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setJobs(prev => prev.slice(0, -1))} className="text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-xl transition-colors">
                    Hapus Terakhir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="text-lg font-semibold text-pink-900">Hobi & Minat</CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <Textarea value={formData.hobbies} onChange={(e) => handleChange('hobbies', e.target.value)} placeholder="Ceritakan hobi Anda di waktu luang..." className="bg-pink-50/30 border-pink-200 min-h-[100px] resize-none focus-visible:ring-pink-500/20 focus-visible:border-pink-400" />
            </CardContent>
          </Card>
          
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="text-lg font-semibold text-pink-900">Preferensi Pasangan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Usia Ideal Min</Label>
                  <Input type="number" value={formData.preferredAgeMin ?? ''} onChange={(e) => handleChange('preferredAgeMin', e.target.value)} className="bg-pink-50/30 border-pink-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Usia Ideal Max</Label>
                  <Input type="number" value={formData.preferredAgeMax ?? ''} onChange={(e) => handleChange('preferredAgeMax', e.target.value)} className="bg-pink-50/30 border-pink-200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium text-sm">Domisili (Kota/Kabupaten)</Label>
                <Input
                  value={formData.preferredLocation}
                  onChange={(e) => handleChange('preferredLocation', e.target.value)}
                  list="kabkota-list"
                  onFocus={loadKabKotaList}
                  className="bg-pink-50/30 border-pink-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium text-sm">Kriteria & Harapan</Label>
                <Textarea value={formData.expectations} onChange={(e) => handleChange('expectations', e.target.value)} placeholder="Tuliskan kriteria pasangan ideal Anda..." className="bg-pink-50/30 border-pink-200 min-h-[100px] resize-none focus-visible:ring-pink-500/20 focus-visible:border-pink-400" />
              </div>
            </CardContent>
          </Card>
          
          <datalist id="kabkota-list">
            {kabkotaList.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-pink-50/50 border-b border-pink-100 pb-4">
              <CardTitle className="text-lg font-semibold text-pink-900">Kesiapan Pernikahan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium text-sm">Status Kesiapan</Label>
                <Select value={(formData as any).aboutMe || ''} onValueChange={(value) => handleChange('aboutMe', value)}>
                  <SelectTrigger className="h-11 bg-pink-50/30 border-pink-200">
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ya">Sudah Siap</SelectItem>
                    <SelectItem value="tidak">Belum Siap</SelectItem>
                    <SelectItem value="dalam_persiapan">Dalam Tahap Persiapan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium text-sm">Motivasi Menikah</Label>
                <Textarea
                  value={formData.interests}
                  onChange={(e) => handleChange('interests', e.target.value)}
                  placeholder="Bagikan alasan dan motivasi pribadi Anda..."
                  className="bg-pink-50/30 border-pink-200 min-h-[100px] resize-none focus-visible:ring-pink-500/20 focus-visible:border-pink-400"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-pink-200/60 shadow-sm shadow-pink-100/40 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 p-4 bg-pink-50 rounded-2xl border border-pink-100">
                <div className="relative flex items-center">
                  <input type="checkbox" id="commitment" checked={(formData as any).commitment === true} onChange={(e) => handleChange('commitment', e.target.checked ? 'true' : '')} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-pink-300 shadow-sm transition-all checked:border-pink-500 checked:bg-pink-500" />
                  <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <Label htmlFor="commitment" className="cursor-pointer text-slate-700 font-medium leading-tight">Saya menyatakan data di atas benar dan serius mengikuti proses Setaruf.</Label>
              </div>
            </CardContent>
          </Card>
          
          {/* ALERTS */}
          {error && (
            <Alert variant="destructive" className="rounded-2xl bg-red-50 border-red-100 text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="rounded-2xl bg-green-50 border-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm font-medium">{success}</AlertDescription>
            </Alert>
          )}

          {/* ACTION BUTTON */}
          <div className="flex justify-center pt-6 pb-12">
            <Button
              type="submit"
              size="lg"
              disabled={isSaving}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-12 py-6 text-lg rounded-full shadow-xl shadow-pink-500/30 transition-all hover:scale-105 active:scale-95 h-auto"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">Menyimpan...</span>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Simpan & Lanjutkan
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}