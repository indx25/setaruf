'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  RotateCcw
} from 'lucide-react'

interface DashboardData {
  user: {
    id: string
    name: string
    email: string
    avatar?: string
    uniqueCode: string
    workflowStatus: string
  }
  profile: {
    initials?: string
    fullName?: string
    age?: number
    occupation?: string
    city?: string
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
    targetInitials?: string
    targetAvatar?: string
    targetAge?: number
    targetOccupation?: string
    targetCity?: string
    matchPercentage: number
  }>
  notifications: number
  advertisements: Array<{
    id: string
    title: string
    imageUrl?: string
    linkUrl?: string
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

  useEffect(() => {
    loadDashboardData()
  }, [])

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
    return workflowSteps.findIndex(step => step.key === data.user.workflowStatus)
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
              <button className="relative p-2 text-gray-600 hover:text-rose-600 transition-colors">
                <Bell className="w-5 h-5" />
                {data?.notifications > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                )}
              </button>

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
                  <DropdownMenuItem className="text-red-600 cursor-pointer">
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
                  <div className="flex justify-between text-sm items-center">
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
                        Uji
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation Menu */}
              <Card>
                <CardContent className="p-2">
                  <nav className="space-y-1">
                    <Link href="/dashboard">
                      <Button variant="ghost" className="w-full justify-start bg-rose-50 text-rose-600 hover:bg-rose-100">
                        <Home className="w-4 h-4 mr-2" />
                        Home
                      </Button>
                    </Link>
                    <Link href="/dashboard/profile">
                      <Button variant="ghost" className="w-full justify-start text-gray-600 hover:bg-gray-100">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Button>
                    </Link>
                    <Link href="/dashboard/psychotest">
                      <Button variant="ghost" className="w-full justify-start text-gray-600 hover:bg-gray-100">
                        <FileText className="w-4 h-4 mr-2" />
                        Psikotes
                      </Button>
                    </Link>
                    <Link href="/dashboard/messages">
                      <Button variant="ghost" className="w-full justify-start text-gray-600 hover:bg-gray-100">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Messages
                      </Button>
                    </Link>
                    <Link href="/dashboard/subscription">
                      <Button variant="ghost" className="w-full justify-start text-gray-600 hover:bg-gray-100">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Subscription
                      </Button>
                    </Link>
                    <Link href="/dashboard/settings">
                      <Button variant="ghost" className="w-full justify-start text-gray-600 hover:bg-gray-100">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                    </Link>
                  </nav>
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
                    <p className="text-gray-600">Mulai perjalanan taaruf Anda hari ini</p>
                  </div>
                  <div className="hidden sm:block">
                    <Heart className="w-12 h-12 text-rose-500 opacity-20" />
                  </div>
                </div>
              </CardContent>
            </Card>

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

            {/* Advertisement 1 - Top */}
            {data?.advertisements?.[0] && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative h-40 bg-gradient-to-r from-rose-100 to-pink-100 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-rose-600 font-medium mb-2">IKLAN SPONSOR</p>
                      <h3 className="text-lg font-bold text-gray-900">{data.advertisements[0].title}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unique Code Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-rose-500" />
                  Cari Pasangan dengan Kode Unik
                </CardTitle>
                <CardDescription>
                  Masukkan kode unik pasangan yang ingin Anda cari
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearchByCode} className="space-y-4">
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
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-16 h-16 border-2 border-rose-300">
                            {searchResult.avatar ? (
                              <AvatarImage src={searchResult.avatar} alt={searchResult.name} />
                            ) : null}
                            <AvatarFallback className="bg-rose-500 text-white text-xl">
                              {searchResult.initials || getInitials(searchResult.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{searchResult.name}</h4>
                            <p className="text-sm text-gray-600">
                              {searchResult.age ? `${searchResult.age} tahun` : ''} • {searchResult.occupation || '-'}
                            </p>
                            <p className="text-sm text-gray-600">{searchResult.city || '-'}</p>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-rose-600">
                              {searchResult.matchPercentage || 0}%
                            </div>
                            <p className="text-xs text-gray-500">Kecocokan</p>
                          </div>
                        </div>
                        <Button
                          className="w-full mt-4 bg-rose-500 hover:bg-rose-600"
                          disabled={isSubscriptionExpired}
                        >
                          View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Psychotest Results Charts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-rose-500" />
                  Hasil Psikotes
                </CardTitle>
                <CardDescription>
                  Ringkasan hasil psikotes Anda untuk pencocokan yang lebih akurat
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.psychotests && data.psychotests.length > 0 ? (
                  <div className="space-y-6">
                    {/* Bar Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-4">Skor per Kategori</h4>
                      <ChartContainer config={chartConfig} className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.psychotests}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="testType"
                              tickLine={false}
                              tickMargin={10}
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
                            <YAxis tickLine={false} axisLine={false} tickMargin={10} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="score" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>

                    {/* Pie Chart */}
                    <div>
                      <h4 className="text-sm font-medium mb-4">Distribusi Hasil</h4>
                      <div className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={data.psychotests}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="score"
                              label={(entry) => {
                                const labels: Record<string, string> = {
                                  pre_marriage: 'Pra-Nikah',
                                  disc: 'DISC',
                                  clinical: 'Clinical',
                                  '16pf': '16PF',
                                }
                                return labels[entry.testType] || entry.testType
                              }}
                              labelLine={false}
                            >
                              {data.psychotests.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {data.psychotests.map((test, index) => (
                          <div key={test.testType} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span className="text-sm text-gray-600">
                              {test.testType === 'pre_marriage' && 'Pra-Nikah'}
                              {test.testType === 'disc' && 'DISC'}
                              {test.testType === 'clinical' && 'Clinical'}
                              {test.testType === '16pf' && '16PF'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detailed Results */}
                    <div className="grid grid-cols-2 gap-3">
                      {data.psychotests.map((test) => (
                        <div
                          key={test.testType}
                          className="p-3 rounded-lg border bg-gray-50"
                        >
                          <p className="text-xs text-gray-500 mb-1">
                            {test.testType === 'pre_marriage' && 'Psikotes Pra-Nikah'}
                            {test.testType === 'disc' && 'DISC Assessment'}
                            {test.testType === 'clinical' && 'Clinical Assessment'}
                            {test.testType === '16pf' && '16PF Personality'}
                          </p>
                          <p className="text-lg font-bold text-rose-600">{test.score.toFixed(0)}%</p>
                          <Badge
                            variant={
                              test.score >= 80
                                ? 'default'
                                : test.score >= 60
                                ? 'secondary'
                                : 'outline'
                            }
                            className="mt-1"
                          >
                            {test.result}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3">Belum ada hasil psikotes</p>
                    <Button asChild variant="outline" disabled={isSubscriptionExpired}>
                      <Link href="/dashboard/psychotest">
                        <FileText className="w-4 h-4 mr-2" />
                        Mulai Psikotes
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Advertisement 2 - Middle */}
            {data?.advertisements?.[1] && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative h-40 bg-gradient-to-r from-purple-100 to-indigo-100 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-purple-600 font-medium mb-2">IKLAN SPONSOR</p>
                      <h3 className="text-lg font-bold text-gray-900">{data.advertisements[1].title}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {data?.matches && data.matches.length > 0 ? (
                    data.matches.map((match) => (
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
                                {match.targetInitials || getInitials(match.targetName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{match.targetName}</h4>
                              <p className="text-sm text-gray-600">
                                {match.targetAge ? `${match.targetAge} tahun` : 'Usia -'} •{' '}
                                {match.targetOccupation || 'Pekerjaan -'}
                              </p>
                              <p className="text-sm text-gray-500 truncate">{match.targetCity || 'Lokasi -'}</p>
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
                            disabled={isSubscriptionExpired}
                          >
                            <User className="w-4 h-4 mr-2" />
                            View Profile
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
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

            {/* Advertisement 3 - Bottom */}
            {data?.advertisements?.[2] && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative h-40 bg-gradient-to-r from-pink-100 to-rose-100 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-pink-600 font-medium mb-2">IKLAN SPONSOR</p>
                      <h3 className="text-lg font-bold text-gray-900">{data.advertisements[2].title}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>

          {/* Right Sidebar - Desktop Only */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-4">
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

              {/* Workflow Status Icon */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Status Saat Ini</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg border border-rose-200">
                    <div className="p-2 bg-rose-500 rounded-lg">
                      {(() => {
                        const step = workflowSteps[currentWorkflowIndex]
                        const Icon = step?.icon || Heart
                        return <Icon className="w-5 h-5 text-white" />
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {workflowSteps[currentWorkflowIndex]?.label || 'Loading...'}
                      </p>
                      <p className="text-xs text-gray-500">Tahap saat ini</p>
                    </div>
                  </div>
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
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
