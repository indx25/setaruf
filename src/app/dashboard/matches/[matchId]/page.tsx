'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  MessageCircle,
  ShieldCheck,
  User,
  Calendar,
  MapPin,
  Briefcase,
  Heart,
  ArrowLeft,
  Camera,
  FileText,
  X
} from 'lucide-react'

export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string

  const [isLoading, setIsLoading] = useState(true)
  const [match, setMatch] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<any>(null)
  const [error, setError] = useState('')
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [approveAction, setApproveAction] = useState<string>('')

  const loadMatchData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/matches/${matchId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat data')
      }

      setMatch(data.match)
      setOtherUser(data.otherUser)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMatchData()
  }, [matchId])

  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Action gagal')
      }

      // Reload data
      await loadMatchData()
      setShowApproveDialog(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleConfirmApprove = () => {
    handleAction(approveAction)
  }

  const getStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      profile_request: 'Request Profil',
      profile_viewed: 'Profil Dilihat',
      photo_requested: 'Request Foto',
      photo_approved: 'Foto Disetujui',
      photo_rejected: 'Foto Ditolak',
      full_data_requested: 'Request Biodata Lengkap',
      full_data_approved: 'Biodata Lengkap Disetujui',
      full_data_rejected: 'Biodata Lengkap Ditolak',
      chatting: 'Saling Mengenal'
    }
    return labels[step] || step
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      blocked: 'bg-gray-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (error || !match || !otherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Data tidak ditemukan'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const profile = otherUser.profile || {}
  const initials = profile.initials || getInitials(otherUser.name || '')
  const canViewProfile = match.status === 'approved' || match.step === 'profile_viewed' || match.step.startsWith('photo') || match.step.startsWith('full_data') || match.step === 'chatting'
  const canViewPhoto = match.step === 'photo_approved' || match.step === 'full_data_approved' || match.step === 'chatting'
  const canViewFullBiodata = match.step === 'full_data_approved' || match.step === 'chatting'
  const canChat = match.step === 'chatting'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Detail Match</h1>
              <p className="text-sm text-gray-500">
                {initials} • {profile.age || '-'} tahun
              </p>
            </div>
          </div>
          <Badge className={`${getStatusColor(match.status)} text-white`}>
            {match.status === 'pending' ? 'Menunggu' : match.status === 'approved' ? 'Disetujui' : match.status}
          </Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={canViewPhoto ? profile.photoUrl || otherUser.avatar : undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-2xl">
                      {canViewProfile ? initials : initials}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Briefcase className="w-4 h-4" />
                      {profile.occupation || 'Pekerjaan tidak tersedia'}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {profile.age || '-'} tahun
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {profile.city || 'Domisili tidak tersedia'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-rose-500">
                      {match.matchPercentage ? match.matchPercentage.toFixed(0) : 0}%
                    </div>
                    <div className="text-sm text-gray-500">Kecocokan</div>
                  </div>
                </div>
              </CardHeader>

              {canViewFullBiodata && (
                <CardContent className="space-y-6">
                  {/* Informasi Pribadi */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="w-5 h-5 text-rose-500" />
                      Informasi Pribadi
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Tanggal Lahir:</span>
                        <span className="ml-2 font-medium">
                          {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('id-ID') : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tempat Lahir:</span>
                        <span className="ml-2 font-medium">{profile.placeOfBirth || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Kewarganegaraan:</span>
                        <span className="ml-2 font-medium">{profile.nationality || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status Pernikahan:</span>
                        <span className="ml-2 font-medium">
                          {profile.maritalStatus === 'single' ? 'Belum Menikah' : profile.maritalStatus || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pendidikan & Karir */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-rose-500" />
                      Pendidikan & Karir
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Pendidikan:</span>
                        <span className="ml-2 font-medium">{profile.education || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Perusahaan:</span>
                        <span className="ml-2 font-medium">{profile.company || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Lokasi Kerja:</span>
                        <span className="ml-2 font-medium">{profile.workplace || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pendapatan:</span>
                        <span className="ml-2 font-medium">{profile.income || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Informasi Fisik */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-rose-500" />
                      Informasi Fisik
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Tinggi Badan:</span>
                        <span className="ml-2 font-medium">{profile.height ? `${profile.height} cm` : '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Berat Badan:</span>
                        <span className="ml-2 font-medium">{profile.weight ? `${profile.weight} kg` : '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tipe Tubuh:</span>
                        <span className="ml-2 font-medium">{profile.bodyType || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Warna Kulit:</span>
                        <span className="ml-2 font-medium">{profile.skinColor || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Agama & Spiritual */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-rose-500" />
                      Agama & Spiritual
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Agama:</span>
                        <span className="ml-2 font-medium">{profile.religion || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tingkat Keagamaan:</span>
                        <span className="ml-2 font-medium">{profile.religiousLevel || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Frekuensi Ibadah:</span>
                        <span className="ml-2 font-medium">{profile.prayerFrequency || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Kemampuan Baca Kitab:</span>
                        <span className="ml-2 font-medium">{profile.quranAbility || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tentang & Ekspektasi */}
                  <div>
                    <h3 className="font-semibold mb-3">Tentang & Ekspektasi</h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <span className="text-gray-500 block mb-1">Tentang Saya:</span>
                        <p className="text-gray-700">{profile.aboutMe || 'Tidak ada informasi'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">Ekspektasi Pernikahan:</span>
                        <p className="text-gray-700">{profile.expectations || 'Tidak ada informasi'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}

              {!canViewFullBiodata && canViewProfile && (
                <CardContent>
                  <Alert>
                    <EyeOff className="h-4 w-4" />
                    <AlertDescription>
                      Biodata lengkap akan terlihat setelah Anda dan pasangan saling menyetujui.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>

            {/* AI Reasoning */}
            {match.aiReasoning && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alasan Kecocokan AI</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{match.aiReasoning}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Match Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Progress Taaruf</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tahap Saat Ini:</span>
                  <Badge variant="outline">{getStepLabel(match.step)}</Badge>
                </div>
                <Progress value={match.step === 'chatting' ? 100 : match.step.includes('approved') ? 75 : match.step.includes('requested') ? 50 : 25} />
                <div className="text-xs text-gray-500 text-center">
                  {match.step === 'profile_request' && 'Menunggu persetujuan profil'}
                  {match.step === 'profile_viewed' && 'Profil telah disetujui'}
                  {match.step === 'photo_requested' && 'Menunggu persetujuan foto'}
                  {match.step === 'photo_approved' && 'Foto telah disetujui'}
                  {match.step === 'full_data_requested' && 'Menunggu persetujuan biodata lengkap'}
                  {match.step === 'full_data_approved' && 'Biodata lengkap telah disetujui'}
                  {match.step === 'chatting' && 'Anda dapat mulai berkomunikasi'}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tindakan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {match.status === 'pending' && match.step === 'profile_request' && (
                  <>
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      onClick={() => {
                        setApproveAction('approve_profile')
                        setShowApproveDialog(true)
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Setujui Lihat Profil
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setApproveAction('reject_profile')
                        setShowApproveDialog(true)
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Tolak
                    </Button>
                  </>
                )}

                {match.step === 'profile_viewed' && (
                  <Button
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                    onClick={() => handleAction('request_photo')}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Request Lihat Foto
                  </Button>
                )}

                {match.step === 'photo_requested' && (
                  <>
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      onClick={() => {
                        setApproveAction('approve_photo')
                        setShowApproveDialog(true)
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Setujui Lihat Foto
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setApproveAction('reject_photo')
                        setShowApproveDialog(true)
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Tolak
                    </Button>
                  </>
                )}

                {match.step === 'photo_approved' && (
                  <Button
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                    onClick={() => handleAction('request_full_biodata')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Request Biodata Lengkap
                  </Button>
                )}

                {match.step === 'full_data_requested' && (
                  <>
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      onClick={() => {
                        setApproveAction('approve_full_biodata')
                        setShowApproveDialog(true)
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Setujui Biodata Lengkap
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setApproveAction('reject_full_biodata')
                        setShowApproveDialog(true)
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Tolak
                    </Button>
                  </>
                )}

                {match.step === 'full_data_approved' && (
                  <>
                    <Button
                      className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                      onClick={() => handleAction('start_chatting')}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Mulai Chat
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setApproveAction('block')
                        setShowApproveDialog(true)
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Blokir
                    </Button>
                  </>
                )}

                {canChat && (
                  <Button
                    className="w-full bg-green-500 hover:bg-green-600"
                    onClick={() => router.push(`/dashboard/matches/${matchId}/chat`)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Buka Chat
                  </Button>
                )}

                {match.status === 'rejected' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Match ini telah ditolak. Anda tidak dapat melanjutkan proses taaruf ini.
                    </AlertDescription>
                  </Alert>
                )}

                {match.status === 'blocked' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Match ini telah diblokir.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Tindakan</DialogTitle>
            <DialogDescription>
              {approveAction === 'approve_profile' && 'Apakah Anda yakin ingin menyetujui permintaan untuk melihat profil?'}
              {approveAction === 'reject_profile' && 'Apakah Anda yakin ingin menolak permintaan ini? Match akan ditutup.'}
              {approveAction === 'approve_photo' && 'Apakah Anda yakin ingin menyetujui permintaan untuk melihat foto?'}
              {approveAction === 'reject_photo' && 'Apakah Anda yakin ingin menolak permintaan ini? Match akan ditutup.'}
              {approveAction === 'approve_full_biodata' && 'Apakah Anda yakin ingin menyetujui permintaan untuk melihat biodata lengkap?'}
              {approveAction === 'reject_full_biodata' && 'Apakah Anda yakin ingin menolak permintaan ini? Match akan ditutup.'}
              {approveAction === 'start_chatting' && 'Apakah Anda yakin ingin memulai chat dengan pasangan ini?'}
              {approveAction === 'block' && 'Apakah Anda yakin ingin memblokir match ini? Tindakan ini tidak dapat dibatalkan.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmApprove}
              className={
                approveAction.includes('reject') || approveAction === 'block'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }
            >
              {approveAction.includes('reject') || approveAction === 'block' ? 'Ya, Tolak/Blokir' : 'Ya, Setujui'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
