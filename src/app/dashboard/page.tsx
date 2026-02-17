'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { signOut } from 'next-auth/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { 
  Home,
  User,
  MessageSquare,
  FileText,
  CreditCard,
  Settings,
  Bell,
  Search,
  Heart,
  TrendingUp,
  Clock,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Edit,
  RotateCcw,
  Calendar,
  Save,
  Loader2
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DashboardData {
  user: {
    id: string
    name: string
    email: string
    avatar?: string
    uniqueCode: string
    workflowStatus: string
  }
  flags?: {
    profileCompleted: boolean
    psychotestCompleted: boolean
    matchingAvailable: boolean
  }
  progress?: {
    profileCompletionPercent: number
    psychotestCompletionPercent: number
    psychotestCompletedCount: number
    psychotestRequiredCount: number
  }
  profile: {
    fullName?: string
    age?: number
    occupation?: string
    city?: string
    dateOfBirth?: string // Tambahan interface untuk Tanggal Lahir
  } | null
  psychotests: Array<{
    testType: string
    score: number
    result: string
  }>
  subscription: {
    planType: string
    endDate: string | null
    isActive: boolean
  } | null
  matches: Array<{
    id: string
    targetId: string
    targetName: string
    targetAvatar?: string
    targetAge?: number
    targetOccupation?: string
    targetCity?: string
    matchPercentage: number
    matchStatus?: string
    matchStep?: string
  }>
  notifications: number
  advertisements: Array<{
    id: string
    title: string
    imageUrl?: string
    linkUrl?: string
    position: 'dashboard_top' | 'dashboard_middle' | 'dashboard_bottom' | 'dashboard_left' | 'dashboard_right' | 'dashboard_center'
  }>
}

const workflowSteps = [
  { key: 'biodata', label: 'Biodata', icon: User },
  { key: 'psychotest', label: 'Psikotes', icon: FileText },
  { key: 'matching', label: 'Pencocokan', icon: Heart },
  { key: 'view_profile', label: 'Lihat Profil', icon: User },
  { key: 'getting_to_know', label: 'Kenalan', icon: MessageSquare },
  { key: 'completed', label: 'Selesai', icon: CheckCircle },
]

const chartConfig = {
  score: {
    label: 'Skor',
    color: 'hsl(var(--chart-1))',
  },
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [searchCode, setSearchCode] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null)
  const [endDateLabel, setEndDateLabel] = useState<string>("")
  const [notifItems, setNotifItems] = useState<Array<{ id: string; title: string; message: string; link?: string | null; isRead: boolean; createdAt: string; type: string }>>([])
  const [isLoadingNotif, setIsLoadingNotif] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [ageMin, setAgeMin] = useState<string>("")
  const [ageMax, setAgeMax] = useState<string>("")
  const [cityQ, setCityQ] = useState<string>("")
  const [minMatch, setMinMatch] = useState<string>("any")

  // State untuk Form Tanggal Lahir Baru
  const [dob, setDob] = useState<string>("")
  const [isUpdatingDob, setIsUpdatingDob] = useState(false)
  const [dobMessage, setDobMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Set value DOB saat data dimuat
  useEffect(() => {
    if (data?.profile?.dateOfBirth) {
      setDob(data.profile.dateOfBirth)
    }
  }, [data])

  // Heartbeat session: refresh every 10s
  useEffect(() => {
    let active = true
    const tick = async () => {
      try {
        await fetch('/api/session/heartbeat')
      } catch {}
    }
    tick()
    const id = setInterval(() => active && tick(), 10_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])
  const loadNotifications = async () => {
    try {
      setIsLoadingNotif(true)
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (res.ok && data.notifications) {
        setNotifItems(data.notifications)
      }
    } finally {
      setIsLoadingNotif(false)
    }
  }
  useEffect(() => { loadNotifications() }, [])

  useEffect(() => {
    if (data?.subscription?.endDate) {
      updateCountdown(data.subscription.endDate)
      const interval = setInterval(() => {
        updateCountdown(data.subscription.endDate)
      }, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [data?.subscription?.endDate])

  useEffect(() => {
    if (data?.subscription?.endDate) {
      const d = new Date(data.subscription.endDate)
      setEndDateLabel(
        d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      )
    } else {
      setEndDateLabel("")
    }
  }, [data?.subscription?.endDate])

  const updateCountdown = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diff = end.getTime() - now.getTime()

    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft({ days, hours, minutes })
    } else {
      setTimeLeft(null)
    }
  }

  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard')
      const result = await response.json()

      if (response.ok) {
        setData(result)
      } else {
        console.error('Failed to load dashboard:', result.error)
        // Redirect to login if not authenticated
        if (response.status === 401) {
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fungsi Handler Update Tanggal Lahir
  const handleUpdateDob = async () => {
    if (!dob) {
      setDobMessage({ type: 'error', text: 'Tanggal lahir wajib diisi.' })
      return
    }

    setIsUpdatingDob(true)
    setDobMessage(null)

    try {
      // Pastikan endpoint ini ada di backend Anda
      const response = await fetch('/api/user/profile', {
        method: 'PATCH', // atau POST tergantung backend
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateOfBirth: dob }),
      })

      const result = await response.json()

      if (response.ok) {
        setDobMessage({ type: 'success', text: 'Tanggal lahir berhasil diperbarui.' })
        // Refresh data dashboard untuk menampilkan data terbaru
        loadDashboardData()
      } else {
        setDobMessage({ type: 'error', text: result.error || 'Gagal memperbarui tanggal lahir.' })
      }
    } catch (error) {
      setDobMessage({ type: 'error', text: 'Terjadi kesalahan jaringan.' })
    } finally {
      setIsUpdatingDob(false)
    }
  }

  const handleSearchByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError('')
    setSearchResult(null)
    setIsSearching(true)

    try {
      const response = await fetch('/api/matches/search-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueCode: searchCode }),
      })

      const result = await response.json()

      if (response.ok) {
        setSearchResult(result)
      } else {
        setSearchError(result.error || 'Pencarian gagal')
      }
    } catch (error) {
      setSearchError('Terjadi kesalahan saat mencari')
    } finally {
      setIsSearching(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getWorkflowIndex = () => {
    if (!data) return 0
    const hasProfile = data.flags ? data.flags.profileCompleted : !!data.profile
    const hasPsychotests = data.flags ? data.flags.psychotestCompleted : ((data.psychotests?.length || 0) > 0)
    const hasMatches = data.flags ? data.flags.matchingAvailable : ((data.matches?.length || 0) > 0)

    if (!hasProfile) return workflowSteps.findIndex(s => s.key === 'biodata')
    if (!hasPsychotests) return workflowSteps.findIndex(s => s.key === 'psychotest')
    if (!hasMatches) return workflowSteps.findIndex(s => s.key === 'matching')

    const byStatus = workflowSteps.findIndex(s => s.key === data.user.workflowStatus)
    return byStatus >= 0 ? byStatus : workflowSteps.findIndex(s => s.key === 'view_profile')
  }

  const currentWorkflowIndex = getWorkflowIndex()

  const COLORS = ['#f43f5e', '#ec4899', '#a855f7', '#6366f1']

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  const isSubscriptionExpired = data?.subscription && data.subscription.endDate
    ? new Date(data.subscription.endDate) < new Date()
    : !data?.subscription?.isActive
  const displayedMatches = (() => {
    const list = [...(data?.matches || [])]
    const profileAge = data?.profile?.age
    const defaultMinA = typeof profileAge === 'number' ? Math.max(18, profileAge - 5) : undefined
    const defaultMaxA = typeof profileAge === 'number' ? profileAge + 5 : undefined
    const minA = ageMin ? parseInt(ageMin) : defaultMinA
    const maxA = ageMax ? parseInt(ageMax) : defaultMaxA
    const defaultCity = (data?.profile?.city || '').toLowerCase()
    const cityPref = (cityQ || defaultCity).toLowerCase()
    const minP = minMatch === 'any' ? NaN : parseInt(minMatch)
    const filterList = (arr: any[], aMin?: number, aMax?: number, cityStr?: string, pMin?: number) => {
      const cityLower = (cityStr || '').toLowerCase()
      const res = arr.filter(m => {
        const okAgeMin = aMin === undefined ? true : (m.targetAge ?? -Infinity) >= aMin
        const okAgeMax = aMax === undefined ? true : (m.targetAge ?? Infinity) <= aMax
        const okCity = cityLower ? (m.targetCity || '').toLowerCase().includes(cityLower) : true
        const okPercent = pMin === undefined || isNaN(pMin) ? true : (m.matchPercentage ?? 0) >= pMin
        return okAgeMin && okAgeMax && okCity && okPercent
      })
      res.sort((a,b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0))
      return res
    }
    let step = filterList(list, minA, maxA, cityPref, minP)
    if (step.length >= 10) return step.slice(0, 10)
    step = filterList(list, minA, maxA, undefined, minP)
    if (step.length >= 10) return step.slice(0, 10)
    const expandedMin = typeof minA === 'number' ? Math.max(18, minA - 5) : minA
    const expandedMax = typeof maxA === 'number' ? (maxA + 5) : maxA
    step = filterList(list, expandedMin, expandedMax, undefined, minP)
    if (step.length >= 10) return step.slice(0, 10)
    const loweredP = isNaN(minP) ? minP : Math.max(30, minP - 10)
    step = filterList(list, expandedMin, expandedMax, undefined, loweredP)
    if (step.length >= 10) return step.slice(0, 10)
    step = filterList(list, undefined, undefined, undefined, undefined)
    return step.slice(0, 10)
  })()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-xl">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                Setaruf
              </span>
            </Link>

            {/* Navigation (Desktop) */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-2 text-rose-600 font-medium">
                <Home className="w-4 h-4" />
                Home
              </Link>
              <Link href="/dashboard/profile" className="flex items-center gap-2 text-gray-600 hover:text-rose-600 transition-colors">
                <User className="w-4 h-4" />
                Profile
              </Link>
              <Link href="/dashboard/psychotest" className="flex items-center gap-2 text-gray-600 hover:text-rose-600 transition-colors">
                <FileText className="w-4 h-4" />
                Psikotes
              </Link>
              <Link href="/dashboard/messages" className="flex items-center gap-2 text-gray-600 hover:text-rose-600 transition-colors">
                <MessageSquare className="w-4 h-4" />
                Messages
              </Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <DropdownMenu onOpenChange={(open) => { setIsNotifOpen(open); if (open) loadNotifications() }}>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 text-gray-600 hover:text-rose-600 transition-colors">
                    <Bell className="w-5 h-5" />
                    {notifItems.some(n => !n.isRead) && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {Math.min(9, notifItems.filter(n => !n.isRead).length)}
                        {notifItems.filter(n => !n.isRead).length > 9 ? '+' : ''}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifikasi</span>
                    {isLoadingNotif && <span className="text-xs text-gray-400">Memuat...</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifItems.length > 0 && (
                    <>
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await fetch('/api/notifications', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'markAllRead' }),
                            })
                            setNotifItems(prev => prev.map(n => ({ ...n, isRead: true })))
                          } catch {}
                        }}
                        className="justify-center text-xs text-gray-600"
                      >
                        Tandai semua terbaca
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {notifItems.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500">Belum ada notifikasi.</div>
                  )}
                  {notifItems.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className={`flex flex-col items-start whitespace-normal ${!n.isRead ? 'bg-rose-50' : ''}`}
                      onClick={async () => {
                        try {
                          if (!n.isRead) {
                            await fetch('/api/notifications', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'markOneRead', id: n.id }),
                            })
                            setNotifItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
                          }
                        } catch {}
                      }}
                    >
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="w-full"
                          onClick={async (e) => {
                            try {
                              if (!n.isRead) {
                                await fetch('/api/notifications', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'markOneRead', id: n.id }),
                                })
                                setNotifItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
                              }
                            } catch {}
                          }}
                        >
                          <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                          <p className="text-[11px] text-gray-600">{n.message}</p>
                        </Link>
                      ) : (
                        <div className="w-full">
                          <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                          <p className="text-[11px] text-gray-600">{n.message}</p>
                        </div>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-0 h-auto">
                    <Avatar className="w-9 h-9 border-2 border-rose-200">
                      {data?.user.avatar ? (
                        <AvatarImage src={data.user.avatar} alt={data.user.name} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white">
                        {data?.user.name ? getInitials(data.user.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{data?.user.name || 'User'}</p>
                      <p className="text-xs text-gray-500">{data?.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile" className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/subscription" className="cursor-pointer">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Subscription
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 cursor-pointer"
                    onClick={() => signOut({ callbackUrl: '/' })}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Desktop Only */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-4">
              {(() => {
                const adsLeft = (data?.advertisements || [])
                  .filter(a => a.position === 'dashboard_left' || a.position === 'dashboard_top')
                  .slice(0, 2)
                if (adsLeft.length === 0) return null
                return adsLeft.map((ad) => (
                  <Card key={ad.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {ad.imageUrl ? (
                        <Link href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined}>
                          <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover" />
                        </Link>
                      ) : (
                        <div className="relative h-40 bg-gradient-to-r from-rose-100 to-pink-100 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm text-rose-600 font-medium mb-2">IKLAN SPONSOR</p>
                            <h3 className="text-lg font-bold text-gray-900">{ad.title}</h3>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              })()}
              {/* User Mini Profile */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white pb-4">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="w-20 h-20 border-4 border-white/30 mb-3">
                      {data?.user.avatar ? (
                        <AvatarImage src={data.user.avatar} alt={data.user.name} />
                      ) : null}
                      <AvatarFallback className="bg-white text-rose-600 text-2xl">
                        {data?.user.name ? getInitials(data.user.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-lg">{data?.profile?.fullName || data?.user.name || 'User'}</CardTitle>
                    <CardDescription className="text-white/80 text-sm">
                      {data?.profile?.occupation || 'Pekerjaan belum diisi'}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Usia</span>
                    <span className="font-medium">{data?.profile?.age || '-'} tahun</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Domisili</span>
                    <span className="font-medium">{data?.profile?.city || '-'}</span>
                  </div>
                  
                  {/* --- TAMBAHAN FORM TANGGAL LAHIR --- */}
                  <div className="pt-2 border-t">
                    <Label htmlFor="dobInput" className="text-xs text-gray-500 mb-1 block">Tanggal Lahir</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="dobInput"
                        type="date" 
                        value={dob} 
                        onChange={(e) => setDob(e.target.value)}
                        className="text-sm h-8"
                      />
                      <Button 
                        size="sm" 
                        onClick={handleUpdateDob}
                        disabled={isUpdatingDob || dob === data?.profile?.dateOfBirth}
                        className="h-8 px-2"
                      >
                        {isUpdatingDob ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      </Button>
                    </div>
                    {dobMessage && (
                      <p className={`text-[10px] mt-1 ${dobMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                        {dobMessage.text}
                      </p>
                    )}
                  </div>
                  {/* ----------------------------------- */}

                  <div className="flex justify-between text-sm items-center pt-2">
                    <span className="text-gray-500">Kode Unik</span>
                    <Badge variant="outline" className="font-mono">
                      {data?.user.uniqueCode || '-'}
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href="/dashboard/profile">
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href="/dashboard/psychotest">
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Psikotes
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>


              {/* Workflow Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Status Workflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {workflowSteps.map((step, index) => {
                      const isCompleted = index < currentWorkflowIndex
                      const isCurrent = index === currentWorkflowIndex
                      const Icon = step.icon

                      return (
                        <div key={step.key} className="flex items-center gap-3">
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                              isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : isCurrent
                                ? 'bg-rose-500 border-rose-500 text-white'
                                : 'bg-gray-100 border-gray-300 text-gray-400'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          <span
                            className={`text-sm ${
                              isCurrent ? 'font-medium text-rose-600' : 'text-gray-600'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Main Content Area (Center) */}
          <main className="lg:col-span-6 space-y-6">
            {/* Welcome & Subscription Alert */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                      Selamat Datang, {data?.profile?.fullName || data?.user.name?.split(' ')[0] || 'User'}!
                    </h1>
                    <p className="text-gray-600">
                      {(() => {
                        if (!data) return 'Memuat...'
                        const prefix = 'Kamu'
                        const parts: string[] = []
                        if (!data.flags?.profileCompleted) parts.push('belum mengisi profile')
                        if (!data.flags?.psychotestCompleted) parts.push('belum mengikuti psikotes')
                        const pendingRequests = (data.matches || []).filter(m => m.matchStatus === 'pending' && m.matchStep === 'profile_request')
                        const likedByTarget = (data.matches || []).filter(m => m.matchStep === 'target_approved')
                        const today = new Date()
                        const day = today.toLocaleDateString('id-ID', { weekday: 'long' })
                        const notif = data.notifications || 0
                        const statusPart = parts.length ? `(${parts.join(' dan ')})` : '(Semua syarat dasar terpenuhi)'
                        const reqPart = pendingRequests.length
                          ? `Kamu telah meminta lihat profil ke ${pendingRequests[0].targetName}${pendingRequests.length > 1 ? ` dan ${pendingRequests.length - 1} lainnya` : ''}`
                          : 'Belum ada permintaan lihat profil'
                        const likePart = likedByTarget.length
                          ? `${likedByTarget[0].targetName} memilih Lanjut${likedByTarget.length > 1 ? ` dan ${likedByTarget.length - 1} lainnya` : ''}`
                          : 'Belum ada yang memilih Lanjut'
                        return `${prefix} ${statusPart}. ${reqPart}. ${likePart}. Hari ini ${day}, ${notif} notifikasi belum dibaca.`
                      })()}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <Heart className="w-12 h-12 text-rose-500 opacity-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Psychotest Results - Mobile */}
            <Card className="lg:hidden">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-rose-500" />
                  Hasil Psikotes
                </CardTitle>
                <CardDescription>
                  Ringkasan hasil psikotes untuk pencocokan yang lebih akurat
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-white p-3 mb-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-40">
                      <Label className="text-xs text-gray-600">Umur min</Label>
                      <Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-40">
                      <Label className="text-xs text-gray-600">Umur max</Label>
                      <Input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <Label className="text-xs text-gray-600">Domisili</Label>
                      <Input value={cityQ} onChange={(e) => setCityQ(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-44">
                      <Label className="text-xs text-gray-600">Min % cocok</Label>
                      <Select value={minMatch} onValueChange={(v) => setMinMatch(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Tanpa batas</SelectItem>
                          <SelectItem value="40">≥ 40%</SelectItem>
                          <SelectItem value="50">≥ 50%</SelectItem>
                          <SelectItem value="60">≥ 60%</SelectItem>
                          <SelectItem value="70">≥ 70%</SelectItem>
                          <SelectItem value="80">≥ 80%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-auto sm:ml-auto">
                      <Button variant="outline" onClick={() => { setAgeMin(''); setAgeMax(''); setCityQ(''); setMinMatch('any'); }}>
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
                {data?.psychotests && data.psychotests.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-medium mb-2">Skor per Kategori</h4>
                      <ChartContainer config={chartConfig} className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.psychotests}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="testType"
                              tickLine={false}
                              tickMargin={6}
                              axisLine={false}
                              tickFormatter={(value) => {
                                const labels: Record<string, string> = {
                                  pre_marriage: 'Pra-Nikah',
                                  disc: 'DISC',
                                  clinical: 'Clinical',
                                  '16pf': '16PF',
                                }
                                return labels[value] || value
                              }}
                            />
                            <YAxis tickLine={false} axisLine={false} tickMargin={6} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="score" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium mb-2">Distribusi Hasil</h4>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={data.psychotests}
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={68}
                            paddingAngle={5}
                            dataKey="score"
                            labelLine={false}
                          >
                            {data.psychotests.map((entry, index) => (
                              <Cell key={`cell-m-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {data.psychotests.map((test, index) => (
                          <div key={test.testType} className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span className="text-xs text-gray-600">
                              {test.testType === 'pre_marriage' && 'Pra-Nikah'}
                              {test.testType === 'disc' && 'DISC'}
                              {test.testType === 'clinical' && 'Clinical'}
                              {test.testType === '16pf' && '16PF'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 mb-2">Belum ada hasil psikotes</p>
                    <Button asChild size="sm" variant="outline" disabled={isSubscriptionExpired}>
                      <Link href="/dashboard/psychotest">
                        <FileText className="w-3.5 h-3.5 mr-2" />
                        Mulai Psikotes
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            {workflowSteps[currentWorkflowIndex]?.key === 'psychotest' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Mulai Psikotes</h2>
                      <p className="text-sm text-gray-600">Selesaikan semua tes untuk lanjut ke pencocokan</p>
                    </div>
                    <Link href="/dashboard/psychotest">
                      <Button className="bg-rose-600 hover:bg-rose-700 text-white">Mulai Psikotes</Button>
                    </Link>
                  </div>
                  <div className="mt-4">
                    <Progress value={data?.progress?.psychotestCompletionPercent || 0} />
                    <div className="mt-2 text-sm text-gray-600">
                      {data?.progress?.psychotestCompletedCount || 0}/{data?.progress?.psychotestRequiredCount || 4} tes selesai
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subscription Warning */}
            {isSubscriptionExpired && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Subscription Expired:</strong> Subscription Anda telah berakhir. Silakan perbarui untuk akses penuh.
                  <Button asChild size="sm" className="ml-2 bg-amber-600 hover:bg-amber-700">
                    <Link href="/dashboard/subscription">Perbarui Sekarang</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            

            {/* Partner Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500" />
                  Rekomendasi Pasangan
                </CardTitle>
                <CardDescription>
                  Pasangan yang cocok berdasarkan hasil psikotes dan kriteria Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                
                {(() => {
                  const adsBottom = (data?.advertisements || [])
                    .filter(a => a.position === 'dashboard_bottom' || a.position === 'dashboard_center')
                    .slice(0, 2)
                  if (adsBottom.length === 0) return null
                  return adsBottom.map((ad) => (
                    <div key={ad.id} className="mb-4">
                      <Card className="overflow-hidden">
                        <CardContent className="p-0">
                          {ad.imageUrl ? (
                            <Link href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined}>
                              <img src={ad.imageUrl} alt={ad.title} className="w-full h-24 object-cover" />
                            </Link>
                          ) : (
                            <div className="relative h-24 bg-gradient-to-r from-pink-100 to-rose-100 flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-xs text-pink-600 font-medium mb-1">IKLAN SPONSOR</p>
                                <h3 className="text-sm font-bold text-gray-900">{ad.title}</h3>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))
                })()}
                <div className="space-y-4">
                  {displayedMatches && displayedMatches.length > 0 ? (
                    displayedMatches.map((match) => (
                      <Card
                        key={match.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="w-14 h-14 border-2 border-rose-200 flex-shrink-0">
                              {match.targetAvatar ? (
                                <AvatarImage src={match.targetAvatar} alt={match.targetName} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white">
                                {getInitials(match.targetName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{match.targetName}</h4>
                              <p className="text-sm text-gray-600 truncate">
                                {(() => {
                                  const parts = [
                                    match.targetAge ? `${match.targetAge} tahun` : null,
                                    match.targetOccupation || null,
                                    match.targetCity || null
                                  ].filter(Boolean)
                                  return parts.length ? parts.join(' • ') : 'Data belum tersedia'
                                })()}
                              </p>
                              {(() => {
                                const incomplete = !match.targetAge || !match.targetOccupation || !match.targetCity
                                return incomplete ? (
                                  <div className="mt-1">
                                    <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">
                                      Profil belum lengkap
                                    </Badge>
                                  </div>
                                ) : null
                              })()}
                            </div>
                            <div className="text-center flex-shrink-0">
                              <div
                                className={`text-2xl font-bold ${
                                  match.matchPercentage >= 80
                                    ? 'text-green-600'
                                    : match.matchPercentage >= 60
                                    ? 'text-rose-600'
                                    : 'text-yellow-600'
                                }`}
                              >
                                {match.matchPercentage.toFixed(0)}%
                              </div>
                              <p className="text-xs text-gray-500">Kecocokan</p>
                            </div>
                          </div>
                        <Button
                            className="w-full mt-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                            disabled={
                              isSubscriptionExpired ||
                              !data?.flags?.profileCompleted ||
                              !data?.flags?.psychotestCompleted
                            }
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/matches/${match.id}/view`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) {
                                  alert(json.error || 'Gagal membuka profil. Kuota mungkin habis.')
                                  return
                                }
                                alert(`Jatah view profil berkurang. Sisa: ${json.remaining}`)
                                window.location.href = `/dashboard/matches/${match.id}`
                              } catch (e: any) {
                                alert(e.message || 'Error')
                              }
                            }}
                          >
                            <User className="w-4 h-4 mr-2" />
                            View Profile
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                          {(!data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted) && (
                            <p className="text-xs text-gray-500 mt-2">
                              Lengkapi biodata dan semua psikotes untuk membuka profil rekomendasi.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Belum ada rekomendasi pasangan</p>
                      <p className="text-sm text-gray-400 mt-1">Selesaikan psikotes untuk mendapatkan rekomendasi</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </main>

          {/* Right Sidebar - Desktop Only */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-4">
              {(() => {
                const adsRight = (data?.advertisements || [])
                  .filter(a => a.position === 'dashboard_right' || a.position === 'dashboard_middle')
                  .slice(0, 2)
                if (adsRight.length === 0) return null
                return adsRight.map((ad) => (
                  <Card key={ad.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {ad.imageUrl ? (
                        <Link href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined}>
                          <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover" />
                        </Link>
                      ) : (
                        <div className="relative h-40 bg-gradient-to-r from-purple-100 to-indigo-100 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm text-purple-600 font-medium mb-2">IKLAN SPONSOR</p>
                            <h3 className="text-lg font-bold text-gray-900">{ad.title}</h3>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              })()}
              {/* Subscription Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Status Subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Plan</span>
                    <Badge
                      variant={data?.subscription?.planType === 'premium' ? 'default' : 'secondary'}
                      className={
                        data?.subscription?.planType === 'premium'
                          ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                          : ''
                      }
                    >
                      {data?.subscription?.planType === 'premium' ? 'Premium' : 'Free'}
                    </Badge>
                  </div>

                  {data?.subscription?.endDate && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status</span>
                        {isSubscriptionExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge className="bg-green-500">Active</Badge>
                        )}
                      </div>

                      {!isSubscriptionExpired && timeLeft && (
                        <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
                          <p className="text-xs text-rose-600 mb-2">Sisa Waktu</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-xl font-bold text-rose-600">{timeLeft.days}</div>
                              <div className="text-xs text-gray-600">Hari</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-rose-600">{timeLeft.hours}</div>
                              <div className="text-xs text-gray-600">Jam</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-rose-600">{timeLeft.minutes}</div>
                              <div className="text-xs text-gray-600">Menit</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {endDateLabel && (
                        <p className="text-xs text-gray-500 text-center">
                          Berakhir: {endDateLabel}
                        </p>
                      )}
                    </>
                  )}

                  <Button
                    asChild
                    className={`w-full ${
                      data?.subscription?.planType === 'premium'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'
                    }`}
                  >
                    <Link href="/dashboard/subscription">
                      {data?.subscription?.planType === 'premium' ? 'Manage Subscription' : 'Upgrade to Premium'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>


              {/* Unique Code Search - Moved to Right Sidebar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Search className="w-4 h-4 text-rose-500" />
                    Cari Pasangan dengan Kode Unik
                  </CardTitle>
                  <CardDescription>
                    Masukkan kode unik pasangan yang ingin Kamu cari
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearchByCode} className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Contoh: SET123456"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                        disabled={isSearching || isSubscriptionExpired}
                        className="font-mono"
                      />
                      <Button
                        type="submit"
                        disabled={isSearching || !searchCode || isSubscriptionExpired}
                        className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                      >
                        {isSearching ? 'Mencari...' : 'Cari'}
                      </Button>
                    </div>

                    {searchError && (
                      <Alert variant="destructive">
                        <AlertDescription>{searchError}</AlertDescription>
                      </Alert>
                    )}

                    {searchResult && (
                      <Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200">
                        <CardContent className="pt-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12 border-2 border-rose-300">
                              {searchResult.avatar ? (
                                <AvatarImage src={searchResult.avatar} alt={searchResult.name} />
                              ) : null}
                              <AvatarFallback className="bg-rose-500 text-white">
                                {getInitials(searchResult.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{searchResult.name}</h4>
                              <p className="text-xs text-gray-600 truncate">
                                {(() => {
                                  const parts = [
                                    searchResult.age ? `${searchResult.age} tahun` : null,
                                    searchResult.occupation || null,
                                    searchResult.city || null
                                  ].filter(Boolean)
                                  return parts.length ? parts.join(' • ') : 'Data belum tersedia'
                                })()}
                              </p>
                            </div>
                            <div className="text-center flex-shrink-0">
                              <div className="text-lg font-bold text-rose-600">
                                {searchResult.matchPercentage?.toFixed?.(0) ?? '—'}%
                              </div>
                              <p className="text-[10px] text-gray-500">Kecocokan</p>
                            </div>
                          </div>
                          <Link href={`/dashboard/matches/${searchResult.matchId}`}>
                            <Button
                              className="w-full mt-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                              disabled={isSubscriptionExpired}
                              size="sm"
                            >
                              <User className="w-3.5 h-3.5 mr-2" />
                              View Profile
                              <ChevronRight className="w-3.5 h-3.5 ml-2" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Upcoming Events/Reminders */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Pengingat</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Lengkapi Profil</p>
                        <p className="text-xs text-gray-500">
                          {data?.profile?.fullName ? 'Profil sudah lengkap' : 'Silakan lengkapi biodata Anda'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Psikotes</p>
                        <p className="text-xs text-gray-500">
                          {data?.psychotests?.length === 4
                            ? 'Semua psikotes selesai'
                            : `${data?.psychotests?.length || 0}/4 psikotes selesai`}
                        </p>
                      </div>
                    </div>
                    {isSubscriptionExpired && (
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Subscription Berakhir</p>
                          <p className="text-xs text-gray-500">Perbarui untuk akses penuh</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Statistik</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pasangan Direkomendasikan</span>
                      <span className="font-semibold">{data?.matches?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Psikotes Selesai</span>
                      <span className="font-semibold">{data?.psychotests?.length || 0}/4</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Rata-rata Kecocokan</span>
                      <span className="font-semibold text-rose-600">
                        {data?.matches && data.matches.length > 0
                          ? (data.matches.reduce((sum, m) => sum + m.matchPercentage, 0) / data.matches.length).toFixed(0)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Psychotest Results - Moved to Right Sidebar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                    Hasil Psikotes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.psychotests && data.psychotests.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-medium mb-2">Skor per Kategori</h4>
                        <ChartContainer config={chartConfig} className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.psychotests}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis
                                dataKey="testType"
                                tickLine={false}
                                tickMargin={6}
                                axisLine={false}
                                tickFormatter={(value) => {
                                  const labels: Record<string, string> = {
                                    pre_marriage: 'Pra-Nikah',
                                    disc: 'DISC',
                                    clinical: 'Clinical',
                                    '16pf': '16PF',
                                  }
                                  return labels[value] || value
                                }}
                              />
                              <YAxis tickLine={false} axisLine={false} tickMargin={6} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="score" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium mb-2">Distribusi Hasil</h4>
                        <ChartContainer
                          className="h-40 w-full"
                          config={{
                            score: { label: 'Skor', color: 'hsl(var(--chart-1))' },
                          }}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data.psychotests}
                                cx="50%"
                                cy="50%"
                                innerRadius={36}
                                outerRadius={68}
                                paddingAngle={5}
                                dataKey="score"
                                labelLine={false}
                              >
                                {data.psychotests.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {data.psychotests.map((test, index) => (
                            <div key={test.testType} className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              ></div>
                              <span className="text-xs text-gray-600">
                                {test.testType === 'pre_marriage' && 'Pra-Nikah'}
                                {test.testType === 'disc' && 'DISC'}
                                {test.testType === 'clinical' && 'Clinical'}
                                {test.testType === '16pf' && '16PF'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 mb-2">Belum ada hasil psikotes</p>
                      <Button asChild size="sm" variant="outline" disabled={isSubscriptionExpired}>
                        <Link href="/dashboard/psychotest">
                          <FileText className="w-3.5 h-3.5 mr-2" />
                          Mulai Psikotes
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
