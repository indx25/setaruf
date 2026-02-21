'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { signOut } from 'next-auth/react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { Heart, User, FileText, MessageSquare, LogOut, Edit, XCircle, Filter, AlertTriangle, ChevronRight, Bell, Star, Info, Crown, Brain, HeartHandshake, Instagram } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { io, Socket } from 'socket.io-client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DashboardData {
  user: { id: string; name: string; email: string; avatar?: string; uniqueCode: string; workflowStatus: string }
  flags?: { profileCompleted: boolean; psychotestCompleted: boolean; matchingAvailable: boolean }
  progress?: { profileCompletionPercent: number; psychotestCompletionPercent: number }
  profile: { fullName?: string; age?: number; gender?: string; religion?: string; photoUrl?: string; occupation?: string; city?: string; quote?: string | null } | null
  psychotests: Array<{ testType: string; score: number; result: string }>
  subscription: { planType: string; endDate?: string; isActive: boolean } | null
  matches: Array<any>
  notifications: number
  advertisements: Array<{ id: string; title: string; imageUrl?: string; linkUrl?: string; position: string }>
}

const COLORS = ['#f43f5e', '#ec4899', '#a855f7', '#6366f1']

export default function DashboardPage() {
  const router = useRouter()
  
  // --- State ---
  const [isLoading, setIsLoading] = useState(true)
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ planType: string; startDate: string | null; endDate: string | null; isActive: boolean; isTrial: boolean } | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  const [mobileTab, setMobileTab] = useState<'matches' | 'profile'>('matches')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const [ageMin, setAgeMin] = useState<string>("")
  const [ageMax, setAgeMax] = useState<string>("")
  const [cityQ, setCityQ] = useState<string>("")
  const [minMatch, setMinMatch] = useState<string>("any")
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 60])

  const [dailyQuote, setDailyQuote] = useState<string>('')
  const [uniqueCodeSearch, setUniqueCodeSearch] = useState<string>('')

  const [notifItems, setNotifItems] = useState<Array<any>>([])
  const [isLoadingNotif, setIsLoadingNotif] = useState(false)

  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null)
  const [endDateLabel, setEndDateLabel] = useState<string>("")

  const [matches, setMatches] = useState<any[]>([])
  const [hasNextPage, setHasNextPage] = useState(true)
  const [pageIndex, setPageIndex] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // --- Helpers: dedupe + sort (prioritize incoming profile_request) ---
  const dedupeAndSort = useCallback((items: any[]) => {
    const keyOf = (m: any) => String(m?.targetId || '').trim() || String(m?.targetName || '').trim().toLowerCase()
    const getPriority = (m: any) => (m?.isIncoming && String(m?.matchStep || '').toLowerCase() === 'profile_request') ? 2 : 0
    const byKey = new Map<string, any>()
    for (const it of items) {
      const k = keyOf(it)
      if (!k) continue
      const cur = byKey.get(k)
      if (!cur) {
        byKey.set(k, it)
        continue
      }
      const pIt = getPriority(it)
      const pCur = getPriority(cur)
      if (pIt > pCur) {
        byKey.set(k, it)
      } else if (pIt === pCur) {
        const mIt = Math.round(Number(it?.matchPercentage || 0))
        const mCur = Math.round(Number(cur?.matchPercentage || 0))
        if (mIt > mCur) byKey.set(k, it)
      }
    }
    const arr = Array.from(byKey.values())
    arr.sort((a, b) => {
      const pa = getPriority(a)
      const pb = getPriority(b)
      if (pa !== pb) return pb - pa
      const ma = Number(a?.matchPercentage || 0)
      const mb = Number(b?.matchPercentage || 0)
      return mb - ma
    })
    return arr
  }, [])

  // --- Effects ---
  useEffect(() => { loadDashboardData() }, [])
  useEffect(() => { loadNotifications() }, [])
  useEffect(() => {
    const loadSub = async () => {
      try {
        const r = await fetch('/api/subscription', { cache: 'no-store' })
        const j = await r.json()
        if (r.ok && j?.subscription) setSubscriptionInfo(j.subscription)
      } catch {}
    }
    loadSub()
  }, [])
  useEffect(() => {
    const endDate = subscriptionInfo?.endDate || data?.subscription?.endDate
    if (endDate) {
      const updateCountdown = (e: string) => {
        const diff = new Date(e).getTime() - new Date().getTime()
        if (diff > 0) setTimeLeft({ days: Math.floor(diff / (1000*60*60*24)), hours: Math.floor((diff%(1000*60*60*24))/(1000*60*60)), minutes: Math.floor((diff%(1000*60*60))/(1000*60)) })
        else setTimeLeft(null)
      }
      updateCountdown(endDate)
      const interval = setInterval(() => updateCountdown(endDate), 60000)
      return () => clearInterval(interval)
    } else {
      setTimeLeft(null)
    }
  }, [subscriptionInfo?.endDate, data?.subscription?.endDate])
  useEffect(() => {
    const endDate = subscriptionInfo?.endDate || data?.subscription?.endDate
    if (endDate) setEndDateLabel(new Date(endDate).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}))
    else setEndDateLabel("")
  }, [subscriptionInfo?.endDate, data?.subscription?.endDate])

  useEffect(() => {
    const s = io('/api/realtime', { autoConnect: true })
    s.on('notification', (n: any) => setNotifItems(prev => [n, ...prev]))
    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  const vibrateTap = useCallback(() => {
    try { (navigator as any)?.vibrate?.(10) } catch {}
  }, [])

  // --- Fetch ---
  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      if(res.ok) {
        if(result?.requiresProfileCompletion){ router.push('/dashboard/profile'); return }
        setData(result); setDailyQuote(result?.profile?.quote || '')
      } else if(res.status===401) router.push('/')
      else setLoadError(result?.error || 'Gagal memuat dashboard')
    } catch { setLoadError('Terjadi kesalahan jaringan') }
    finally { setIsLoading(false) }
  }

  const loadNotifications = async () => {
    try { setIsLoadingNotif(true); const res = await fetch('/api/notifications'); const json = await res.json(); if(res.ok && json.notifications) setNotifItems(json.notifications) } finally { setIsLoadingNotif(false) }
  }

  const loadMoreMatches = useCallback(async () => {
    if(!hasNextPage || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pageIndex))
      params.set('limit', String(pageIndex===0 ? 10 : 30))
      if(ageMin) params.set('ageMin', ageMin)
      if(ageMax) params.set('ageMax', ageMax)
      if(cityQ) params.set('city', cityQ)
      params.set('minMatch', minMatch)
      const res = await fetch(`/api/matches?${params.toString()}`)
      const json = await res.json()
      if(res.ok && Array.isArray(json.items)){
        setMatches(prev => dedupeAndSort([...(prev || []), ...json.items]))
        setHasNextPage(json.items.length === 30)
        setPageIndex(prev => prev + 1)
      } else {
        if(json?.error) toast({ title: 'Error', description: json.error })
        setHasNextPage(false)
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan jaringan' })
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasNextPage, isLoadingMore, pageIndex, ageMin, ageMax, cityQ, minMatch])

  // Load incoming requests once on mount and when notifications update
  const loadIncomingRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/matches/incoming')
      const json = await res.json()
      if (res.ok && Array.isArray(json.items)) {
        setMatches(prev => dedupeAndSort([...(json.items || []), ...(prev || [])]))
      }
    } catch {
      // ignore
    }
  }, [dedupeAndSort])

  useEffect(() => {
    loadIncomingRequests()
  }, [loadIncomingRequests, notifItems.length])

  useEffect(() => {
    setMatches([])
    setPageIndex(0)
    setHasNextPage(true)
  }, [ageMin, ageMax, cityQ, minMatch])
  useEffect(() => {
    const minV = ageMin ? Math.max(18, Math.min(80, parseInt(ageMin)||18)) : 18
    const maxV = ageMax ? Math.max(minV, Math.min(80, parseInt(ageMax)||60)) : 60
    setAgeRange([minV, maxV])
  }, [ageMin, ageMax])

  useEffect(() => {
    const el = sentinelRef.current
    if(!el) return
    const ioObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting) loadMoreMatches()
      })
    }, { rootMargin: '300px' })
    ioObs.observe(el)
    return () => ioObs.disconnect()
  }, [loadMoreMatches])

  // --- Helpers ---
  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    const initials = parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('')
    return initials || 'U'
  }
  const getFirstLastInitials = (name?: string | null) => { if(!name) return ''; const parts = name.trim().split(/\s+/); return `${parts[0]?.[0]?.toUpperCase()||''}${(parts.length>1?parts[parts.length-1]?.[0]:parts[0]?.[0])?.toUpperCase()||''}` }
  const normalizeGender = (s?: string | null) => { const t=(s||'').toLowerCase(); if(!t) return null; if(/^(male|pria|laki|cowok|laki-laki)$/i.test(t)) return 'male'; if(/^(female|wanita|perempuan|cewek)$/i.test(t)) return 'female'; return t }
  const normalizeReligion = (s?: string | null) => { const t=(s||'').toLowerCase(); if(!t) return null; if(/^(islam|moslem|muslim)$/i.test(t)) return 'islam'; if(/^(kristen|protestan|christian|protestant)$/i.test(t)) return 'kristen'; if(/^(katolik|catholic)$/i.test(t)) return 'katolik'; return t }

  const saveDailyQuote = async () => {
    if(!dailyQuote.trim()) return
    try {
      const res = await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quote:dailyQuote})})
      if(!res.ok){ alert((await res.json()).error || 'Gagal menyimpan'); return }
      setData(prev=> prev ? {...prev, profile: prev.profile ? {...prev.profile, quote: dailyQuote}: prev.profile} : prev)
      toast({title:'Tersimpan', description:'Quote berhasil disimpan'})
    } catch { alert('Terjadi kesalahan') }
  }
  const searchByUniqueCode = async () => {
    const code = uniqueCodeSearch.trim().toUpperCase()
    if(!code){ toast({ title:'Masukkan kode unik' }); return }
    try {
      const res = await fetch('/api/matches/search-by-code', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uniqueCode: code }) })
      const json = await res.json()
      if(res.ok){
        if(json.requiresConfirmation){
          const ok = confirm(json.message || 'Lanjutkan?')
          if(ok){
            const res2 = await fetch('/api/matches/search-by-code', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uniqueCode: code, confirmDifferentReligion: true }) })
            const j2 = await res2.json()
            if(res2.ok){
              try {
                const r3 = await fetch(`/api/match?targetId=${encodeURIComponent(j2.id)}`, { cache: 'no-store' })
                const j3 = await r3.json()
                if (r3.ok && j3?.match?.id) {
                  router.push(`/dashboard/matches/${j3.match.id}`)
                  return
                }
              } catch {}
              toast({ title:'Berhasil', description:`Kecocokan: ${Math.round(j2.layers?.finalScore || j2.matchPercentage || 0)}%` })
            } else {
              toast({ title:'Gagal', description: j2.error || 'Tidak dapat mencocokkan' })
            }
          }
        } else {
          try {
            const r2 = await fetch(`/api/match?targetId=${encodeURIComponent(json.id)}`, { cache: 'no-store' })
            const j2 = await r2.json()
            if (r2.ok && j2?.match?.id) {
              router.push(`/dashboard/matches/${j2.match.id}`)
              return
            }
          } catch {}
          toast({ title:'Ditemukan', description:`Kecocokan: ${Math.round(json.layers?.finalScore || json.matchPercentage || 0)}%` })
        }
      } else {
        toast({ title:'Gagal', description: json.error || 'Pencarian gagal' })
      }
    } catch {
      toast({ title:'Error', description:'Terjadi kesalahan jaringan' })
    }
  }

  const displayedMatches = useMemo(() => {
    if(!data?.flags?.profileCompleted) return []
    let list = [...(data?.matches || [])].filter(m=>{
      const myGender = normalizeGender(data?.profile?.gender)
      const myReligion = normalizeReligion(data?.profile?.religion)
      return (m.targetAge ?? 0)>=18 && (myGender? m.targetGender!=null?m.targetGender!==myGender:false:true) && (myReligion? m.targetReligion!=null?m.targetReligion===myReligion:false:true)
    })
    const minA = ageMin?parseInt(ageMin):undefined
    const maxA = ageMax?parseInt(ageMax):undefined
    const cityLower = (cityQ||'').toLowerCase()
    const effectiveMinP = minMatch==='any'?0:Math.max(0,parseInt(minMatch))
    return list.filter(m=>{
      const ageVal = m.targetAge
      return (minA===undefined || ageVal==null || ageVal>=minA) && (maxA===undefined || ageVal==null || ageVal<=maxA) && (!cityLower || (m.targetCity||'').toLowerCase().includes(cityLower)) && (m.matchPercentage??0)>=effectiveMinP
    }).sort((a,b)=> (b.matchPercentage??0)-(a.matchPercentage??0)).slice(0,10)
  },[data, ageMin, ageMax, cityQ, minMatch])

  const visibleMatches = useMemo(() => {
    const base = (matches.length ? matches : displayedMatches)
    return pageIndex === 0 ? base.slice(0, 10) : base
  }, [matches, displayedMatches, pageIndex])

  const isSubscriptionExpired = (() => {
    const s: any = subscriptionInfo || data?.subscription
    if (!s) return true
    if (s.endDate) return new Date(s.endDate) < new Date()
    return !s.isActive
  })()
  const isReadyForRecommendations = !!(data?.flags?.profileCompleted && data?.flags?.psychotestCompleted)
  const hasProfile = !!data?.flags?.profileCompleted
  const hasPsychotest = !!data?.flags?.psychotestCompleted
  const mobileAd = (data?.advertisements||[]).find(a=>a.position==='dashboard_middle'||a.position==='dashboard_top')
  const matchStats = useMemo(()=>{
    const ms = data?.matches || []
    const out = { liked:0, rejected:0, blocked:0, chat:0, approved:0, total: ms.length }
    ms.forEach((m:any)=>{
      const s = String(m.matchStatus||'').toLowerCase()
      if(s==='liked') out.liked++
      else if(s==='rejected'||s==='disliked') out.rejected++
      else if(s==='blocked') out.blocked++
      else if(s==='chatting') out.chat++
      else if(s==='approved') out.approved++
    })
    return out
  }, [data?.matches])

  const psychotestChartData = useMemo(() => {
    const labelMap: Record<string, string> = {
      pre_marriage: 'Pra-Nikah',
      disc: 'DISC',
      clinical: 'Clinical',
      '16pf': '16PF'
    }
    return (data?.psychotests || []).map(t => ({
      type: labelMap[t.testType] || t.testType,
      score: Math.round(Math.max(0, Math.min(100, t.score || 0)))
    }))
  }, [data?.psychotests])
  const psychotestOverview = useMemo(() => {
    const req = ['pre_marriage','disc','clinical','16pf'] as const
    const labelMap: Record<string,string> = { pre_marriage:'Pra-Nikah', disc:'DISC', clinical:'Clinical', '16pf':'16PF' }
    const set = new Map((data?.psychotests||[]).map(t=>[t.testType, t]))
    return req.map(key=>{
      const t = set.get(key)
      const score = t ? Math.round(Math.max(0, Math.min(100, t.score || 0))) : 0
      const completed = !!t
      const resultText = t?.result || null
      let color: 'green'|'amber'|'red' = 'red'
      if (score >= 75) color = 'green'
      else if (score >= 60) color = 'amber'
      return { key, label: labelMap[key], score, completed, color, resultText }
    })
  }, [data?.psychotests])

  // --- Components ---
  const MatchCard = ({match, isMobile=false}:{match:any,isMobile?:boolean}) => {
    const canShowPhoto = true
    const canShowContacts = ['approved','chatting'].includes(String(match.matchStatus||'').toLowerCase()) || ['profile_viewed','full_data_approved','chatting'].includes(String(match.matchStep||'').toLowerCase())
    const currentUserName = String((data?.profile?.fullName || data?.user?.name || '')).trim().toLowerCase()
    const targetNameLower = String(match?.targetName || '').trim().toLowerCase()
    const isJamesSpecial = currentUserName === 'james ko' && targetNameLower === 'jenifer love'

    const step = String(match?.matchStep || '').toLowerCase()
    const status = String(match?.matchStatus || '').toLowerCase()
    const isWaitingApproval = step === 'profile_request'
    let stateClass = 'bg-white border'
    if (status === 'rejected' || step === 'rejected') {
      stateClass = 'bg-rose-50 border-rose-200'
    } else if (step === 'mutual_liked') {
      stateClass = 'bg-pink-50 border-pink-200'
    } else if (match?.isIncoming && step === 'profile_request') {
      stateClass = 'bg-emerald-50 border-emerald-200'
    } else if (step === 'profile_request') {
      stateClass = 'bg-amber-50 border-amber-200'
    }
    return (
      <Card className={`relative overflow-hidden rounded-2xl ${isMobile?'shadow-sm active:scale-[0.98]':'hover:shadow-md'} transition-all duration-200 ${stateClass}`}>
        <CardContent className="p-0">
          <div className="p-3 flex items-center gap-3">
            <Avatar className={`${isMobile?'w-14 h-14':'w-16 h-16'} flex-shrink-0 ring-1 ring-gray-200`}>
              {canShowPhoto && match.targetAvatar?<AvatarImage src={match.targetAvatar}/>:<AvatarFallback className="bg-gradient-to-br from-rose-100 to-pink-100 text-rose-600 text-sm font-bold">{getFirstLastInitials(match.targetName)}</AvatarFallback>}
            </Avatar>
            <div className="flex-1 min-w-0">
              {isWaitingApproval && !match.isIncoming && (
                <div className="mb-1">
                  <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-[10px]">Menunggu Approval</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h4 className={`font-bold text-gray-900 truncate ${isMobile?'text-sm':'text-base'}`}>{match.targetName}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {canShowContacts && match.targetWhatsapp ? (
                      <a
                        href={`https://wa.me/${(match.targetWhatsapp || '').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp"
                        title="WhatsApp"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                      >
                        <svg viewBox="0 0 32 32" className="w-4 h-4 text-emerald-600 fill-current" aria-hidden="true">
                          <path d="M19.11 17.47c-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.62.13-.18.27-.71.88-.87 1.06-.16.18-.32.2-.59.07-.27-.13-1.12-.41-2.13-1.31-.79-.7-1.32-1.57-1.48-1.84-.16-.27-.02-.41.12-.54.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.46h-.53c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29s.99 2.66 1.12 2.84c.14.18 1.95 2.98 4.73 4.17.66.28 1.18.45 1.58.57.66.21 1.27.18 1.75.11.53-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.31zM16 5.33a10.64 10.64 0 0 0-9.22 15.89L5 27l5.9-1.73A10.64 10.64 0 1 0 16 5.33zm6.26 16.9A8.89 8.89 0 1 1 24.89 16a8.86 8.86 0 0 1-2.63 6.23z"/>
                        </svg>
                      </a>
                    ) : (
                      <span
                        aria-label="WhatsApp"
                        title="Tersedia setelah disetujui"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                      >
                        <svg viewBox="0 0 32 32" className="w-4 h-4 fill-current" aria-hidden="true">
                          <path d="M19.11 17.47c-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.62.13-.18.27-.71.88-.87 1.06-.16.18-.32.2-.59.07-.27-.13-1.12-.41-2.13-1.31-.79-.7-1.32-1.57-1.48-1.84-.16-.27-.02-.41.12-.54.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.46h-.53c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29s.99 2.66 1.12 2.84c.14.18 1.95 2.98 4.73 4.17.66.28 1.18.45 1.58.57.66.21 1.27.18 1.75.11.53-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.31zM16 5.33a10.64 10.64 0 0 0-9.22 15.89L5 27l5.9-1.73A10.64 10.64 0 1 0 16 5.33zm6.26 16.9A8.89 8.89 0 1 1 24.89 16a8.86 8.86 0 0 1-2.63 6.23z"/>
                        </svg>
                      </span>
                    )}
                    {canShowContacts && match.targetInstagram ? (
                      <a
                        href={`https://instagram.com/${String(match.targetInstagram || '').replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        title="Instagram"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-50 hover:bg-pink-100 border border-pink-200"
                      >
                        <Instagram className="w-4 h-4 text-pink-600" />
                      </a>
                    ) : (
                      <span
                        aria-label="Instagram"
                        title="Tersedia setelah disetujui"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                      >
                        <Instagram className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-bold ${match.matchPercentage>=80?'text-green-600':'text-rose-500'} ${isMobile?'text-sm':'text-lg'}`}>{Math.round(match.matchPercentage)}%</span>
                    {!isMobile && <span className="text-[10px] text-gray-400">Match</span>}
                  </div>
                </div>
              </div>
              {match.isIncoming && match.matchStep==='profile_request' && (
                <div className="mt-1 inline-flex items-center gap-1 text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-1 text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  <span>{match.targetName} meminta melihat profil kamu</span>
                </div>
              )}
              {String(match.matchStatus||'').toLowerCase()==='rejected' && (
                <div className="mt-1 inline-flex items-center gap-1 text-rose-700 bg-rose-100 border border-rose-200 rounded px-2 py-1 text-[11px]">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{match.isIncoming ? `Kamu menolak permintaan dari ${match.targetName}` : `Maaf ${match.targetName} menolak permintaan kamu`}</span>
                </div>
              )}
              <p className={`text-gray-500 truncate mt-0.5 ${isMobile?'text-xs':'text-sm'}`}>{[match.targetAge, match.targetOccupation, match.targetCity].filter(Boolean).join(' • ')}</p>
              {match.targetQuote && <p className={`text-gray-600 italic line-clamp-1 mt-1 ${isMobile?'text-[10px]':'text-xs'}`}>“{match.targetQuote}”</p>}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">Kecocokan</span>
                  <div className="flex items-center gap-1">
                    {!!(match.aiReasons && match.aiReasons.length) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs max-w-[220px]">
                              {match.aiReasons.slice(0,5).map((r:string,idx:number)=>(<div key={idx} className="mb-0.5">• {r}</div>))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${Math.max(0, Math.min(100, Math.round(match.matchPercentage||0))) }%` }} />
                </div>
                <div className="mt-2 text-[11px] text-gray-700">
                  {match.aiInsight}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${String(match.divorceRiskLevel || 'low').toLowerCase()==='high'?'text-rose-600 border-rose-200':String(match.divorceRiskLevel || 'low').toLowerCase()==='moderate'?'text-amber-600 border-amber-200':'text-emerald-600 border-emerald-200'} text-[10px]`}
                  >
                    Risiko: {match.divorceRiskLevel || 'Low'}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600 border-blue-200 text-[10px]">
                    Stabilitas: {typeof match.marriageStability === 'number' ? match.marriageStability : 0}%
                  </Badge>
                </div>
                
              </div>
            </div>
          </div>
          <div className="px-3 pb-3 flex gap-2">
            {match.isIncoming && match.matchStep==='profile_request' ? (
              <>
                <Button
                  className={`${isMobile?'h-8 text-xs':'h-8 text-xs'} bg-emerald-500 hover:bg-emerald-600 text-white flex-1`}
                  onClick={async ()=>{
                    const res = await fetch(`/api/matches/${match.id}/approve`, { method:'POST' })
                    if(res.ok){
                      toast({title:'Disetujui'})
                      setMatches(prev=>prev.map((m:any)=>m.id===match.id?{...m, matchStatus:'approved', matchStep:'profile_viewed'}:m))
                      setData(prev=>prev?{...prev, matches:(prev.matches||[]).map((m:any)=>m.id===match.id?{...m, matchStatus:'approved', matchStep:'profile_viewed'}:m)}:prev)
                    } else {
                      try { const j = await res.json(); toast({title:'Error', description:j.error||'Gagal'}) } catch { toast({title:'Error'}) }
                    }
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className={`${isMobile?'h-8 text-xs':'h-8 text-xs'} text-rose-600 border-rose-200 flex-1`}
                  onClick={async ()=>{
                    const res = await fetch(`/api/matches/${match.id}/reject`, { method:'POST' })
                    if(res.ok){
                      toast({title:'Ditolak'})
                      setMatches(prev=>prev.map((m:any)=>m.id===match.id?{...m, matchStatus:'rejected', matchStep:'rejected', isIncoming:true}:m))
                      setData(prev=>prev?{...prev, matches:(prev.matches||[]).map((m:any)=>m.id===match.id?{...m, matchStatus:'rejected', matchStep:'rejected', isIncoming:true}:m)}:prev)
                    } else {
                      try { const j = await res.json(); toast({title:'Error', description:j.error||'Gagal'}) } catch { toast({title:'Error'}) }
                    }
                  }}
                >
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button
                  className={`flex-1 ${isMobile?'h-8 text-xs':'h-8 text-xs'} ${isWaitingApproval ? 'bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white shadow-[inset_0_1px_rgba(255,255,255,0.6)]' : 'bg-black hover:bg-gray-900 text-white'}`}
                  onClick={async ()=>{
                    vibrateTap()
                    if (match?.matchStep === 'profile_request') {
                      toast({ title: 'Permintaan sudah dikirim' })
                      return
                    }
                    const res = await fetch(`/api/matches/${match.id}/request`, { method:'POST' })
                    if(res.ok){
                      toast({title:'Permintaan dikirim'})
                      setMatches(prev=>prev.map((m:any)=>m.id===match.id?{...m, matchStep:'profile_request'}:m))
                      setData(prev=>prev?{...prev, matches:(prev.matches||[]).map((m:any)=>m.id===match.id?{...m, matchStep:'profile_request'}:m)}:prev)
                    } else {
                      try { const j = await res.json(); toast({title:'Error', description:j.error||'Gagal'}) } catch { toast({title:'Error'}) }
                    }
                  }}
                >
                  {isWaitingApproval ? 'Menunggu Approval' : 'Request View'}
                </Button>
              </>
            )}
          </div>
          <div className="px-3 pb-3 flex gap-2">
            {/* No extra buttons for incoming request; handled in the main row */}
            {(match.matchStep==='chatting' || match.matchStep==='full_data_approved') && (
              <Link href="/dashboard/messages" className="flex-1">
                <Button className="w-full h-8 text-xs">Chat</Button>
              </Link>
            )}
          </div>
          {/* Removed Setujui (approve) and Blokir per request */}
          {match.matchStep==='profile_viewed' && (
            <div className="px-3 pb-3 flex gap-2">
              <Button
                variant="outline"
                className={`${isMobile?'h-8 text-xs':'h-8 text-xs'}`}
                onClick={async ()=>{
                  const res = await fetch(`/api/matches/${match.id}/approve-photo`, { method:'POST' })
                  if(res.ok){
                    toast({title:'Akses foto disetujui'})
                    setMatches(prev=>prev.map((m:any)=>m.id===match.id?{...m, matchStep:'photo_approved'}:m))
                    setData(prev=>prev?{...prev, matches:(prev.matches||[]).map((m:any)=>m.id===match.id?{...m, matchStep:'photo_approved'}:m)}:prev)
                  } else {
                    try { const j = await res.json(); toast({title:'Error', description:j.error||'Gagal'}) } catch { toast({title:'Error'}) }
                  }
                }}
              >
                Setujui Foto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if(isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-rose-500 animate-pulse">Memuat Dashboard...</div></div>
  if(loadError) return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50"><Alert variant="destructive">{loadError}</Alert></div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* MOBILE VIEW */}
      <div className="md:hidden min-h-screen flex flex-col">
        {/* Header + Tabs */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="bg-rose-500 p-1.5 rounded-lg"><Heart className="w-4 h-4 text-white"/></div><span className="font-bold text-lg bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">Setaruf</span></div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-full hover:bg-gray-100" aria-label="Notifikasi">
                    <Bell className="w-5 h-5 text-gray-600" />
                    {(data?.notifications ?? 0) > 0 && <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">{data?.notifications}</span>}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {notifItems.length ? (
                    <>
                      {notifItems.slice(0,8).map((n:any, idx:number)=>(
                        <DropdownMenuItem key={idx} onClick={()=>{ if(n.link) window.location.href=n.link }}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{n.title || 'Notifikasi'}</span>
                            <span className="text-xs text-gray-500">{n.message || ''}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-sm text-gray-500">Tidak ada notifikasi</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button onClick={()=>setShowMobileFilters(true)} className="p-2 rounded-full hover:bg-gray-100 relative"><Filter className="w-5 h-5 text-gray-600"/>{(ageMin||ageMax||cityQ)&&<span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}</button>
              <DropdownMenu><DropdownMenuTrigger asChild><Avatar className="w-8 h-8 cursor-pointer">{data?.user?.avatar?<AvatarImage src={data?.user?.avatar}/>:<AvatarFallback>{getInitials(data?.profile?.fullName || data?.user?.name)}</AvatarFallback>}</Avatar></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={()=>signOut({callbackUrl:'/'})} className="text-red-600"><LogOut className="w-4 h-4 mr-2"/>Logout</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <button onClick={()=>signOut({callbackUrl:'/'})} className="p-2 rounded-full hover:bg-gray-100" aria-label="Logout">
                  <LogOut className="w-5 h-5 text-gray-600" />
                </button>
              </TooltipTrigger><TooltipContent>Logout</TooltipContent></Tooltip></TooltipProvider>
            </div>
          </div>
          <div className="px-3 pb-3">
            <div className="bg-gray-100 rounded-full p-1 flex gap-1">
              <button
                onClick={()=>{vibrateTap(); setMobileTab('matches')}}
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${mobileTab==='matches'?'bg-white shadow text-rose-600':'text-gray-600'}`}
              >
                Cari Jodoh
              </button>
              <button
                onClick={()=>{vibrateTap(); setMobileTab('profile')}}
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${mobileTab==='profile'?'bg-white shadow text-rose-600':'text-gray-600'}`}
              >
                Profil & Analisa
              </button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-gray-50 relative" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 72px)' }}>
          {mobileTab==='matches' && (
            <div className="space-y-3 p-4">
              {!isReadyForRecommendations? <Alert className="bg-rose-50 border-rose-200"><AlertTriangle className="h-4 w-4 text-rose-600"/><AlertDescription className="text-xs">Lengkapi profil & psikotes dulu.</AlertDescription></Alert>:
              visibleMatches.map(m=><MatchCard key={m.id} match={m} isMobile/>)}
              {visibleMatches.length===0 && isReadyForRecommendations && <div className="text-center py-10 opacity-60"><Heart className="w-12 h-12 mx-auto mb-2 text-rose-300"/><p className="text-sm">Belum ada kandidat.</p><p className="text-xs">Coba sesuaikan filter.</p></div>}
              <div ref={sentinelRef}></div>
              {isLoadingMore && <div className="text-center text-xs text-gray-500 py-4">Memuat...</div>}
            </div>
          )}
          {mobileTab==='profile' && (
            <div className="space-y-4 p-4">
              <Card><CardContent className="p-4 flex flex-col items-center text-center">
                <Avatar className="w-20 h-20 mb-2">{data?.profile?.photoUrl?<AvatarImage src={data?.profile?.photoUrl}/>:<AvatarFallback className="bg-rose-500 text-white text-xl">{getInitials(data?.profile?.fullName || data?.user?.name || 'U')}</AvatarFallback>}</Avatar>
                <h2 className="font-bold text-lg">{data?.profile?.fullName || data?.user?.name || 'User'}</h2>
                <p className="text-xs text-gray-500 mb-3">{[data?.profile?.age,data?.profile?.occupation,data?.profile?.city].filter(Boolean).join(' • ')}</p>
                <div className="flex gap-2 w-full">
                  <Link href="/dashboard/profile" className="flex-1"><Button onClick={vibrateTap} variant="outline" size="sm" className="w-full"><Edit className="w-3 h-3 mr-1"/>Edit</Button></Link>
                  <Link href="/dashboard/psychotest" className="flex-1"><Button onClick={vibrateTap} variant={hasPsychotest?'outline':'default'} size="sm" className={`w-full ${!hasPsychotest?'bg-red-500 hover:bg-red-600':''}`}><FileText className="w-3 h-3 mr-1"/>Tes</Button></Link>
                </div>
                <div className="mt-4 w-full bg-rose-50 p-2 rounded text-left">
                  <p className="text-[10px] text-gray-500 mb-1">Kode Unik</p>
                  <div className="flex justify-between items-center"><span className="font-mono font-bold">{data?.user?.uniqueCode || '-'}</span><button onClick={()=>{vibrateTap(); navigator.clipboard.writeText(data?.user?.uniqueCode || '');toast({title:'Tersalin'})}} className="text-xs bg-white border px-2 py-0.5 rounded hover:bg-gray-50">Copy</button></div>
                </div>
              </CardContent></Card>

              {/* Ringkasan cepat seperti iOS widgets */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-300 bg-white shadow-[0_0_0_2px_rgba(16,185,129,0.15)]">
                  <Heart className="w-4 h-4 text-emerald-600 mb-1" />
                  <div className="text-[10px] text-gray-600">Disukai</div>
                  <div className="text-sm font-semibold text-emerald-600">{matchStats.liked}</div>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-300 bg-white shadow-[0_0_0_2px_rgba(245,158,11,0.2)]">
                  <Star className="w-4 h-4 text-amber-500 mb-1" />
                  <div className="text-[10px] text-gray-600">Disarankan</div>
                  <div className="text-sm font-semibold">{Math.max(0, matchStats.total - (matchStats.rejected + matchStats.blocked))}</div>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-rose-300 bg-white shadow-[0_0_0_2px_rgba(244,63,94,0.2)]">
                  <XCircle className="w-4 h-4 text-rose-600 mb-1" />
                  <div className="text-[10px] text-gray-600">Ditolak</div>
                  <div className="text-sm font-semibold text-rose-600">{matchStats.rejected}</div>
                </div>
              </div>

              {/* Hasil Psikotes (mirror desktop) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Hasil Psikotes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {psychotestOverview.map(row=>(
                    <div key={row.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <span>{row.label}</span>
                            {row.resultText && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-gray-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-[220px] text-xs">{row.resultText}</div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                          {row.completed ? <Badge variant="outline" className="text-emerald-600 border-emerald-200">Selesai</Badge> : <Badge variant="outline" className="text-amber-600 border-amber-200">Belum</Badge>}
                        </span>
                        <span>{row.score}%</span>
                      </div>
                      <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
                        <div className={`h-full ${row.color==='green'?'bg-emerald-500':row.color==='amber'?'bg-amber-500':'bg-rose-500'}`} style={{ width: `${row.score}%` }}/>
                      </div>
                    </div>
                  ))}
                  {!psychotestOverview.length && (
                    <div className="text-xs text-gray-500">Belum ada data psikotes.</div>
                  )}
                </CardContent>
              </Card>
              {data?.subscription && (
                <Card><CardContent className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">{timeLeft?`${timeLeft.days} hari ${timeLeft.hours} jam tersisa`:isSubscriptionExpired?'Berakhir':'Aktif hingga '+endDateLabel}</p>
                  </div>
                  <Button size="sm" variant="outline">Perpanjang</Button>
                </CardContent></Card>
              )}
            </div>
          )}

          {/* Mobile Filter Modal */}
          {showMobileFilters && (
            <div className="fixed inset-0 z-50" onClick={()=>{vibrateTap(); setShowMobileFilters(false)}}>
              <div className="absolute inset-0 bg-black/50"></div>
              <div
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 space-y-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}
                onClick={(e)=>e.stopPropagation()}
              >
                <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mb-2"></div>
                <h3 className="font-bold text-sm mb-1 text-center">Filter</h3>
                <Input placeholder="Kota" value={cityQ} onChange={e=>setCityQ(e.target.value)} />
                <div className="flex gap-2">
                  <Input placeholder="Umur Min" value={ageMin} onChange={e=>setAgeMin(e.target.value)} />
                  <Input placeholder="Umur Max" value={ageMax} onChange={e=>setAgeMax(e.target.value)} />
                </div>
                <Input placeholder="Match min %" value={minMatch} onChange={e=>setMinMatch(e.target.value)} />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={()=>{vibrateTap(); setShowMobileFilters(false)}}>Batal</Button>
                  <Button size="sm" className="flex-1" onClick={()=>{vibrateTap(); setShowMobileFilters(false)}}>Terapkan</Button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Tab Bar (iOS-like) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-t">
          <div className="h-[56px] flex items-center justify-around px-8" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <button
              aria-current={mobileTab==='matches'}
              onClick={()=>{vibrateTap(); setMobileTab('matches')}}
              className={`flex flex-col items-center justify-center gap-0.5 ${mobileTab==='matches'?'text-rose-600':'text-gray-500'}`}
            >
              <Heart className="w-5 h-5" />
              <span className="text-[11px]">Match</span>
            </button>
            <button
              aria-current={mobileTab==='profile'}
              onClick={()=>{vibrateTap(); setMobileTab('profile')}}
              className={`flex flex-col items-center justify-center gap-0.5 ${mobileTab==='profile'?'text-rose-600':'text-gray-500'}`}
            >
              <User className="w-5 h-5" />
              <span className="text-[11px]">Profil</span>
            </button>
          </div>
        </nav>
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:flex min-h-screen">
        <aside className="w-80 bg-white border-r p-4 space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-12 h-12">{data?.user?.avatar?<AvatarImage src={data?.user?.avatar}/>:<AvatarFallback>{getInitials(data?.profile?.fullName || data?.user?.name || 'U')}</AvatarFallback>}</Avatar>
            <div className="flex-1">
              <h4 className="font-bold truncate">{data?.profile?.fullName || data?.user?.name || 'User'}</h4>
              <p className="text-xs text-gray-500">
                { [data?.profile?.city || '-', (typeof data?.profile?.age === 'number' ? `${data?.profile?.age} th` : null)]
                  .filter(Boolean)
                  .join(' • ') }
              </p>
              <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
                <span>Kode: <span className="font-semibold">{data?.user?.uniqueCode || '-'}</span></span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2"
                  onClick={() => {
                    const code = data?.user?.uniqueCode || ''
                    if (code) {
                      navigator.clipboard.writeText(code)
                      toast({ title: 'Tersalin', description: 'Kode unik disalin ke clipboard' })
                    } else {
                      toast({ title: 'Tidak ada kode', description: 'Kode unik belum tersedia' })
                    }
                  }}
                >
                  Salin
                </Button>
              </div>
            </div>
          </div>
          
          <div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center p-2 rounded-lg border border-emerald-300 bg-white shadow-[0_0_0_2px_rgba(16,185,129,0.15)]">
                <Heart className="w-4 h-4 text-emerald-600 mb-1" />
                <div className="text-[10px] text-gray-600">Disukai</div>
                <div className="text-sm font-semibold text-emerald-600">{matchStats.liked}</div>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-lg border border-amber-300 bg-white shadow-[0_0_0_2px_rgba(245,158,11,0.2)]">
                <Star className="w-4 h-4 text-amber-500 mb-1" />
                <div className="text-[10px] text-gray-600">Disarankan</div>
                <div className="text-sm font-semibold">{Math.max(0, matchStats.total - (matchStats.rejected + matchStats.blocked))}</div>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-lg border border-rose-300 bg-white shadow-[0_0_0_2px_rgba(244,63,94,0.2)]">
                <XCircle className="w-4 h-4 text-rose-600 mb-1" />
                <div className="text-[10px] text-gray-600">Ditolak</div>
                <div className="text-sm font-semibold text-rose-600">{matchStats.rejected}</div>
              </div>
            </div>
            <Card className="mt-3">
              <CardHeader>
                <CardTitle className="text-sm">Langganan</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  {(subscriptionInfo?.isTrial) && <Badge variant="outline" className="text-amber-600 border-amber-200 text-[10px] mb-1">Trial</Badge>}
                  <div className={`font-semibold text-sm ${isSubscriptionExpired?'text-rose-600':'text-emerald-600'}`}>{isSubscriptionExpired?'Berakhir':'Aktif'}</div>
                  {(() => {
                    const endDate = subscriptionInfo?.endDate || data?.subscription?.endDate
                    if (!endDate) return null
                    return (
                      <div className="text-[11px] text-gray-500">
                        {isSubscriptionExpired ? 'Selesai: ' : 'Berakhir: '}
                        {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )
                  })()}
                  {!isSubscriptionExpired && timeLeft && (
                    <div className="text-[11px] text-gray-500">Sisa: {timeLeft.days} hari {timeLeft.hours} jam</div>
                  )}
                </div>
                <Link href="/pricing"><Button size="sm" variant="outline">Perpanjang</Button></Link>
              </CardContent>
            </Card>
          </div>
          {/* Nav dipindah ke topbar */}
          
          <Card>
            <CardContent className="space-y-2">
              <Input value={uniqueCodeSearch} onChange={e=>setUniqueCodeSearch(e.target.value)} placeholder="Masukkan kode unik calon" />
              <Button onClick={searchByUniqueCode} className="w-full">Cocokkan</Button>
              <div className="text-[11px] text-gray-500">Fitur khusus Premium • Mengirim permintaan ta'aruf</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status Taaruf</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Profil</span>
                <Badge variant="outline" className={`${hasProfile?'text-emerald-600 border-emerald-200':'text-amber-600 border-amber-200'} text-[10px]`}>{hasProfile?'Selesai':'Lengkapi'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Psikotes</span>
                <Badge variant="outline" className={`${hasPsychotest?'text-emerald-600 border-emerald-200':'text-amber-600 border-amber-200'} text-[10px]`}>{hasPsychotest?'Selesai':'Lengkapi'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Cari Jodoh</span>
                <Badge variant="outline" className="text-blue-600 border-blue-200 text-[10px]">{data?.flags?.matchingAvailable?'Aktif':'Menunggu'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Ta'aruf</span>
                <Badge variant="outline" className="text-purple-600 border-purple-200 text-[10px]">{(data?.matches||[]).some((m:any)=>m.matchStatus==='chatting')?'Berjalan':'-'}</Badge>
              </div>
            </CardContent>
          </Card>
          
        </aside>
        <main className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="font-bold text-xl text-gray-900">Rekomendasi Match</h1>
              <nav className="hidden md:flex items-center gap-1">
                <Link href="/dashboard" className="px-3 py-1.5 rounded hover:bg-gray-100 text-sm flex items-center gap-1.5" aria-label="Cari Jodoh">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Cari Jodoh</span>
                </Link>
                <Link href="/dashboard/profile" className="px-3 py-1.5 rounded hover:bg-gray-100 text-sm flex items-center gap-1.5" aria-label="Profil">
                  <User className="w-4 h-4 text-rose-500" />
                  <span>Profil</span>
                </Link>
                <Link href="/dashboard/psychotest" className="px-3 py-1.5 rounded hover:bg-gray-100 text-sm flex items-center gap-1.5" aria-label="Psikotes">
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Psikotes</span>
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-full hover:bg-gray-100" aria-label="Notifikasi">
                    <Bell className="w-5 h-5 text-gray-600" />
                    {(data?.notifications ?? 0) > 0 && <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">{data?.notifications}</span>}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {notifItems.length ? (
                    <>
                      {notifItems.slice(0,10).map((n:any, idx:number)=>(
                        <DropdownMenuItem key={idx} onClick={()=>{ if(n.link) window.location.href=n.link }}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{n.title || 'Notifikasi'}</span>
                            <span className="text-xs text-gray-500">{n.message || ''}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-sm text-gray-500">Tidak ada notifikasi</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <button onClick={()=>signOut({callbackUrl:'/'})} className="p-2 rounded-full hover:bg-gray-100" aria-label="Logout">
                  <LogOut className="w-5 h-5 text-gray-600" />
                </button>
              </TooltipTrigger><TooltipContent>Logout</TooltipContent></Tooltip></TooltipProvider>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Filter Rekomendasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-3 lg:items-end">
                <div className="lg:col-span-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                      <span>Match min</span>
                      <span>{minMatch==='any'?'Semua':`${minMatch}%`}</span>
                    </div>
                    <Slider
                      defaultValue={[minMatch==='any'?0:Math.min(100,Math.max(0,parseInt(minMatch)||0))]}
                      onValueChange={([v])=>setMinMatch(String(v))}
                      max={100}
                      step={5}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                      <span>Usia</span>
                      <span>{ageRange[0]} - {ageRange[1]}</span>
                    </div>
                    <Slider
                      value={ageRange}
                      onValueChange={(v)=>{ const [a,b]=v as [number,number]; setAgeRange([a,b]); setAgeMin(String(a)); setAgeMax(String(b)); }}
                      max={80}
                      min={18}
                      step={1}
                    />
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <Input placeholder="Umur Min" value={ageMin} onChange={e=>setAgeMin(e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <Input placeholder="Umur Max" value={ageMax} onChange={e=>setAgeMax(e.target.value)} />
                </div>
                <div className="lg:col-span-3">
                  <Input placeholder="Kota" value={cityQ} onChange={e=>setCityQ(e.target.value)} />
                </div>
                <div className="lg:col-span-1 flex lg:justify-end">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="inline-flex items-center justify-center w-10 h-10 rounded-full border bg-white hover:bg-gray-50"
                          aria-label="Terapkan Filter"
                        >
                          <Filter className="w-4 h-4 text-gray-700" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Terapkan</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {visibleMatches.map(m=><MatchCard key={m.id} match={m}/>)}
            {visibleMatches.length===0 && <div className="col-span-1 text-center py-10 text-gray-400">Belum ada kandidat. Coba sesuaikan filter.</div>}
          </div>
          {hasNextPage && <div className="flex justify-center"><Button variant="outline" disabled={isLoadingMore} onClick={loadMoreMatches}>{isLoadingMore?'Memuat...':'Muat Lebih Banyak'}</Button></div>}
          
        </main>
        <aside className="w-80 bg-white border-l p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hasil Psikotes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {psychotestOverview.map(row=>(
                <div key={row.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span>{row.label}</span>
                        {row.resultText && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-gray-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-[220px] text-xs">{row.resultText}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </span>
                      {row.completed ? <Badge variant="outline" className="text-emerald-600 border-emerald-200">Selesai</Badge> : <Badge variant="outline" className="text-amber-600 border-amber-200">Belum</Badge>}
                    </span>
                    <span>{row.score}%</span>
                  </div>
                  <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${row.color==='green'?'bg-emerald-500':row.color==='amber'?'bg-amber-500':'bg-rose-500'}`}
                      style={{ width: `${row.score}%` }}
                    />
                  </div>
                </div>
              ))}
              {!psychotestOverview.length && (
                <div className="text-xs text-gray-500">Belum ada data psikotes.</div>
              )}
              <div className="text-[11px] text-gray-500">
                Progress: {data?.progress?.psychotestCompletionPercent ?? 0}% • Lengkap {data?.progress?.psychotestCompletedCount ?? 0}/{data?.progress?.psychotestRequiredCount ?? 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Skor Psikotes (Grafik)</CardTitle>
            </CardHeader>
            <CardContent>
              {psychotestChartData.length ? (
                <div className="grid grid-cols-2 gap-4">
                  {psychotestChartData.map((d, idx) => (
                    <div key={d.type} className="flex flex-col items-center">
                      <div className="w-28 h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart
                            innerRadius="70%"
                            outerRadius="100%"
                            data={[{ name: d.type, value: d.score, fill: COLORS[idx % COLORS.length] }]}
                            startAngle={90}
                            endAngle={450}
                          >
                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar
                              dataKey="value"
                              cornerRadius={10}
                              background={{ fill: '#e5e7eb' }}
                              clockWise
                            />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">{d.type}</div>
                      <div className="text-sm font-semibold">{d.score}%</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">Belum ada data psikotes.</div>
              )}
            </CardContent>
          </Card>
          
          
        </aside>
      </div>
    </div>
  )
}
