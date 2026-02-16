'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, User, Upload, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    // Informasi Dasar
    fullName: '',
    initials: '',
    gender: '',
    dateOfBirth: '',
    placeOfBirth: '',
    nationality: '',

    // Informasi Kontak & Lokasi
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    country: '',

    // Informasi Pendidikan & Karir
    education: '',
    occupation: '',
    company: '',
    income: '',
    workplace: '',

    // Informasi Fisik
    height: '',
    weight: '',
    bodyType: '',
    skinColor: '',
    faceShape: '',

    // Informasi Agama & Spiritual
    religion: '',
    religiousLevel: '',
    prayerFrequency: '',
    quranAbility: '',

    // Informasi Keluarga
    maritalStatus: '',
    childrenCount: 0,
    fatherName: '',
    fatherOccupation: '',
    motherName: '',
    motherOccupation: '',
    siblingsCount: '',

    // Informasi Hobi & Minat
    hobbies: '',
    interests: '',

    // Kriteria Pasangan
    preferredAgeMin: '',
    preferredAgeMax: '',
    preferredEducation: '',
    preferredOccupation: '',
    preferredLocation: '',
    preferredReligionLevel: '',

    // Kesehatan
    healthCondition: '',
    disabilities: '',

    // Additional Info
    aboutMe: '',
    expectations: '',
  })

  useEffect(() => {
    // Load existing profile data
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/profile')
      const data = await response.json()

      if (response.ok && data.profile) {
        setFormData(data.profile)
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validasi dasar
    if (!formData.fullName || !formData.gender || !formData.dateOfBirth || !formData.religion) {
      setError('Harap lengkapi informasi dasar (Nama, Jenis Kelamin, Tanggal Lahir, Agama)')
      return
    }

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

      // Redirect to psychotest page after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/psychotest')
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat biodata...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lengkapi Biodata</h1>
          <p className="text-gray-600">Mohon lengkapi biodata Anda dengan jujur dan akurat</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Informasi Dasar */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-rose-500" />
                Informasi Dasar
              </CardTitle>
              <CardDescription>Informasi pribadi dasar Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama Lengkap *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initials">Inisial Nama (untuk display)</Label>
                  <Input
                    id="initials"
                    placeholder="Contoh: A.B.S"
                    value={formData.initials}
                    onChange={(e) => handleChange('initials', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Jenis Kelamin *</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Laki-laki</SelectItem>
                      <SelectItem value="female">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Tanggal Lahir *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Tempat Lahir</Label>
                  <Input
                    id="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Kewarganegaraan</Label>
                  <Input
                    id="nationality"
                    placeholder="Indonesia"
                    value={formData.nationality}
                    onChange={(e) => handleChange('nationality', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informasi Kontak & Lokasi */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informasi Kontak & Lokasi</CardTitle>
              <CardDescription>Cara menghubungi dan lokasi Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Nomor Telepon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+62 xxx xxxx xxxx"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Alamat Lengkap</Label>
                <Textarea
                  id="address"
                  placeholder="Alamat lengkap domisili"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Kota/Kabupaten (Domisili)</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Provinsi</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => handleChange('province', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Negara</Label>
                  <Input
                    id="country"
                    placeholder="Indonesia"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informasi Pendidikan & Karir */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Pendidikan & Karir</CardTitle>
              <CardDescription>Informasi pendidikan dan pekerjaan Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="education">Pendidikan Terakhir</Label>
                <Select value={formData.education} onValueChange={(value) => handleChange('education', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pendidikan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sma">SMA/SMK</SelectItem>
                    <SelectItem value="d3">Diploma 3</SelectItem>
                    <SelectItem value="s1">Sarjana (S1)</SelectItem>
                    <SelectItem value="s2">Magister (S2)</SelectItem>
                    <SelectItem value="s3">Doktor (S3)</SelectItem>
                    <SelectItem value="lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">Pekerjaan</Label>
                  <Input
                    id="occupation"
                    placeholder="Contoh: Software Engineer"
                    value={formData.occupation}
                    onChange={(e) => handleChange('occupation', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Nama Perusahaan/Instansi</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleChange('company', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="income">Rentang Pendapatan</Label>
                  <Select value={formData.income} onValueChange={(value) => handleChange('income', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih rentang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<3">Di bawah 3 juta</SelectItem>
                      <SelectItem value="3-5">3 - 5 juta</SelectItem>
                      <SelectItem value="5-10">5 - 10 juta</SelectItem>
                      <SelectItem value="10-20">10 - 20 juta</SelectItem>
                      <SelectItem value=">20">Di atas 20 juta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workplace">Lokasi Tempat Kerja</Label>
                  <Input
                    id="workplace"
                    placeholder="Kota tempat bekerja"
                    value={formData.workplace}
                    onChange={(e) => handleChange('workplace', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informasi Fisik */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informasi Fisik</CardTitle>
              <CardDescription>Deskripsi fisik Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Tinggi Badan (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={formData.height}
                    onChange={(e) => handleChange('height', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Berat Badan (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bodyType">Tipe Tubuh</Label>
                  <Select value={formData.bodyType} onValueChange={(value) => handleChange('bodyType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thin">Kurus</SelectItem>
                      <SelectItem value="athletic">Atletis</SelectItem>
                      <SelectItem value="average">Sedang</SelectItem>
                      <SelectItem value="plus">Gemuk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skinColor">Warna Kulit</Label>
                  <Select value={formData.skinColor} onValueChange={(value) => handleChange('skinColor', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fair">Putih</SelectItem>
                      <SelectItem value="medium">Sawo Matang</SelectItem>
                      <SelectItem value="dark">Gelap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faceShape">Bentuk Wajah</Label>
                  <Select value={formData.faceShape} onValueChange={(value) => handleChange('faceShape', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oval">Oval</SelectItem>
                      <SelectItem value="round">Bulat</SelectItem>
                      <SelectItem value="square">Kotak</SelectItem>
                      <SelectItem value="heart">Hati</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informasi Agama & Spiritual */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Agama & Spiritual</CardTitle>
              <CardDescription>Informasi keagamaan Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="religion">Agama *</Label>
                <Select value={formData.religion} onValueChange={(value) => handleChange('religion', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih agama" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="islam">Islam</SelectItem>
                    <SelectItem value="kristen">Kristen</SelectItem>
                    <SelectItem value="katolik">Katolik</SelectItem>
                    <SelectItem value="hindu">Hindu</SelectItem>
                    <SelectItem value="buddha">Buddha</SelectItem>
                    <SelectItem value="khonghucu">Khonghucu</SelectItem>
                    <SelectItem value="lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="religiousLevel">Tingkat Keagamaan</Label>
                <Select value={formData.religiousLevel} onValueChange={(value) => handleChange('religiousLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sangat_taat">Sangat Taat</SelectItem>
                    <SelectItem value="taat">Taat</SelectItem>
                    <SelectItem value="cukup">Cukup</SelectItem>
                    <SelectItem value="biasa">Biasa Saja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prayerFrequency">Frekuensi Ibadah</Label>
                <Select value={formData.prayerFrequency} onValueChange={(value) => handleChange('prayerFrequency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5_waktu">5 Waktu Setiap Hari</SelectItem>
                    <SelectItem value="sering">Sering</SelectItem>
                    <SelectItem value="kadang">Kadang-kadang</SelectItem>
                    <SelectItem value="jarang">Jarang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quranAbility">Kemampuan Baca Al-Quran / Kitab Suci</Label>
                <Select value={formData.quranAbility} onValueChange={(value) => handleChange('quranAbility', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lancar">Lancar</SelectItem>
                    <SelectItem value="sedang">Sedang</SelectItem>
                    <SelectItem value="pemula">Pemula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Informasi Keluarga */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informasi Keluarga</CardTitle>
              <CardDescription>Data keluarga Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maritalStatus">Status Pernikahan</Label>
                <Select value={formData.maritalStatus} onValueChange={(value) => handleChange('maritalStatus', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Belum Menikah</SelectItem>
                    <SelectItem value="janda">Janda</SelectItem>
                    <SelectItem value="duda">Duda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="childrenCount">Jumlah Anak</Label>
                <Input
                  id="childrenCount"
                  type="number"
                  min="0"
                  value={formData.childrenCount}
                  onChange={(e) => handleChange('childrenCount', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fatherName">Nama Ayah</Label>
                  <Input
                    id="fatherName"
                    value={formData.fatherName}
                    onChange={(e) => handleChange('fatherName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fatherOccupation">Pekerjaan Ayah</Label>
                  <Input
                    id="fatherOccupation"
                    value={formData.fatherOccupation}
                    onChange={(e) => handleChange('fatherOccupation', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="motherName">Nama Ibu</Label>
                  <Input
                    id="motherName"
                    value={formData.motherName}
                    onChange={(e) => handleChange('motherName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motherOccupation">Pekerjaan Ibu</Label>
                  <Input
                    id="motherOccupation"
                    value={formData.motherOccupation}
                    onChange={(e) => handleChange('motherOccupation', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siblingsCount">Jumlah Saudara Kandung</Label>
                <Input
                  id="siblingsCount"
                  type="number"
                  min="0"
                  value={formData.siblingsCount}
                  onChange={(e) => handleChange('siblingsCount', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Hobi & Minat */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Hobi & Minat</CardTitle>
              <CardDescription>Apa yang Anda sukai?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hobbies">Hobi</Label>
                <Textarea
                  id="hobbies"
                  placeholder="Sebutkan hobi Anda, pisahkan dengan koma"
                  value={formData.hobbies}
                  onChange={(e) => handleChange('hobbies', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">Minat</Label>
                <Textarea
                  id="interests"
                  placeholder="Hal-hal yang Anda minati"
                  value={formData.interests}
                  onChange={(e) => handleChange('interests', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Kriteria Pasangan */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Kriteria Pasangan</CardTitle>
              <CardDescription>Apa yang Anda cari dari pasangan?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredAgeMin">Usia Minimal</Label>
                  <Input
                    id="preferredAgeMin"
                    type="number"
                    min="17"
                    value={formData.preferredAgeMin}
                    onChange={(e) => handleChange('preferredAgeMin', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredAgeMax">Usia Maksimal</Label>
                  <Input
                    id="preferredAgeMax"
                    type="number"
                    min="17"
                    value={formData.preferredAgeMax}
                    onChange={(e) => handleChange('preferredAgeMax', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredEducation">Pendidikan Pasangan</Label>
                  <Input
                    id="preferredEducation"
                    placeholder="Pendidikan minimal yang diinginkan"
                    value={formData.preferredEducation}
                    onChange={(e) => handleChange('preferredEducation', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredOccupation">Pekerjaan Pasangan</Label>
                  <Input
                    id="preferredOccupation"
                    placeholder="Pekerjaan yang diinginkan"
                    value={formData.preferredOccupation}
                    onChange={(e) => handleChange('preferredOccupation', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredLocation">Lokasi Pasangan</Label>
                  <Input
                    id="preferredLocation"
                    placeholder="Lokasi yang diinginkan"
                    value={formData.preferredLocation}
                    onChange={(e) => handleChange('preferredLocation', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredReligionLevel">Tingkat Keagamaan Pasangan</Label>
                  <Select value={formData.preferredReligionLevel} onValueChange={(value) => handleChange('preferredReligionLevel', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sangat_taat">Sangat Taat</SelectItem>
                      <SelectItem value="taat">Taat</SelectItem>
                      <SelectItem value="cukup">Cukup</SelectItem>
                      <SelectItem value="semua">Semua</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kesehatan */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Kesehatan</CardTitle>
              <CardDescription>Informasi kesehatan Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="healthCondition">Kondisi Kesehatan</Label>
                <Textarea
                  id="healthCondition"
                  placeholder="Jelaskan kondisi kesehatan Anda (jika ada)"
                  value={formData.healthCondition}
                  onChange={(e) => handleChange('healthCondition', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disabilities">Disabilitas (jika ada)</Label>
                <Textarea
                  id="disabilities"
                  placeholder="Jelaskan jika ada disabilitas fisik/mental"
                  value={formData.disabilities}
                  onChange={(e) => handleChange('disabilities', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Tentang Saya & Ekspektasi</CardTitle>
              <CardDescription>Ceritakan lebih banyak tentang Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aboutMe">Tentang Saya</Label>
                <Textarea
                  id="aboutMe"
                  placeholder="Ceritakan tentang diri Anda, kepribadian, dan hal-hal penting lainnya"
                  value={formData.aboutMe}
                  onChange={(e) => handleChange('aboutMe', e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectations">Ekspektasi Pernikahan</Label>
                <Textarea
                  id="expectations"
                  placeholder="Apa yang Anda harapkan dari pernikahan?"
                  value={formData.expectations}
                  onChange={(e) => handleChange('expectations', e.target.value)}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={isSaving}
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 px-12"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Menyimpan...' : 'Simpan & Lanjutkan ke Psikotes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
