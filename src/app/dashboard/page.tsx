'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { 
  ChartContainer, ChartTooltip, ChartTooltipContent 
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts'
import { 
  Home, User, MessageSquare, FileText, CreditCard, Settings, Bell, Search, Heart,
  TrendingUp, Clock, ChevronRight, CheckCircle, AlertTriangle, LogOut, Edit, RotateCcw, Menu, Phone, Instagram, Lightbulb, XCircle, Mars, Venus
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'

// --- Interfaces & Constants ---

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
    gender?: string
    religion?: string
    photoUrl?: string
    occupation?: string
    city?: string
    quote?: string | null
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
    targetGender?: string
    targetReligion?: string
    targetOccupation?: string
    targetCity?: string
    targetWhatsapp?: string | null
    targetInstagram?: string | null
    targetQuote?: string | null
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

const QUOTE_TIPS = [
  'Ceritakan hal kecil yang membuatmu bersyukur hari ini 😊',
  'Tuliskan visi pernikahanmu dalam satu kalimat 💍',
  'Bagikan nilai hidup yang paling kamu pegang ✨',
  'Sebutkan kebiasaan positif yang kamu banggakan 💪',
  'Kutipan favorit + alasan singkat kenapa kamu suka 📖',
  'Tujuan minggumu dalam kata-kata sederhana 🎯',
]

const chartConfig = {
  score: {
    label: 'Skor',
    color: 'hsl(var(--chart-1))',
  },
}

const COLORS = ['#f43f5e', '#ec4899', '#a855f7', '#6366f1']

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [searchCode, setSearchCode] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [dailyQuote, setDailyQuote] = useState<string>('')
  const [quoteSaving, setQuoteSaving] = useState(false)
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null)
  const [endDateLabel, setEndDateLabel] = useState<string>("")
  const [notifItems, setNotifItems] = useState<Array<{ id: string; title: string; message: string; link?: string | null; isRead: boolean; createdAt: string; type: string }>>([])
  const [isLoadingNotif, setIsLoadingNotif] = useState(false)
  
  // Filter States
  const [ageMin, setAgeMin] = useState<string>("")
  const [ageMax, setAgeMax] = useState<string>("")
  const [cityQ, setCityQ] = useState<string>("")
  const [minMatch, setMinMatch] = useState<string>("any")
  const [simScore, setSimScore] = useState<number | null>(null)
  const [simRunning, setSimRunning] = useState(false)
  const [simTarget, setSimTarget] = useState<any>(null)

  // --- Data Fetching & Effects ---

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    let active = true
    const tick = async () => {
      try { await fetch('/api/session/heartbeat') } catch {}
    }
    tick()
    const id = setInterval(() => active && tick(), 10_000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const loadNotifications = async () => {
    try {
      setIsLoadingNotif(true)
      const res = await fetch('/api/notifications')
      const json = await res.json()
      if (res.ok && json.notifications) setNotifItems(json.notifications)
    } finally { setIsLoadingNotif(false) }
  }
  useEffect(() => { loadNotifications() }, [])

  useEffect(() => {
    if (data?.subscription?.endDate) {
      updateCountdown(data.subscription.endDate)
      const interval = setInterval(() => updateCountdown(data.subscription.endDate), 60000)
      return () => clearInterval(interval)
    }
  }, [data?.subscription?.endDate])

  useEffect(() => {
    if (data?.subscription?.endDate) {
      const d = new Date(data.subscription.endDate)
      setEndDateLabel(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }))
    } else { setEndDateLabel("") }
  }, [data?.subscription?.endDate])

  const updateCountdown = (endDate: string) => {
    const diff = new Date(endDate).getTime() - new Date().getTime()
    if (diff > 0) {
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      })
    } else { setTimeLeft(null) }
  }

  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard')
      const result = await response.json()
      if (response.ok) {
        setData(result)
        setDailyQuote(result?.profile?.quote || '')
      }
      else if (response.status === 401) router.push('/')
    } catch (error) { console.error('Error loading dashboard:', error) }
    finally { setIsLoading(false) }
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
      if (response.ok) setSearchResult(result)
      else setSearchError(result.error || 'Pencarian gagal')
    } catch (error) { setSearchError('Terjadi kesalahan saat mencari') }
    finally { setIsSearching(false) }
  }

  // --- Helpers ---

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const tipText = useMemo(() => {
    const now = new Date()
    const idx = (now.getDate() + now.getMonth()) % QUOTE_TIPS.length
    return QUOTE_TIPS[idx]
  }, [])

  const saveDailyQuote = async () => {
    try {
      setQuoteSaving(true)
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote: dailyQuote }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Gagal menyimpan quote')
        return
      }
      setData(prev => prev ? { ...prev, profile: prev.profile ? { ...prev.profile, quote: dailyQuote } : prev.profile } : prev)
      alert('Quote berhasil disimpan')
    } catch {
      alert('Terjadi kesalahan saat menyimpan quote')
    } finally {
      setQuoteSaving(false)
    }
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

  const displayedMatches = useMemo(() => {
    const ready = !!(data?.flags?.profileCompleted && data?.flags?.psychotestCompleted)
    if (!ready) return []
    let list = [...(data?.matches || [])].filter(m => {
      const myGender = data?.profile?.gender
      const myReligion = data?.profile?.religion
      const okAdult = (m.targetAge ?? 0) >= 18
      const okGender = myGender ? (m.targetGender && m.targetGender !== myGender) : true
      const okReligion = myReligion ? (m.targetReligion && m.targetReligion === myReligion) : true
      return okAdult && okGender && okReligion
    })
    list = list.filter(m => (m.matchStep === 'profile_viewed') || (m.matchStatus === 'approved')).slice(0, 50)
    const profileAge = data?.profile?.age
    const defaultMinA = typeof profileAge === 'number' ? Math.max(18, profileAge - 5) : undefined
    const defaultMaxA = typeof profileAge === 'number' ? profileAge + 5 : undefined
    
    const minA = ageMin ? parseInt(ageMin) : defaultMinA
    const maxA = ageMax ? parseInt(ageMax) : defaultMaxA
    const cityPref = (cityQ || (data?.profile?.city || '')).toLowerCase()
    const minP = minMatch === 'any' ? NaN : parseInt(minMatch)

    const filterList = (arr: any[], aMin?: number, aMax?: number, cityStr?: string, pMin?: number) => {
      const cityLower = (cityStr || '').toLowerCase()
      return arr.filter(m => {
        const okAgeMin = aMin === undefined ? true : (m.targetAge ?? -Infinity) >= aMin
        const okAgeMax = aMax === undefined ? true : (m.targetAge ?? Infinity) <= aMax
        const okCity = cityLower ? (m.targetCity || '').toLowerCase().includes(cityLower) : true
        const okPercent = pMin === undefined || isNaN(pMin) ? true : (m.matchPercentage ?? 0) >= pMin
        return okAgeMin && okAgeMax && okCity && okPercent
      }).sort((a,b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0))
    }

    let step = filterList(list, minA, maxA, cityPref, minP)
    if (step.length >= 5) return step.slice(0, 5)
    step = filterList(list, minA, maxA, undefined, minP)
    if (step.length >= 5) return step.slice(0, 5)
    const expandedMin = typeof minA === 'number' ? Math.max(18, minA - 5) : minA
    const expandedMax = typeof maxA === 'number' ? (maxA + 5) : maxA
    step = filterList(list, expandedMin, expandedMax, undefined, minP)
    if (step.length >= 5) return step.slice(0, 5)
    const loweredP = isNaN(minP) ? minP : Math.max(30, minP - 10)
    step = filterList(list, expandedMin, expandedMax, undefined, loweredP)
    if (step.length >= 5) return step.slice(0, 5)
    return filterList(list, undefined, undefined, undefined, undefined).slice(0, 5)
  }, [data, ageMin, ageMax, cityQ, minMatch])

  const ringRadius = 28
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - Math.max(0, Math.min(100, simScore ?? 0)) / 100)
  const ringLevel = simScore == null ? 'none' : (simScore >= 85 ? 'high' : (simScore >= 60 ? 'moderate' : 'low'))
  const ringColor = ringLevel === 'high' ? 'rgba(34,197,94,1)' : ringLevel === 'moderate' ? 'rgba(245,158,11,1)' : ringLevel === 'low' ? 'rgba(244,63,94,1)' : 'rgba(203,213,225,1)'
  const ringBg = ringLevel === 'high' ? 'rgba(34,197,94,0.25)' : ringLevel === 'moderate' ? 'rgba(245,158,11,0.25)' : ringLevel === 'low' ? 'rgba(244,63,94,0.25)' : 'rgba(203,213,225,0.25)'
  const isUserFemale = /female|wanita|perempuan/i.test(data?.profile?.gender || '')
  const isTargetFemale = /female|wanita|perempuan/i.test(simTarget?.targetGender || '')
  const userGenderClasses = isUserFemale ? { bg: 'bg-gradient-to-r from-rose-500 to-pink-500', border: 'border-white/30', text: 'text-white' } : { bg: 'bg-gradient-to-r from-indigo-500 to-violet-500', border: 'border-white/30', text: 'text-white' }
  const targetGenderClasses = isTargetFemale ? { bg: 'bg-gradient-to-r from-rose-500 to-pink-500', border: 'border-white/30', text: 'text-white' } : { bg: 'bg-gradient-to-r from-indigo-500 to-violet-500', border: 'border-white/30', text: 'text-white' }

  const simulateMatch = () => {
    if (!data) { setSimScore(null); setSimTarget(null); return }
    const arr = (displayedMatches && displayedMatches.length ? displayedMatches : (data.matches || []))
    if (!arr.length) { setSimScore(null); setSimTarget(null); return }
    setSimRunning(true)
    const cand = arr[Math.floor(Math.random() * arr.length)]
    const base = Math.max(0, Math.min(100, typeof cand.matchPercentage === 'number' ? cand.matchPercentage : 50))
    const variance = Math.round((Math.random() - 0.5) * 12)
    const score = Math.max(0, Math.min(100, base + variance))
    setTimeout(() => { setSimTarget(cand); setSimScore(score); setSimRunning(false) }, 400)
  }

  // --- Render Helpers ---

  const isSubscriptionExpired = data?.subscription && data.subscription.endDate
    ? new Date(data.subscription.endDate) < new Date()
    : !data?.subscription?.isActive
  const isReadyForRecommendations = !!(data?.flags?.profileCompleted && data?.flags?.psychotestCompleted)
  const hasProfile = !!data?.flags?.profileCompleted
  const hasPsychotest = !!data?.flags?.psychotestCompleted

  // Ad Logic for Mobile: Map sidebar/top ads to mobile positions
  const mobileTopAd = (data?.advertisements || []).find(a => a.position === 'dashboard_left' || a.position === 'dashboard_top')
  const mobileMiddleAd = (data?.advertisements || []).find(a => a.position === 'dashboard_right' || a.position === 'dashboard_middle')
  const mobileBottomAd = (data?.advertisements || []).find(a => a.position === 'dashboard_bottom' || a.position === 'dashboard_center')

  const AdCard = ({ ad, className }: { ad: any, className?: string }) => (
    <Card className={`overflow-hidden border-none shadow-sm ${className}`}>
      <CardContent className="p-0">
        {ad.imageUrl ? (
          <Link href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined}>
            <img src={ad.imageUrl} alt={ad.title} className="w-full h-32 object-cover rounded-lg" />
          </Link>
        ) : (
          <div className="relative h-24 bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center rounded-lg">
            <div className="text-center px-4">
              <p className="text-[10px] text-gray-500 font-bold tracking-wider mb-1">IKLAN SPONSOR</p>
              <h3 className="text-sm font-bold text-gray-800">{ad.title}</h3>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const getFirstLastInitials = (name?: string | null) => {
    if (!name) return ''
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0]?.toUpperCase() || ''
    const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[0])?.toUpperCase() || ''
    return `${first}${last}`
  }

  const canShowPhotoForCard = (match: any) => {
    const step = match.matchStep || ''
    return step === 'mutual_liked'
  }

  const getTopCandidate = () => {
    return (displayedMatches && displayedMatches.length > 0) ? displayedMatches[0] : null
  }


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* --- MOBILE HEADER (Sticky) --- */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm md:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          {/* Left: Hamburger (Optional, functionality mirrored in User Menu/Bottom Nav) */}
          <div className="flex items-center gap-2">
            <div className="bg-rose-500 p-1.5 rounded-lg">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              Setaruf
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
             <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
              <DropdownMenuTrigger asChild>
                <button className="relative p-2 text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                  <Bell className="w-5 h-5" />
                  {notifItems.some(n => !n.isRead) && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
                <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifItems.length === 0 ? <div className="px-3 py-2 text-xs text-gray-500">Belum ada notifikasi.</div> : 
                  notifItems.map((n) => (
                    <DropdownMenuItem key={n.id} className={`flex flex-col items-start whitespace-normal ${!n.isRead ? 'bg-rose-50' : ''}`}>
                      <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                      <p className="text-[11px] text-gray-600">{n.message}</p>
                    </DropdownMenuItem>
                  ))
                }
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="w-8 h-8 cursor-pointer">
                  {data?.user.avatar ? <AvatarImage src={data.user.avatar} className="object-cover" /> : null}
                  <AvatarFallback className="bg-rose-100 text-rose-600 text-xs">{getInitials(data?.user.name || 'U')}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild><Link href="/dashboard/profile"><User className="w-4 h-4 mr-2"/>Profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings className="w-4 h-4 mr-2"/>Settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/subscription"><CreditCard className="w-4 h-4 mr-2"/>Subscription</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => signOut({ callbackUrl: '/' })}><LogOut className="w-4 h-4 mr-2"/>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* --- MOBILE CONTENT SCROLL AREA --- */}
      <main className="flex-1 overflow-y-auto pb-24 md:hidden no-scrollbar">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
          
          {/* 1. Top Ad */}
          {mobileTopAd && <AdCard ad={mobileTopAd} />}

          {/* 2. User Profile Summary (Compact) */}
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-16 h-16">
                  {data?.profile?.photoUrl ? <AvatarImage src={data.profile.photoUrl} className="object-cover" /> : (data?.user.avatar ? <AvatarImage src={data.user.avatar} className="object-cover" /> : null)}
                  <AvatarFallback className="bg-rose-500 text-white text-xl">{getInitials(data?.user.name || 'U')}</AvatarFallback>
                </Avatar>
                {typeof data?.profile?.age === 'number' && (
                  <span className="absolute -bottom-1 left-0 text-[10px] px-2 py-0.5 rounded-full bg-white border border-rose-200 text-gray-700">
                    {data.profile.age} thn
                  </span>
                )}
                {(data?.profile?.occupation || '') && (
                  <span className="absolute -bottom-1 right-0 max-w-[8rem] truncate text-[10px] px-2 py-0.5 rounded-full bg-white border border-rose-200 text-gray-700">
                    {data?.profile?.occupation || 'Pekerjaan'}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900 leading-tight">{data?.profile?.fullName || data?.user.name || 'User'}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const parts = [
                      typeof data?.profile?.age === 'number' ? `${data?.profile?.age} thn` : null,
                      data?.profile?.occupation || 'Pekerjaan belum diisi',
                      data?.profile?.city || '-'
                    ].filter(Boolean)
                    return parts.join(' • ')
                  })()}
                </p>
                <div className="flex gap-2 mt-3">
                  <Link href="/dashboard/profile" className="flex-1">
                    <Button
                      variant={hasProfile ? 'outline' : 'default'}
                      size="sm"
                      className={`w-full h-8 text-xs font-medium ${hasProfile ? '' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    >
                      <Edit className="w-3 h-3 mr-1"/>Edit
                    </Button>
                  </Link>
                  <Link href="/dashboard/psychotest" className="flex-1">
                    <Button
                      variant={hasPsychotest ? 'outline' : 'default'}
                      size="sm"
                      className={`w-full h-8 text-xs font-medium ${hasPsychotest ? '' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    >
                      <RotateCcw className="w-3 h-3 mr-1"/>Psikotes
                    </Button>
                  </Link>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Kode Unik</span>
                  <Badge variant="outline" className="font-mono">{data?.user.uniqueCode || '-'}</Badge>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-8 px-2 rounded-md border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 text-xs"
                    onClick={() => {
                      if (data?.user.uniqueCode) {
                        navigator.clipboard.writeText(data.user.uniqueCode)
                        toast({ title: 'Tersalin', description: 'Kode unik disalin ke clipboard' })
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Welcome & Alert */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Halo, {data?.profile?.fullName?.split(' ')[0] || data?.user.name?.split(' ')[0] || 'User'}! 👋</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              {(() => {
                if (!data) return 'Memuat...'
                const pending = (data.matches || []).filter(m => m.matchStatus === 'pending' && m.matchStep === 'profile_request').length
                const liked = (data.matches || []).filter(m => m.matchStep === 'target_approved').length
                return `Kamu memiliki ${pending} permintaan profil dan ${liked} orang menyukaimu.`
              })()}
            </p>
            <div className="mt-3">
              <div className="flex gap-2">
                <Input
                  value={dailyQuote}
                  onChange={(e) => setDailyQuote(e.target.value)}
                  placeholder="Tulis quote harian di sini... (boleh emoji 😊)"
                  className="flex-1 h-9 text-sm"
                  maxLength={100}
                />
                <Button
                  disabled={quoteSaving || !dailyQuote.trim()}
                  onClick={saveDailyQuote}
                  className="h-9 text-xs bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                >
                  {quoteSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
              {dailyQuote?.trim() ? (
                <p className="text-[11px] text-gray-500 mt-1">Quote Kamu akan tampil di rekomendasi. ({(dailyQuote || '').length}/100)</p>
              ) : (
                <p className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center text-[10px] text-rose-600">
                    <Lightbulb className="w-3 h-3 mr-1 text-rose-500" />Tip AI: {tipText}
                  </span>
                  <span className="text-[10px] text-gray-500">({(dailyQuote || '').length}/100)</span>
                </p>
              )}
            </div>
          </div>

          {/* 4. Workflow Steps (Horizontal) */}
          <div className="overflow-x-auto pb-2 no-scrollbar">
            <div className="flex gap-3 min-w-max">
              {workflowSteps.map((step, index) => {
                const isActive = index === currentWorkflowIndex
                const isDone = index < currentWorkflowIndex
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1.5 w-16">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${isDone ? 'bg-green-500 border-green-500 text-white' : isActive ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                      {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-[10px] font-medium text-center w-full ${isActive ? 'text-rose-600' : 'text-gray-500'}`}>{step.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5. Psychotest Results & Stats (Horizontal Scroll) */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Hasil Psikotes & Statistik</h3>
            <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar snap-x">
              {/* Stat Card */}
              <Card className="min-w-[200px] snap-center">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-gray-500">Kecocokan Rata-rata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-600">
                    {isReadyForRecommendations && data?.matches && data.matches.length > 0
                      ? (data.matches.reduce((sum, m) => sum + m.matchPercentage, 0) / data.matches.length).toFixed(0)
                      : 0}%
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${isReadyForRecommendations && data?.matches && data.matches.length > 0 ? (data.matches.reduce((sum, m) => sum + m.matchPercentage, 0) / data.matches.length) : 0}%` }}
                    ></div>
                  </div>
                </CardContent>
              </Card>

              {/* Chart Card */}
              <Card className="min-w-[240px] snap-center overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-gray-500">Grafik Skor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.psychotests || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="testType" tickLine={false} tickMargin={6} axisLine={false} tickFormatter={(value) => { const labels: Record<string, string> = { pre_marriage: 'Pra-Nikah', disc: 'DISC', clinical: 'Clinical', '16pf': '16PF' }; return labels[value] || value }} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={6} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                          {(data?.psychotests || []).map((_, index) => (
                            <Cell key={`cell-m-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                          <LabelList dataKey="score" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 6. Psychotest Action (If needed) */}
          {workflowSteps[currentWorkflowIndex]?.key === 'psychotest' && (
            <Card className="bg-rose-50 border-rose-100">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-rose-900">Progres Psikotes</span>
                  <span className="text-xs font-bold text-rose-600">{data?.progress?.psychotestCompletedCount || 0}/{data?.progress?.psychotestRequiredCount || 4}</span>
                </div>
                <Progress value={data?.progress?.psychotestCompletionPercent || 0} className="h-2 mb-3" />
                <Link href="/dashboard/psychotest">
                  <Button size="sm" className="w-full bg-rose-600 hover:bg-rose-700 text-white">Lanjutkan Psikotes</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* 7. Subscription Alert */}
          {isSubscriptionExpired && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">
                Subscription berakhir. <Link href="/dashboard/subscription" className="underline font-bold">Perbarui sekarang</Link>.
              </AlertDescription>
            </Alert>
          )}

          {/* 8. Matches List */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Rekomendasi Pasangan</h3>
            {!isReadyForRecommendations ? (
              <Alert className="bg-rose-50 border-rose-200">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <AlertDescription className="text-xs text-rose-800">
                  Silahkan isi profile dan Psikotes terlebih dahulu
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {displayedMatches && displayedMatches.length > 0 ? (
                  displayedMatches.map((match) => (
                    <Card key={match.id} className="overflow-hidden shadow-sm active:scale-[0.98] transition-transform duration-200">
                      <CardContent className="p-0">
                        <div className="p-3 flex items-center gap-3">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            {canShowPhotoForCard(match) && match.targetAvatar ? <AvatarImage src={match.targetAvatar} className="object-cover" /> : null}
                            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">{getFirstLastInitials(match.targetName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-gray-900 truncate">{getFirstLastInitials(match.targetName)}</h4>
                            {match.matchStep === 'mutual_liked' && (
                              <div className="mt-0.5">
                                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[10px]">Mutual Suka</Badge>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 truncate">
                              {match.targetAge && `${match.targetAge} thn`} {match.targetOccupation && `• ${match.targetOccupation}`} {match.targetCity && `• ${match.targetCity}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className={`text-sm font-bold ${match.matchPercentage >= 70 ? 'text-green-600' : 'text-rose-500'}`}>
                              {match.matchPercentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          {match.targetQuote ? (
                            <p className="text-[11px] text-gray-700 italic mb-2 line-clamp-2">“{match.targetQuote}”</p>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <Button
                              className="flex-1 h-9 text-xs bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                              disabled={isSubscriptionExpired || !data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted}
                              onClick={async () => {
                                const res = await fetch(`/api/matches/${match.id}/request`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) alert(json.error || 'Gagal mengirim permintaan lihat profil.')
                                else { alert('Permintaan lihat profil dikirim. Menunggu persetujuan.') }
                              }}
                            >
                              Lihat Profil <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                            <div className="flex items-center gap-1">
                              <button
                                className="p-1 rounded text-green-600 hover:bg-gray-100"
                                onClick={async () => {
                                const res = await fetch(`/api/matches/${match.id}/like`, { method: 'POST' })
                                  const json = await res.json()
                                  if (!res.ok) alert(json.error || 'Gagal menyukai profil.')
                                  else {
                                    setData(prev => {
                                      if (!prev) return prev
                                      const updated = (prev.matches || []).map(m => m.id === match.id ? { ...m, matchStatus: 'liked' } : m)
                                      return { ...prev, matches: updated }
                                    })
                                    alert('Sukses menyukai profil.')
                                  }
                                }}
                                title="Suka"
                              >
                                <Heart className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="p-1 rounded text-red-600 hover:bg-gray-100"
                                onClick={async () => {
                                const res = await fetch(`/api/matches/${match.id}/dislike`, { method: 'POST' })
                                  const json = await res.json()
                                  if (!res.ok) alert(json.error || 'Gagal menolak profil.')
                                  else {
                                    setData(prev => {
                                      if (!prev) return prev
                                      const updated = (prev.matches || []).filter(m => m.id !== match.id)
                                      return { ...prev, matches: updated }
                                    })
                                    alert('Profil dihapus permanen dari rekomendasi.')
                                  }
                                }}
                                title="Tidak"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="p-1 rounded text-green-600 hover:bg-gray-100"
                                onClick={async () => {
                                  const allow = (match.matchStep === 'mutual_liked') || ((match.matchStatus === 'liked') && (match.matchStep === 'profile_viewed'))
                                  if (allow && match.targetWhatsapp) {
                                    const num = (match.targetWhatsapp || '').replace(/[^0-9]/g, '')
                                    window.open(`https://wa.me/${num}`, '_blank')
                                    return
                                  }
                                  const res = await fetch(`/api/matches/${match.id}/request-full-biodata`, { method: 'POST' })
                                  const json = await res.json()
                                  if (!res.ok) alert(json.error || 'Gagal mengirim permintaan akses kontak.')
                                  else { alert('Permintaan akses kontak (WhatsApp) dikirim. Menunggu persetujuan.') }
                                }}
                                title="WhatsApp"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="p-1 rounded text-pink-500 hover:bg-gray-100"
                                onClick={async () => {
                                  const allow = (match.matchStep === 'mutual_liked') || ((match.matchStatus === 'liked') && (match.matchStep === 'profile_viewed'))
                                  if (allow && match.targetInstagram) {
                                    const handle = (match.targetInstagram || '').replace(/^@/, '')
                                    window.open(`https://instagram.com/${handle}`, '_blank')
                                    return
                                  }
                                  const res = await fetch(`/api/matches/${match.id}/request-full-biodata`, { method: 'POST' })
                                  const json = await res.json()
                                  if (!res.ok) alert(json.error || 'Gagal mengirim permintaan akses kontak.')
                                  else { alert('Permintaan akses kontak (Instagram) dikirim. Menunggu persetujuan.') }
                                }}
                                title="Instagram"
                              >
                                <Instagram className="w-3.5 h-3.5" />
                              </button>
                              {((match.matchStep === 'profile_viewed') || (match.matchStep === 'chatting')) && (
                                <button
                                  className="p-1 rounded text-blue-600 hover:bg-gray-100"
                                  onClick={async () => {
                                    const res = await fetch(`/api/matches/${match.id}/start-chat`, { method: 'POST' })
                                    const json = await res.json()
                                    if (!res.ok) {
                                      alert(json.error || 'Belum dapat memulai chat')
                                      return
                                    }
                                    router.push(`/dashboard/matches/${match.id}/chat`)
                                  }}
                                  title="Chat"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white rounded-lg border border-dashed border-gray-300">
                    <Heart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Belum ada rekomendasi</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 9. Middle Ad */}
          {mobileMiddleAd && <AdCard ad={mobileMiddleAd} />}

          {/* 10. Search by Code */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="w-4 h-4 text-rose-500" /> Cari Pasangan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchByCode} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Kode Unik (cth: SET123)"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                    disabled={isSearching || !data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted}
                    className="text-sm"
                  />
                  <Button type="submit" disabled={isSearching || !searchCode || !data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted} size="sm" className="bg-rose-600 hover:bg-rose-700 px-3">
                    {isSearching ? '...' : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {searchResult && (
                  <div className="bg-gray-50 p-3 rounded-lg flex items-center gap-3 border">
                    <Avatar className="w-10 h-10">
                       {searchResult.avatar ? <AvatarImage src={searchResult.avatar} /> : null}
                       <AvatarFallback className="bg-rose-100 text-rose-600 text-xs">{getInitials(searchResult.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{searchResult.name}</p>
                      <p className="text-xs text-gray-500">{searchResult.matchPercentage}% Match</p>
                    </div>
                    <Link href={`/dashboard/matches/${searchResult.matchId}`}>
                      <Button size="sm" variant="ghost" className="text-rose-600 h-8 px-2">Lihat</Button>
                    </Link>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* 11. Subscription & Reminders (Compact) */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-600">Status</span>
                </div>
                <Badge variant={data?.subscription?.planType === 'premium' ? 'default' : 'secondary'} className={data?.subscription?.planType === 'premium' ? 'bg-rose-500' : ''}>
                  {data?.subscription?.planType || 'Free'}
                </Badge>
                {isSubscriptionExpired && <p className="text-[10px] text-red-500 mt-1">Expired</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                 <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-600">Sisa Waktu</span>
                </div>
                {timeLeft ? (
                  <p className="text-xs font-bold text-gray-800">{timeLeft.days} Hari {timeLeft.hours} Jam</p>
                ) : (
                   <p className="text-xs text-gray-400">-</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 12. Bottom Ad */}
          {mobileBottomAd && <AdCard ad={mobileBottomAd} className="mb-2" />}

          <div className="h-4"></div> {/* Spacer for scroll end */}
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAV (Sticky) --- */}
      <nav className="md:hidden sticky bottom-0 z-50 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="grid grid-cols-4 h-16">
          <Link href="/dashboard" className="flex flex-col items-center justify-center gap-1 text-rose-600 active:bg-gray-50 transition-colors">
            <Home className="w-6 h-6" strokeWidth={2.5} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/dashboard/profile" className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-rose-600 active:bg-gray-50 transition-colors">
            <User className="w-6 h-6" strokeWidth={2} />
            <span className="text-[10px] font-medium">Profil</span>
          </Link>
          <Link href="/dashboard/psychotest" className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-rose-600 active:bg-gray-50 transition-colors">
            <FileText className="w-6 h-6" strokeWidth={2} />
            <span className="text-[10px] font-medium">Tes</span>
          </Link>
          <Link href="/dashboard/messages" className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-rose-600 active:bg-gray-50 transition-colors">
            <div className="relative">
              <MessageSquare className="w-6 h-6" strokeWidth={2} />
              {notifItems.some(n => !n.isRead) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>}
            </div>
            <span className="text-[10px] font-medium">Chat</span>
          </Link>
        </div>
      </nav>

      {/* --- DESKTOP VIEW (Original Layout Preserved) --- */}
      <div className="hidden md:block min-h-screen bg-gray-50">
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-xl">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">Setaruf</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="flex items-center gap-2 text-rose-600 font-medium"><Home className="w-4 h-4" />Home</Link>
                <Link href="/dashboard/profile" className="flex items-center gap-2 text-gray-600 hover:text-rose-600"><User className="w-4 h-4" />Profile</Link>
                <Link href="/dashboard/psychotest" className="flex items-center gap-2 text-gray-600 hover:text-rose-600"><FileText className="w-4 h-4" />Psikotes</Link>
                <Link href="/dashboard/messages" className="flex items-center gap-2 text-gray-600 hover:text-rose-600"><MessageSquare className="w-4 h-4" />Messages</Link>
              </nav>
              <div className="flex items-center gap-4">
                <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-2 text-gray-600 hover:text-rose-600 transition-colors">
                      <Bell className="w-5 h-5" />
                      {notifItems.some(n => !n.isRead) && <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{notifItems.filter(n => !n.isRead).length}</span>}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
                    <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifItems.map((n) => (
                      <DropdownMenuItem key={n.id} className={`flex flex-col items-start whitespace-normal ${!n.isRead ? 'bg-rose-50' : ''}`}>
                        <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                        <p className="text-[11px] text-gray-600">{n.message}</p>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" className="p-0 h-auto"><Avatar className="w-9 h-9">{data?.user.avatar ? <AvatarImage src={data.user.avatar} className="object-cover" /> : null}<AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white">{getInitials(data?.user.name || 'U')}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal"><div className="flex flex-col space-y-1"><p className="text-sm font-medium">{data?.user.name || 'User'}</p><p className="text-xs text-gray-500">{data?.user.email}</p></div></DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/dashboard/profile" className="cursor-pointer"><User className="w-4 h-4 mr-2" />Profile</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/settings" className="cursor-pointer"><Settings className="w-4 h-4 mr-2" />Settings</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/subscription" className="cursor-pointer"><CreditCard className="w-4 h-4 mr-2" />Subscription</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => signOut({ callbackUrl: '/' })}><LogOut className="w-4 h-4 mr-2" />Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar Desktop */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-20 space-y-4">
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white pb-4">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <Avatar className="w-20 h-20 border-4 border-white/30">
                          {data?.profile?.photoUrl ? <AvatarImage src={data.profile.photoUrl} alt={data?.user.name} className="object-cover" /> : (data?.user.avatar ? <AvatarImage src={data.user.avatar} alt={data.user.name} className="object-cover" /> : null)}
                          <AvatarFallback className="bg-white text-rose-600 text-2xl">{getInitials(data?.user.name || 'U')}</AvatarFallback>
                        </Avatar>
                        {typeof data?.profile?.age === 'number' && (
                          <span className="absolute -bottom-2 left-0 text-[10px] px-2 py-0.5 rounded-full bg-white/90 border border-white text-rose-700">
                            {data.profile.age} thn
                          </span>
                        )}
                        {(data?.profile?.occupation || '') && (
                          <span className="absolute -bottom-2 right-0 max-w-[10rem] truncate text-[10px] px-2 py-0.5 rounded-full bg-white/90 border border-white text-rose-700">
                            {data?.profile?.occupation || 'Pekerjaan'}
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg">{data?.profile?.fullName || data?.user.name || 'User'}</CardTitle>
                      <CardDescription className="text-white/80 text-sm">{data?.profile?.occupation || 'Pekerjaan belum diisi'}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Usia</span><span className="font-medium">{data?.profile?.age || '-'} tahun</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Domisili</span><span className="font-medium">{data?.profile?.city || '-'}</span></div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-500">Kode Unik</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{data?.user.uniqueCode || '-'}</Badge>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 px-2 rounded-md border border-white/50 text-white/90 bg-white/20 hover:bg-white/30 text-[11px]"
                          onClick={() => {
                            if (data?.user.uniqueCode) {
                              navigator.clipboard.writeText(data.user.uniqueCode)
                              toast({ title: 'Tersalin', description: 'Kode unik disalin ke clipboard' })
                            }
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        asChild
                        variant={hasProfile ? 'outline' : 'default'}
                        size="sm"
                        className={`flex-1 ${hasProfile ? '' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                      >
                        <Link href="/dashboard/profile"><Edit className="w-3 h-3 mr-1" />Edit</Link>
                      </Button>
                      <Button
                        asChild
                        variant={hasPsychotest ? 'outline' : 'default'}
                        size="sm"
                        className={`flex-1 ${hasPsychotest ? '' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                      >
                        <Link href="/dashboard/psychotest"><RotateCcw className="w-3 h-3 mr-1" />Psikotes</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm font-medium">Status Workflow</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {workflowSteps.map((step, index) => {
                        const isCompleted = index < currentWorkflowIndex
                        const isCurrent = index === currentWorkflowIndex
                        const Icon = step.icon
                        const mutualViewed = (data?.matches || []).filter(m => m.matchStep === 'profile_viewed' && m.matchStatus === 'approved')
                        const mutualLiked = (data?.matches || []).filter(m => m.matchStep === 'mutual_liked')
                        return (
                          <div key={step.key} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${isCompleted ? 'bg-green-500 border-green-500 text-white' : isCurrent ? 'bg-rose-500 border-rose-500 text-white' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>{isCompleted ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}</div>
                              <span className={`text-sm ${isCurrent ? 'font-medium text-rose-600' : 'text-gray-600'}`}>{step.label}</span>
                            </div>
                            {step.key === 'view_profile' && mutualViewed.length > 0 && (
                              <div className="pl-11">
                                <div className="text-xs text-gray-500 mb-1">Mutual Lihat Profil</div>
                                <div className="flex flex-wrap gap-1">
                                  {mutualViewed.slice(0, 6).map(m => (
                                    <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] bg-white border-rose-200 text-rose-700">
                                      {m.targetName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {step.key === 'getting_to_know' && mutualLiked.length > 0 && (
                              <div className="pl-11">
                                <div className="text-xs text-gray-500 mb-1">Mutual Suka</div>
                                <div className="flex flex-wrap gap-1">
                                  {mutualLiked.slice(0, 6).map(m => (
                                    <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] bg-white border-green-200 text-green-700">
                                      {m.targetName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </aside>

            {/* Main Center Desktop */}
            <main className="lg:col-span-6 space-y-6">
              <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900 mb-1">Selamat Datang, {data?.profile?.fullName || data?.user.name?.split(' ')[0] || 'User'}!</h1><p className="text-gray-600">{(() => { if (!data) return 'Memuat...'; const prefix = 'Kamu'; const parts: string[] = []; if (!data.flags?.profileCompleted) parts.push('belum mengisi profile'); if (!data.flags?.psychotestCompleted) parts.push('belum mengikuti psikotes'); const pendingRequests = (data.matches || []).filter(m => m.matchStatus === 'pending' && m.matchStep === 'profile_request'); const likedByTarget = (data.matches || []).filter(m => m.matchStep === 'target_approved'); const today = new Date(); const day = today.toLocaleDateString('id-ID', { weekday: 'long' }); const notif = data.notifications || 0; const statusPart = parts.length ? `(${parts.join(' dan ')})` : '(Semua syarat dasar terpenuhi)'; const reqPart = pendingRequests.length ? `Kamu telah meminta lihat profil ke ${pendingRequests[0].targetName}${pendingRequests.length > 1 ? ` dan ${pendingRequests.length - 1} lainnya` : ''}` : 'Belum ada permintaan lihat profil'; const likePart = likedByTarget.length ? `${likedByTarget[0].targetName} memilih Lanjut${likedByTarget.length > 1 ? ` dan ${likedByTarget.length - 1} lainnya` : ''}` : 'Belum ada yang memilih Lanjut'; return `${prefix} ${statusPart}. ${reqPart}. ${likePart}. Hari ini ${day}, ${notif} notifikasi belum dibaca.`; })()}</p><div className="mt-3"><div className="flex gap-2"><Input value={dailyQuote} onChange={(e) => setDailyQuote(e.target.value)} placeholder="Tulis quote harian Kamu di sini... (boleh emoji 😊)" className="flex-1" maxLength={100} /><Button disabled={quoteSaving || !dailyQuote.trim()} onClick={saveDailyQuote} className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600">{quoteSaving ? 'Menyimpan...' : 'Simpan Quote'}</Button></div>{dailyQuote?.trim() ? (<p className="text-xs text-gray-500 mt-1">Quote Kamu akan tampil ke calon pasangan di rekomendasi. ({(dailyQuote || '').length}/100)</p>) : (<p className="mt-1 flex items-center gap-2"><span className="inline-flex items-center text-[10px] text-rose-600"><Lightbulb className="w-3 h-3 mr-1 text-rose-500" />Tip AI hari ini: {tipText}</span><span className="text-[10px] text-gray-500">({(dailyQuote || '').length}/100)</span></p>)}</div></div><div className="hidden sm:block"><Heart className="w-12 h-12 text-rose-500 opacity-20" /></div></div></CardContent></Card>
              
              {workflowSteps[currentWorkflowIndex]?.key === 'psychotest' && (
                <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Mulai Psikotes</h2><p className="text-sm text-gray-600">Selesaikan semua tes untuk lanjut ke pencocokan</p></div><Link href="/dashboard/psychotest"><Button className="bg-rose-600 hover:bg-rose-700 text-white">Mulai Psikotes</Button></Link></div><div className="mt-4"><Progress value={data?.progress?.psychotestCompletionPercent || 0} /><div className="mt-2 text-sm text-gray-600">{data?.progress?.psychotestCompletedCount || 0}/{data?.progress?.psychotestRequiredCount || 4} tes selesai</div></div></CardContent></Card>
              )}

              {isSubscriptionExpired && (<Alert className="bg-amber-50 border-amber-200"><AlertTriangle className="h-4 w-4 text-amber-600" /><AlertDescription className="text-amber-800"><strong>Subscription Expired:</strong> Subscription Anda telah berakhir. Silakan perbarui untuk akses penuh. <Button asChild size="sm" className="ml-2 bg-amber-600 hover:bg-amber-700"><Link href="/dashboard/subscription">Perbarui Sekarang</Link></Button></AlertDescription></Alert>)}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-rose-500" /> Rekomendasi Pasangan</CardTitle>
                  <CardDescription>Pasangan yang cocok berdasarkan hasil psikotes dan kriteria Anda</CardDescription>
                </CardHeader>
                <CardContent>
                  {!isReadyForRecommendations && (
                    <Alert className="bg-rose-50 border-rose-200 text-rose-800">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <AlertDescription>Silahkan isi profile dan Psikotes terlebih dahulu</AlertDescription>
                    </Alert>
                  )}
                  <div className={`space-y-4 ${!isReadyForRecommendations ? 'hidden' : ''}`}>
                    {displayedMatches && displayedMatches.length > 0 ? displayedMatches.map((match) => (
                      <Card key={match.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="w-14 h-14 flex-shrink-0">
                              {canShowPhotoForCard(match) && match.targetAvatar ? <AvatarImage src={match.targetAvatar} alt={match.targetName} className="object-cover" /> : null}
                              <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white">{getFirstLastInitials(match.targetName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{getFirstLastInitials(match.targetName)}</h4>
                              {match.matchStep === 'mutual_liked' && (
                                <div className="mt-0.5">
                                  <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[10px]">Mutual Suka</Badge>
                                </div>
                              )}
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
                              {match.targetQuote ? (
                                <p className="text-xs text-gray-700 mt-1 italic line-clamp-2">“{match.targetQuote}”</p>
                              ) : null}
                              {(() => {
                                const incomplete = !match.targetAge || !match.targetOccupation || !match.targetCity
                                return incomplete ? (
                                  <div className="mt-1">
                                    <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">Profil belum lengkap</Badge>
                                  </div>
                                ) : null
                              })()}
                            </div>
                            <div className="text-center flex-shrink-0">
                              <div className={`text-2xl font-bold ${match.matchPercentage >= 80 ? 'text-green-600' : match.matchPercentage >= 60 ? 'text-rose-600' : 'text-yellow-600'}`}>{match.matchPercentage.toFixed(0)}%</div>
                              <p className="text-xs text-gray-500">Kecocokan</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                              disabled={isSubscriptionExpired || !data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted}
                              onClick={async () => {
                                const res = await fetch(`/api/matches/${match.id}/request`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) { alert(json.error || 'Gagal mengirim permintaan lihat profil.'); return }
                                alert('Permintaan lihat profil dikirim. Menunggu persetujuan.')
                              }}
                            >
                              <User className="w-4 h-4 mr-2" />View Profile<ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-10 h-9 rounded-md text-green-600 bg-white hover:bg-rose-50"
                              title="Suka"
                              onClick={async () => {
                                const res = await fetch(`/api/matches/${match.id}/like`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) alert(json.error || 'Gagal menyukai profil.')
                                else {
                                  setData(prev => {
                                    if (!prev) return prev
                                    const updated = (prev.matches || []).map(m => m.id === match.id ? { ...m, matchStatus: 'liked', matchStep: json.step || m.matchStep } : m)
                                    return { ...prev, matches: updated }
                                  })
                                  alert('Sukses menyukai profil.')
                                }
                              }}
                            >
                              <Heart className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-10 h-9 rounded-md text-red-600 bg-white hover:bg-rose-50"
                              title="Tidak"
                              onClick={async () => {
                                const res = await fetch(`/api/matches/${match.id}/dislike`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) alert(json.error || 'Gagal menolak profil.')
                                else {
                                  setData(prev => {
                                    if (!prev) return prev
                                    const updated = (prev.matches || []).filter(m => m.id !== match.id)
                                    return { ...prev, matches: updated }
                                  })
                                  alert('Profil dihapus permanen dari rekomendasi.')
                                }
                              }}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-10 h-9 rounded-md border border-rose-200 text-rose-600 bg-white hover:bg-rose-50"
                              title="WhatsApp"
                              onClick={async () => {
                                const allow = (match.matchStep === 'mutual_liked') || ((match.matchStatus === 'liked') && (match.matchStep === 'profile_viewed'))
                                if (allow && match.targetWhatsapp) {
                                  const num = (match.targetWhatsapp || '').replace(/[^0-9]/g, '')
                                  window.open(`https://wa.me/${num}`, '_blank')
                                  return
                                }
                                const res = await fetch(`/api/matches/${match.id}/request-full-biodata`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) alert(json.error || 'Gagal mengirim permintaan akses kontak.')
                                else { alert('Permintaan akses kontak (WhatsApp) dikirim. Menunggu persetujuan.') }
                              }}
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-10 h-9 rounded-md border border-rose-200 text-rose-600 bg-white hover:bg-rose-50"
                              title="Instagram"
                              onClick={async () => {
                                const allow = (match.matchStep === 'mutual_liked') || ((match.matchStatus === 'liked') && (match.matchStep === 'profile_viewed'))
                                if (allow && match.targetInstagram) {
                                  const handle = (match.targetInstagram || '').replace(/^@/, '')
                                  window.open(`https://instagram.com/${handle}`, '_blank')
                                  return
                                }
                                const res = await fetch(`/api/matches/${match.id}/request-full-biodata`, { method: 'POST' })
                                const json = await res.json()
                                if (!res.ok) alert(json.error || 'Gagal mengirim permintaan akses kontak.')
                                else { alert('Permintaan akses kontak (Instagram) dikirim. Menunggu persetujuan.') }
                              }}
                            >
                              <Instagram className="w-4 h-4" />
                            </button>
                              {((match.matchStep === 'profile_viewed') || (match.matchStep === 'chatting')) && (
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center w-10 h-9 rounded-md border border-blue-200 text-blue-600 bg-white hover:bg-rose-50"
                                  title="Chat"
                                  onClick={async () => {
                                    const res = await fetch(`/api/matches/${match.id}/start-chat`, { method: 'POST' })
                                    const json = await res.json()
                                    if (!res.ok) {
                                      alert(json.error || 'Belum dapat memulai chat')
                                      return
                                    }
                                    router.push(`/dashboard/matches/${match.id}/chat`)
                                  }}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              )}
                          </div>
                          {(!data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted) && (
                            <p className="text-xs text-gray-500 mt-2">Lengkapi biodata dan semua psikotes untuk membuka profil rekomendasi.</p>
                          )}
                        </CardContent>
                      </Card>
                    )) : (
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

            {/* Right Sidebar Desktop */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-20 space-y-4">
                 <Card><CardHeader><CardTitle className="text-sm font-medium">Status Subscription</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm text-gray-600">Plan</span><Badge variant={data?.subscription?.planType === 'premium' ? 'default' : 'secondary'} className={data?.subscription?.planType === 'premium' ? 'bg-gradient-to-r from-rose-500 to-pink-500' : ''}>{data?.subscription?.planType === 'premium' ? 'Premium' : 'Free'}</Badge></div>{data?.subscription?.endDate && (<><div className="flex items-center justify-between"><span className="text-sm text-gray-600">Status</span>{isSubscriptionExpired ? <Badge variant="destructive">Expired</Badge> : <Badge className="bg-green-500">Active</Badge>}</div>{!isSubscriptionExpired && timeLeft && (<div className="bg-rose-50 rounded-lg p-3 border border-rose-200"><p className="text-xs text-rose-600 mb-2">Sisa Waktu</p><div className="grid grid-cols-3 gap-2 text-center"><div><div className="text-xl font-bold text-rose-600">{timeLeft.days}</div><div className="text-xs text-gray-600">Hari</div></div><div><div className="text-xl font-bold text-rose-600">{timeLeft.hours}</div><div className="text-xs text-gray-600">Jam</div></div><div><div className="text-xl font-bold text-rose-600">{timeLeft.minutes}</div><div className="text-xs text-gray-600">Menit</div></div></div></div>)}{endDateLabel && (<p className="text-xs text-gray-500 text-center">Berakhir: {endDateLabel}</p>)}</>)}<Button asChild className={`w-full ${data?.subscription?.planType === 'premium' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'}`}><Link href="/dashboard/subscription">{data?.subscription?.planType === 'premium' ? 'Manage Subscription' : 'Upgrade to Premium'}</Link></Button></CardContent></Card>
                 <Card><CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Search className="w-4 h-4 text-rose-500" />Cari Pasangan dengan Kode Unik</CardTitle><CardDescription>Masukkan kode unik pasangan yang ingin Kamu cari</CardDescription></CardHeader><CardContent><form onSubmit={handleSearchByCode} className="space-y-3"><div className="flex gap-2"><Input placeholder="Contoh: SET123456" value={searchCode} onChange={(e) => setSearchCode(e.target.value.toUpperCase())} disabled={isSearching || isSubscriptionExpired || !data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted} className="font-mono" /><Button type="submit" disabled={isSearching || !searchCode || isSubscriptionExpired || !data?.flags?.profileCompleted || !data?.flags?.psychotestCompleted} className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600">{isSearching ? 'Mencari...' : 'Cari'}</Button></div>{searchError && (<Alert variant="destructive"><AlertDescription>{searchError}</AlertDescription></Alert>)}{searchResult && (<Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200"><CardContent className="pt-3"><div className="flex items-center gap-3"><Avatar className="w-12 h-12 border-2 border-rose-300">{searchResult.avatar ? <AvatarImage src={searchResult.avatar} alt={searchResult.name} /> : null}<AvatarFallback className="bg-rose-500 text-white">{getInitials(searchResult.name)}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><h4 className="font-semibold text-gray-900 truncate">{searchResult.name}</h4><p className="text-xs text-gray-600 truncate">{(() => { const parts = [searchResult.age ? `${searchResult.age} tahun` : null, searchResult.occupation || null, searchResult.city || null].filter(Boolean); return parts.length ? parts.join(' • ') : 'Data belum tersedia' })()}</p></div><div className="text-center flex-shrink-0"><div className="text-lg font-bold text-rose-600">{searchResult.matchPercentage?.toFixed?.(0) ?? '—'}%</div><p className="text-[10px] text-gray-500">Kecocokan</p></div></div><Link href={`/dashboard/matches/${searchResult.matchId}`}><Button className="w-full mt-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600" disabled={isSubscriptionExpired} size="sm"><User className="w-3.5 h-3.5 mr-2" />View Profile<ChevronRight className="w-3.5 h-3.5 ml-2" /></Button></Link></CardContent></Card>)}</form></CardContent></Card>
                 <Card><CardHeader><CardTitle className="text-sm font-medium">Pengingat</CardTitle></CardHeader><CardContent><div className="space-y-3"><div className="flex items-start gap-3"><Clock className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-medium text-gray-900">Lengkapi Profil</p><p className="text-xs text-gray-500">{data?.profile?.fullName ? 'Profil sudah lengkap' : 'Silakan lengkapi biodata Anda'}</p></div></div><div className="flex items-start gap-3"><FileText className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-medium text-gray-900">Psikotes</p><p className="text-xs text-gray-500">{data?.psychotests?.length === 4 ? 'Semua psikotes selesai' : `${data?.psychotests?.length || 0}/4 psikotes selesai`}</p></div></div>{isSubscriptionExpired && (<div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-medium text-gray-900">Subscription Berakhir</p><p className="text-xs text-gray-500">Perbarui untuk akses penuh</p></div></div>)}</div></CardContent></Card>
                 <Card><CardHeader><CardTitle className="text-sm font-medium">Statistik</CardTitle></CardHeader><CardContent><div className="space-y-3"><div className="flex justify-between items-center"><span className="text-sm text-gray-600">Pasangan Direkomendasikan</span><span className="font-semibold">{isReadyForRecommendations ? (data?.matches?.length || 0) : 0}</span></div><div className="flex justify-between items-center"><span className="text-sm text-gray-600">Psikotes Selesai</span><span className="font-semibold">{data?.psychotests?.length || 0}/4</span></div><div className="flex justify-between items-center"><span className="text-sm text-gray-600">Rata-rata Kecocokan</span><span className="font-semibold text-rose-600">{isReadyForRecommendations && data?.matches && data.matches.length > 0 ? (data.matches.reduce((sum, m) => sum + m.matchPercentage, 0) / data.matches.length).toFixed(0) : 0}%</span></div></div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4 text-rose-500" />Hasil Psikotes</CardTitle></CardHeader><CardContent>{data?.psychotests && data.psychotests.length > 0 ? (<div className="space-y-4"><div><h4 className="text-xs font-medium mb-2">Skor per Kategori</h4><ChartContainer config={chartConfig} className="h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.psychotests}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="testType" tickLine={false} tickMargin={6} axisLine={false} tickFormatter={(value) => { const labels: Record<string, string> = { pre_marriage: 'Pra-Nikah', disc: 'DISC', clinical: 'Clinical', '16pf': '16PF' }; return labels[value] || value }} /><YAxis tickLine={false} axisLine={false} tickMargin={6} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="score" radius={[4, 4, 0, 0]}>{data.psychotests.map((_, index) => (<Cell key={`cell-d-${index}`} fill={COLORS[index % COLORS.length]} />))}<LabelList dataKey="score" position="top" /></Bar></BarChart></ResponsiveContainer></ChartContainer></div><div><h4 className="text-xs font-medium mb-2">Distribusi Hasil</h4><ChartContainer className="h-40 w-full" config={{ score: { label: 'Skor', color: 'hsl(var(--chart-1))' } }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.psychotests} cx="50%" cy="50%" innerRadius={36} outerRadius={68} paddingAngle={5} dataKey="score" labelLine={false}>{data.psychotests.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><ChartTooltip content={<ChartTooltipContent />} /></PieChart></ResponsiveContainer></ChartContainer><div className="grid grid-cols-2 gap-2 mt-2">{data.psychotests.map((test, index) => (<div key={test.testType} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div><span className="text-xs text-gray-600">{test.testType === 'pre_marriage' && 'Pra-Nikah'}{test.testType === 'disc' && 'DISC'}{test.testType === 'clinical' && 'Clinical'}{test.testType === '16pf' && '16PF'}</span></div>))}</div></div></div>) : (<div className="text-center py-6"><FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-500 mb-2">Belum ada hasil psikotes</p><Button asChild size="sm" variant="outline" disabled={isSubscriptionExpired}><Link href="/dashboard/psychotest"><FileText className="w-3.5 h-3.5 mr-2" />Mulai Psikotes</Link></Button></div>)}</CardContent></Card>
              </div>
            </aside>
          </div>
        </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold leading-tight">Engine Kecocokan Visual</CardTitle>
                <CardDescription className="text-sm text-gray-500">Simulasi real-time kecocokan berbasis psikotes (lebar penuh).</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
                  disabled={!isReadyForRecommendations || simRunning}
                  onClick={simulateMatch}
                >
                  Simulasi Match
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={simRunning} onClick={() => { setSimScore(null); setSimTarget(null) }}>
                  ↻
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-60 rounded-2xl border bg-rose-50 border-rose-100 overflow-hidden">
              <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <div className="relative w-16 h-16">
                  <svg className="absolute inset-0" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r={ringRadius} stroke={ringBg} strokeWidth="4" fill="none" />
                    <circle cx="32" cy="32" r={ringRadius} stroke={ringColor} strokeWidth="4" fill="none" className="ring-progress" style={{ strokeDasharray: `${ringCircumference}`, strokeDashoffset: ringOffset, transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
                  </svg>
                  <Avatar className="w-14 h-14 shadow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {data?.user.avatar ? <AvatarImage src={data.user.avatar} className="object-cover" /> : null}
                    <AvatarFallback className={`${isUserFemale ? 'bg-gradient-to-br from-rose-500 to-pink-500' : 'bg-gradient-to-br from-indigo-500 to-violet-500'} text-white text-lg`}>{data?.profile?.gender ? (isUserFemale ? <Venus className="w-5 h-5" /> : <Mars className="w-5 h-5" />) : getInitials(data?.user.name || 'U')}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full ${userGenderClasses.bg} border ${userGenderClasses.border} ${userGenderClasses.text} text-[10px] shadow-sm max-w-[10rem] truncate`}>
                    {(() => { const city = data?.profile?.city || '-'; const age = typeof data?.profile?.age === 'number' ? `${data?.profile?.age} thn` : '-'; return `${city} • ${age}` })()}
                  </div>
                </div>
                <div className="text-sm text-gray-600 max-w-[12rem] truncate">{data?.profile?.fullName || data?.user.name || 'User'}</div>
              </div>
              <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-gray-600 max-w-[12rem] truncate">{simTarget?.targetName || 'Calon'}</div>
                </div>
                <div className="relative w-16 h-16">
                  <svg className="absolute inset-0" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r={ringRadius} stroke={ringBg} strokeWidth="4" fill="none" />
                    <circle cx="32" cy="32" r={ringRadius} stroke={ringColor} strokeWidth="4" fill="none" className="ring-progress" style={{ strokeDasharray: `${ringCircumference}`, strokeDashoffset: ringOffset, transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
                  </svg>
                  <Avatar className="w-14 h-14 shadow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {simTarget?.targetAvatar ? <AvatarImage src={simTarget.targetAvatar} className="object-cover" /> : null}
                    <AvatarFallback className={`${isTargetFemale ? 'bg-gradient-to-br from-rose-500 to-pink-500' : 'bg-gradient-to-br from-indigo-500 to-violet-500'} text-white text-lg`}>{simTarget?.targetGender ? (isTargetFemale ? <Venus className="w-5 h-5" /> : <Mars className="w-5 h-5" />) : getFirstLastInitials(simTarget?.targetName || 'C')}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full ${targetGenderClasses.bg} border ${targetGenderClasses.border} ${targetGenderClasses.text} text-[10px] shadow-sm max-w-[10rem] truncate`}>
                    {(() => { const city = simTarget?.targetCity || '-'; const age = typeof simTarget?.targetAge === 'number' ? `${simTarget?.targetAge} thn` : '-'; return `${city} • ${age}` })()}
                  </div>
                </div>
              </div>
              <svg className="absolute inset-0" viewBox="0 0 800 240" preserveAspectRatio="none">
                <path d="M 160 120 C 360 60, 480 180, 640 120" stroke="rgba(244,63,94,0.6)" strokeWidth="4" fill="none" strokeDasharray="10 7" className="dash-path" />
              </svg>
              <div className="absolute left-6 bottom-6 bg-white/80 backdrop-blur rounded-lg px-4 py-2 border border-rose-100">
                <div className="text-xs text-gray-500">Status</div>
                <div className="text-sm font-semibold text-rose-700">
                  {simScore == null ? 'Menunggu simulasi' : (simScore >= 85 ? 'High Compatibility Match!' : simScore >= 60 ? 'Moderate Compatibility' : 'Low Compatibility')}
                </div>
              </div>
              <div className="absolute right-6 bottom-6 bg-white/80 backdrop-blur rounded-lg px-4 py-2 border border-rose-100 text-right">
                <div className="text-xs text-gray-500">Kecocokan</div>
                <div className="text-2xl font-bold text-rose-600">{simScore == null ? '-' : `${Math.round(simScore)}%`}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>

      

      {/* Global Styles for hiding scrollbar */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes dashMove {
          to { stroke-dashoffset: -500; }
        }
        .dash-path {
          animation: dashMove 6s linear infinite;
        }
        .ring-progress {
          transition: stroke-dashoffset .6s ease;
        }
      `}</style>
    </div>
  )
}
