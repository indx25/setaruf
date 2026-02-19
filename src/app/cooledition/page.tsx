'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  DollarSign,
  MessageSquare,
  Heart,
  TrendingUp,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Shield,
  ShieldAlert,
  Clock,
  Search,
  RefreshCw,
  ArrowLeft,
  Info
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const getInitials = (name?: string | null) => {
    if (!name) return ''
    return name.split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0, 2)
  }

  // Data
  const [insights, setInsights] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [ads, setAds] = useState<any[]>([])

  // UI State
  const [activeTab, setActiveTab] = useState('overview')
  const [userSearch, setUserSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [insightDays, setInsightDays] = useState('30')
  const [userGender, setUserGender] = useState('')
  const [userBlocked, setUserBlocked] = useState('') // '', 'true', 'false'
  const [userPremium, setUserPremium] = useState('') // '', 'true', 'false'
  const [userHasProfile, setUserHasProfile] = useState('') // '', 'true', 'false'
  const [userCity, setUserCity] = useState('')
  const [userMinAge, setUserMinAge] = useState('')
  const [userMaxAge, setUserMaxAge] = useState('')
  const [paymentDays, setPaymentDays] = useState('30')
  const [logType, setLogType] = useState('')
  const [logAction, setLogAction] = useState('')
  const [logQ, setLogQ] = useState('')
  const [logFrom, setLogFrom] = useState('')
  const [logTo, setLogTo] = useState('')
  const [adQ, setAdQ] = useState('')
  const [adPosition, setAdPosition] = useState('')
  const [adActive, setAdActive] = useState('')
  const [showAdDialog, setShowAdDialog] = useState(false)
  const [editingAd, setEditingAd] = useState<any>(null)
  const [adTitle, setAdTitle] = useState('')
  const [adDescription, setAdDescription] = useState('')
  const [adImageUrl, setAdImageUrl] = useState('')
  const [adLinkUrl, setAdLinkUrl] = useState('')
  const [adPosInput, setAdPosInput] = useState('dashboard_top')
  const [adStart, setAdStart] = useState('')
  const [adEnd, setAdEnd] = useState('')
  const [adIsActiveInput, setAdIsActiveInput] = useState('true')

  // Dialogs
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userNameInput, setUserNameInput] = useState('')
  const [userEmailInput, setUserEmailInput] = useState('')
  const [userIsAdminInput, setUserIsAdminInput] = useState('false')
  const [userIsPremiumInput, setUserIsPremiumInput] = useState('false')
  const [userIsBlockedInput, setUserIsBlockedInput] = useState('false')
  const [userPasswordInput, setUserPasswordInput] = useState('')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [paymentNote, setPaymentNote] = useState('')
  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [subSearch, setSubSearch] = useState('')
  const [subPlan, setSubPlan] = useState('') // '', 'free', 'premium'
  const [subActive, setSubActive] = useState('') // '', 'true', 'false'
  const [showSubDialog, setShowSubDialog] = useState(false)
  const [editingSub, setEditingSub] = useState<any>(null)
  const [subPlanInput, setSubPlanInput] = useState('free')
  const [subDurationInput, setSubDurationInput] = useState('1')
  const [subStartInput, setSubStartInput] = useState('')
  const [subEndInput, setSubEndInput] = useState('')
  const [subTrialInput, setSubTrialInput] = useState('true')
  // User Details
  const [showUserDetailDialog, setShowUserDetailDialog] = useState(false)
  const [userDetail, setUserDetail] = useState<any>(null)
  const [lastVerificationUrl, setLastVerificationUrl] = useState('')

  useEffect(() => {
    checkAdminAccess()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'overview') loadInsights()
      if (activeTab === 'users') loadUsers()
      if (activeTab === 'payments') loadPayments()
      if (activeTab === 'log') loadLogs()
      if (activeTab === 'ads') loadAds()
      if (activeTab === 'subscriptions') loadSubscriptions()
    }
  }, [isAdmin, activeTab, userSearch, paymentFilter, insightDays, userGender, userBlocked, userPremium, userHasProfile, userCity, userMinAge, userMaxAge, paymentDays, logType, logAction, logQ, logFrom, logTo, adQ, adPosition, adActive, subSearch, subPlan, subActive])

  const checkAdminAccess = async () => {
    try {
      const response = await fetch('/api/admin/insights', { credentials: 'include' })
      if (!response.ok) {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          if (url.searchParams.get('preview') === '1') {
            setIsAdmin(true)
            return
          }
        }
        router.push('/cooledition/login')
        return
      }
      setIsAdmin(true)
      setInsights(await response.json())
    } catch (err) {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (url.searchParams.get('preview') === '1') {
          setIsAdmin(true)
          return
        }
      }
      router.push('/cooledition/login')
    } finally {
      setIsLoading(false)
    }
  }

  const openUserDetails = async (user: any) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}`)
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Gagal memuat detail user')
        return
      }
      setUserDetail(data.user)
      setShowUserDetailDialog(true)
    } catch (err: any) {
      alert(err.message || 'Error memuat detail user')
    }
  }

  const resendVerification = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/resend-verification`, {
        method: 'POST'
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Gagal mengirim ulang verifikasi')
        return
      }
      setLastVerificationUrl(data.verificationUrl || '')
      alert(data.message + (data.verificationUrl ? `\nLink: ${data.verificationUrl}` : ''))
    } catch (err: any) {
      alert(err.message || 'Error mengirim ulang verifikasi')
    }
  }

  const loadInsights = async () => {
    try {
      const response = await fetch(`/api/admin/insights?days=${insightDays}`)
      const data = await response.json()

      if (response.ok) {
        setInsights(data)
      }
    } catch (err) {
      console.error('Error loading insights:', err)
    }
  }

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams()
      if (userSearch) params.set('search', userSearch)
      if (userGender) params.set('gender', userGender)
      if (userBlocked) params.set('blocked', userBlocked)
      if (userPremium) params.set('premium', userPremium)
      if (userHasProfile) params.set('hasProfile', userHasProfile)
      if (userCity) params.set('city', userCity)
      if (userMinAge) params.set('minAge', userMinAge)
      if (userMaxAge) params.set('maxAge', userMaxAge)
      const url = `/api/admin/users?${params.toString()}`
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const loadPayments = async () => {
    try {
      const params = new URLSearchParams()
      if (paymentFilter) params.set('status', paymentFilter)
      if (paymentDays) params.set('days', paymentDays)
      const url = `/api/admin/payments?${params.toString()}`
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setPayments(data.payments || [])
      }
    } catch (err) {
      console.error('Error loading payments:', err)
    }
  }

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams()
      params.set('limit', '300')
      if (logType) params.set('type', logType)
      if (logAction) params.set('action', logAction)
      if (logQ) params.set('q', logQ)
      if (logFrom) params.set('from', logFrom)
      if (logTo) params.set('to', logTo)
      const response = await fetch(`/api/admin/logs?${params.toString()}`)
      const data = await response.json()
      if (response.ok) {
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Error loading logs:', err)
    }
  }

  const loadAds = async () => {
    try {
      const params = new URLSearchParams()
      if (adQ) params.set('q', adQ)
      if (adPosition) params.set('position', adPosition)
      if (adActive) params.set('active', adActive)
      const response = await fetch(`/api/admin/advertisements?${params.toString()}`)
      const data = await response.json()
      if (response.ok) {
        setAds(data.advertisements || [])
      }
    } catch (e) {}
  }

  const resetAdForm = () => {
    setEditingAd(null)
    setAdTitle('')
    setAdDescription('')
    setAdImageUrl('')
    setAdLinkUrl('')
    setAdPosInput('dashboard_top')
    setAdStart('')
    setAdEnd('')
    setAdIsActiveInput('true')
  }

  const submitAd = async () => {
    try {
      const payload = {
        title: adTitle,
        description: adDescription || null,
        imageUrl: adImageUrl || null,
        linkUrl: adLinkUrl || null,
        position: adPosInput,
        isActive: adIsActiveInput === 'true',
        startDate: adStart || undefined,
        endDate: adEnd || null
      }
      let res
      if (editingAd) {
        res = await fetch(`/api/admin/advertisements/${editingAd.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch(`/api/admin/advertisements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Gagal menyimpan iklan')
        return
      }
      setShowAdDialog(false)
      resetAdForm()
      loadAds()
      loadInsights()
    } catch (e: any) {
      alert(e.message || 'Error')
    }
  }

  const deleteAd = async (id: string) => {
    if (!confirm('Hapus iklan ini?')) return
    try {
      const res = await fetch(`/api/admin/advertisements/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus iklan')
        return
      }
      loadAds()
      loadInsights()
    } catch (e: any) {
      alert(e.message || 'Error')
    }
  }

  const handlePaymentAction = async (action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/admin/payments/${selectedPayment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: paymentNote })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Action failed')
      }

      setShowPaymentDialog(false)
      setPaymentNote('')
      setSelectedPayment(null)
      loadPayments()
      loadInsights()
      alert(data.message)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    if (!confirm(`Are you sure you want to ${isBlocked ? 'unblock' : 'block'} this user?`)) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: !isBlocked })
      })

      if (response.ok) {
        loadUsers()
        loadInsights()
      }
    } catch (err) {
      console.error('Error blocking user:', err)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadUsers()
        loadInsights()
      }
    } catch (err) {
      console.error('Error deleting user:', err)
    }
  }

  const openEditUser = (user: any) => {
    setEditingUser(user)
    setUserNameInput(user.name || user.profile?.fullName || '')
    setUserEmailInput(user.email || '')
    setUserIsAdminInput(user.isAdmin ? 'true' : 'false')
    setUserIsPremiumInput(user.isPremium ? 'true' : 'false')
    setUserIsBlockedInput(user.isBlocked ? 'true' : 'false')
    setUserPasswordInput('')
    setShowUserDialog(true)
  }

  const loadSubscriptions = async () => {
    try {
      const params = new URLSearchParams()
      if (subSearch) params.set('search', subSearch)
      if (subPlan) params.set('plan', subPlan)
      if (subActive) params.set('active', subActive)
      const url = `/api/admin/subscriptions?${params.toString()}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        setSubscriptions(data.subscriptions || [])
      }
    } catch (err) {
      console.error('Error loading subscriptions:', err)
    }
  }

  const openEditSub = (sub: any) => {
    setEditingSub(sub)
    setSubPlanInput(sub.planType || 'free')
    setSubDurationInput(String(sub.duration || 1))
    setSubStartInput(sub.startDate ? new Date(sub.startDate).toISOString().substring(0, 10) : '')
    setSubEndInput(sub.endDate ? new Date(sub.endDate).toISOString().substring(0, 10) : '')
    setSubTrialInput(sub.isTrial ? 'true' : 'false')
    setShowSubDialog(true)
  }

  const saveEditSub = async () => {
    if (!editingSub) return
    try {
      const payload: any = {
        planType: subPlanInput,
        duration: parseInt(subDurationInput || '1', 10),
        startDate: subStartInput ? new Date(subStartInput).toISOString() : undefined,
        endDate: subEndInput ? new Date(subEndInput).toISOString() : undefined,
        isTrial: subPlanInput === 'free' ? subTrialInput === 'true' : false,
        upgradeToPremium: subPlanInput === 'premium'
      }
      const response = await fetch(`/api/admin/subscriptions/${editingSub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Gagal mengupdate subscription')
        return
      }
      setShowSubDialog(false)
      setEditingSub(null)
      await loadSubscriptions()
      await loadInsights()
    } catch (err: any) {
      alert(err.message || 'Error mengupdate subscription')
    }
  }

  const quickUpgradePremium = async (sub: any) => {
    try {
      const payload = {
        planType: 'premium',
        duration: 1,
        startDate: new Date().toISOString(),
        isTrial: false,
        isActive: true,
        upgradeToPremium: true
      }
      const response = await fetch(`/api/admin/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Gagal upgrade ke premium')
        return
      }
      await loadSubscriptions()
      await loadInsights()
    } catch (err: any) {
      alert(err.message || 'Error upgrade ke premium')
    }
  }

  const saveEditUser = async () => {
    if (!editingUser) return
    try {
      const payload: any = {
        name: userNameInput,
        email: userEmailInput,
        isAdmin: userIsAdminInput === 'true',
        isPremium: userIsPremiumInput === 'true',
        isBlocked: userIsBlockedInput === 'true',
      }
      if (userPasswordInput.trim()) {
        payload.password = userPasswordInput.trim()
      }
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Gagal mengupdate user')
        return
      }
      setShowUserDialog(false)
      setEditingUser(null)
      await loadUsers()
      await loadInsights()
    } catch (err: any) {
      alert(err.message || 'Error mengupdate user')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Access denied. Admin privileges required.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Portal</h1>
              <p className="text-sm text-gray-500">Setaruf Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-rose-500">
              <Shield className="w-3 h-3 mr-1" />
              Admin
            </Badge>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await signOut({ redirect: false })
                  await fetch('/api/admin/logout', { method: 'POST' })
                } finally {
                  router.push('/')
                }
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="insight">Insight</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="ads">Advertising</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {insights && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                      <Users className="w-4 h-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{insights.overview.totalUsers}</div>
                      <p className="text-xs text-gray-500">
                        +{insights.users?.newUsersLast7Days || 0} this week
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
                      <DollarSign className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{insights.overview.premiumUsers}</div>
                      <p className="text-xs text-gray-500">
                        Active subscriptions
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                      <Heart className="w-4 h-4 text-pink-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{insights.overview.totalMatches}</div>
                      <p className="text-xs text-gray-500">
                        Active connections
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Messages</CardTitle>
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{insights.overview.totalMessages}</div>
                      <p className="text-xs text-gray-500">
                        Total sent
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        Revenue Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Revenue</span>
                        <span className="text-2xl font-bold text-green-600">
                          Rp {(insights.payments?.totalRevenue || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">This Month</span>
                        <span className="text-xl font-semibold">
                          Rp {(insights.payments?.revenueThisMonth || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Approved</span>
                          <span className="text-green-600 font-medium">{insights.payments?.approvedPayments || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-500">Pending</span>
                          <span className="text-yellow-600 font-medium">{insights.payments?.pendingPayments || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-500">Rejected</span>
                          <span className="text-red-600 font-medium">{insights.payments?.rejectedPayments || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        User Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Blocked Users</span>
                        <Badge variant="destructive">{insights.overview.blockedUsers || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Active Subscriptions</span>
                        <Badge className="bg-green-500">{insights.overview.activeSubscriptions || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Test Completion Rate</span>
                        <span className="font-semibold">{insights.users?.completionRate || 0}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">New Users (7 days)</span>
                        <span className="font-semibold text-rose-600">+{insights.users?.newUsersLast7Days || 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {insights.recent?.users?.map((user: any) => (
                          <div key={user.id} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">{user.name || user.profile?.fullName || 'Unknown'}</p>
                              <p className="text-gray-500 text-xs">{user.email}</p>
                            </div>
                            <Badge variant="outline">
                              {new Date(user.createdAt).toLocaleDateString('id-ID')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Payments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {insights.recent?.payments?.map((payment: any) => (
                          <div key={payment.id} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">
                                {getInitials(payment.user?.name) || 'Unknown'}
                              </p>
                              <p className="text-gray-500 text-xs">
                                Rp {payment.amount?.toLocaleString('id-ID')}
                              </p>
                            </div>
                            <Badge className={
                              payment.status === 'approved' ? 'bg-green-500' :
                              payment.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                            }>
                              {payment.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Insight Tab */}
          <TabsContent value="insight" className="space-y-6">
            {insights?.analytics && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">Rentang waktu</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={insightDays}
                      onChange={(e) => setInsightDays(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="7">7 hari</option>
                      <option value="14">14 hari</option>
                      <option value="30">30 hari</option>
                      <option value="90">90 hari</option>
                    </select>
                    <Button variant="outline" onClick={loadInsights}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Terapkan
                    </Button>
                  </div>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Traffic 30 Hari</CardTitle>
                    <CardDescription>New users, matches, messages, sessions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      className="h-64 w-full"
                      config={{
                        newUsers: { label: 'New Users', color: '#ef4444' },
                        matches: { label: 'Matches', color: '#3b82f6' },
                        messages: { label: 'Messages', color: '#10b981' },
                        sessions: { label: 'Sessions', color: '#f59e0b' },
                      }}
                    >
                      <AreaChart data={insights.analytics.trafficDaily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Area type="monotone" dataKey="newUsers" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                        <Area type="monotone" dataKey="matches" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                        <Area type="monotone" dataKey="messages" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                        <Area type="monotone" dataKey="sessions" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Demografi Gender</CardTitle>
                      <CardDescription>Proporsi pengguna berdasarkan gender</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        className="h-64 w-full"
                        config={{
                          male: { label: 'Male', color: '#3b82f6' },
                          female: { label: 'Female', color: '#ef4444' },
                        }}
                      >
                        <PieChart>
                          <Pie
                            data={Object.entries(insights.analytics.demographics.gender).map(([name, value]) => ({ name, value }))}
                            dataKey="value"
                            nameKey="name"
                            label
                          >
                            {Object.entries(insights.analytics.demographics.gender).map((_, i) => (
                              <Cell key={i} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b'][i % 4]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribusi Usia</CardTitle>
                      <CardDescription>Kelompok umur</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        className="h-64 w-full"
                        config={{
                          count: { label: 'Users', color: '#8b5cf6' },
                        }}
                      >
                        <BarChart data={Object.entries(insights.analytics.demographics.ageBuckets).map(([range, count]) => ({ range, count }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="count" fill="#8b5cf6" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Kota</CardTitle>
                      <CardDescription>5 kota dengan pengguna terbanyak</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {insights.analytics.demographics.topCities.map((c: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-gray-600">{c.city}</span>
                            <Badge className="bg-rose-500">{c.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Metode Login</CardTitle>
                      <CardDescription>Distribusi pengguna berdasarkan provider</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        className="h-64 w-full"
                        config={{
                          credentials: { label: 'Credentials', color: '#10b981' },
                          google: { label: 'Google', color: '#ef4444' },
                        }}
                      >
                        <PieChart>
                          <Pie
                            data={Object.entries(insights.analytics.providerBreakdown).map(([name, value]) => ({ name, value }))}
                            dataKey="value"
                            nameKey="name"
                            label
                          >
                            {Object.entries(insights.analytics.providerBreakdown).map((_, i) => (
                              <Cell key={i} fill={['#10b981', '#ef4444', '#3b82f6', '#f59e0b'][i % 4]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-4 text-sm text-gray-600">
                        Active Sessions: <span className="font-semibold">{insights.analytics.sessions.totalActive}</span>, Total Sessions: <span className="font-semibold">{insights.analytics.sessions.totalSessions}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Log Tab */}
          <TabsContent value="log" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <CardTitle>Aktivitas Website</CardTitle>
                  <CardDescription>Filter dan lihat aktivitas terbaru</CardDescription>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <select value={logType} onChange={(e) => setLogType(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Semua Jenis</option>
                      <option value="user">User</option>
                      <option value="profile">Profile</option>
                      <option value="match">Match</option>
                      <option value="message">Message</option>
                      <option value="payment">Payment</option>
                      <option value="subscription">Subscription</option>
                      <option value="notification">Notification</option>
                      <option value="psychotest">Psychotest</option>
                    </select>
                    <Input placeholder="Aksi (mis. approved, created)" value={logAction} onChange={(e) => setLogAction(e.target.value)} />
                    <Input placeholder="Cari teks" value={logQ} onChange={(e) => setLogQ(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <Input type="date" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} />
                      <Input type="date" value={logTo} onChange={(e) => setLogTo(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={loadLogs}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Terapkan
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setLogType('')
                          setLogAction('')
                          setLogQ('')
                          setLogFrom('')
                          setLogTo('')
                          loadLogs()
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm text-gray-600">Menampilkan hingga 300 aktivitas terbaru</div>
                  <Button variant="outline" onClick={loadLogs}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Pengguna</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-gray-600">{new Date(item.at).toLocaleString('id-ID')}</TableCell>
                        <TableCell>
                          <Badge>{item.type}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{item.action}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.userName || '-'}</span>
                            {item.userId && <span className="text-xs text-gray-500">({item.userId.slice(0, 6)})</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700">{item.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Filter dan kelola pengguna</CardDescription>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Cari nama/email..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <select value={userGender} onChange={(e) => setUserGender(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Semua Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <select value={userBlocked} onChange={(e) => setUserBlocked(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Blocked: Semua</option>
                      <option value="true">Blocked</option>
                      <option value="false">Unblocked</option>
                    </select>
                    <select value={userPremium} onChange={(e) => setUserPremium(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Premium: Semua</option>
                      <option value="true">Premium</option>
                      <option value="false">Non-Premium</option>
                    </select>
                    <select value={userHasProfile} onChange={(e) => setUserHasProfile(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Profile: Semua</option>
                      <option value="true">Ada</option>
                      <option value="false">Tidak Ada</option>
                    </select>
                    <Input placeholder="Kota" value={userCity} onChange={(e) => setUserCity(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <Input placeholder="Min umur" value={userMinAge} onChange={(e) => setUserMinAge(e.target.value)} />
                      <Input placeholder="Max umur" value={userMaxAge} onChange={(e) => setUserMaxAge(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={loadUsers}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Terapkan
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setUserSearch('')
                          setUserGender('')
                          setUserBlocked('')
                          setUserPremium('')
                          setUserHasProfile('')
                          setUserCity('')
                          setUserMinAge('')
                          setUserMaxAge('')
                          loadUsers()
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Unique Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p
                              className="font-medium cursor-pointer hover:text-rose-600"
                              onClick={() => openUserDetails(user)}
                            >
                              {user.name || user.profile?.fullName || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">{getInitials(user.name) || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.uniqueCode || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.isPremium && <Badge className="bg-amber-500">Premium</Badge>}
                            {user.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                            {user.isAdmin && <Badge className="bg-purple-500">Admin</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditUser(user)}
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBlockUser(user.id, user.isBlocked)}
                            >
                              {user.isBlocked ? <Shield className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                            {user.isBlocked && (
                              <Button
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => resendVerification(user.id)}
                                title="Kirim ulang verifikasi email"
                              >
                                Resend Verification
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <div>
                    <CardTitle>Subscriptions</CardTitle>
                    <CardDescription>Kelola status free/premium dan masa berlaku</CardDescription>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <Input placeholder="Cari nama/email" value={subSearch} onChange={(e) => setSubSearch(e.target.value)} />
                    <select value={subPlan} onChange={(e) => setSubPlan(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                      <option value="">Semua Plan</option>
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                    <select value={subActive} onChange={(e) => setSubActive(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                      <option value="">Aktif: Semua</option>
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={loadSubscriptions}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Terapkan
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSubSearch('')
                          setSubPlan('')
                          setSubActive('')
                          loadSubscriptions()
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sub.user?.name || sub.user?.profile?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{sub.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Badge className={sub.planType === 'premium' ? 'bg-purple-500' : 'bg-gray-500'}>
                            {sub.planType}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.duration || '-'}</TableCell>
                        <TableCell>
                          {sub.startDate ? new Date(sub.startDate).toLocaleDateString('id-ID') : '-'}{' '}
                          {' - '}{sub.endDate ? new Date(sub.endDate).toLocaleDateString('id-ID') : 'Tidak ditentukan'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {sub.isActive && <Badge className="bg-green-500">Aktif</Badge>}
                            {sub.isTrial && <Badge variant="outline">Trial</Badge>}
                            {sub.user?.isPremium && <Badge className="bg-amber-500">Premium User</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditSub(sub)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => quickUpgradePremium(sub)}
                              disabled={sub.user?.isPremium || sub.planType === 'premium'}
                            >
                              Upgrade ke Premium
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <div>
                    <CardTitle>Payment Audit</CardTitle>
                    <CardDescription>Filter dan review pembayaran</CardDescription>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <select
                      value={paymentDays}
                      onChange={(e) => setPaymentDays(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="7">7 Hari</option>
                      <option value="30">30 Hari</option>
                      <option value="90">90 Hari</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={loadPayments}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Terapkan
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setPaymentFilter('')
                          setPaymentDays('30')
                          loadPayments()
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Unique Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {getInitials(payment.user?.name) || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">{payment.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          Rp {payment.amount?.toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.uniqueCode}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            payment.status === 'approved' ? 'bg-green-500' :
                            payment.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                          }>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.createdAt).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>
                          {payment.status === 'pending' && payment.proofUrl && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedPayment(payment)
                                  setShowPaymentDialog(true)
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          {payment.proofUrl && (
                            <a
                              href={payment.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-rose-500 text-sm hover:underline"
                            >
                              View Proof
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Configure platform settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-600">
                    Reset database terkait user (tidak mempengaruhi sistem). Admin tersisa dan tidak direset.
                  </div>
                  <Button variant="destructive" onClick={async () => {
                    if (!confirm('Yakin reset database user? Semua data user akan dihapus, admin tidak dihapus.')) return
                    try {
                      setIsLoading(true)
                      const res = await fetch('/api/admin/reset-users', { method: 'POST' })
                      const data = await res.json()
                      if (!res.ok) {
                        alert(data.error || 'Gagal reset database user')
                      } else {
                        alert('Berhasil reset database user')
                        await loadInsights()
                        setActiveTab('overview')
                      }
                    } catch (err: any) {
                      alert(err.message || 'Error')
                    } finally {
                      setIsLoading(false)
                    }
                  }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Reset Database User
                  </Button>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-600">
                    Seed 30 sample user terbaru dengan profil lengkap, psikotes lengkap, quote, nomor WA, dan link Instagram.
                  </div>
                  <Button
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    onClick={async () => {
                      try {
                        setIsLoading(true)
                        const res = await fetch('/api/admin/seed-complete-30', { method: 'POST' })
                        const data = await res.json()
                        if (!res.ok) {
                          alert(data.error || 'Gagal membuat sample lengkap')
                        } else {
                          alert(`Berhasil membuat ${data.created} sample lengkap`)
                          await loadInsights()
                          setActiveTab('users')
                          await loadUsers()
                        }
                      } catch (err: any) {
                        alert(err.message || 'Error')
                      } finally {
                        setIsLoading(false)
                      }
                    }}
                  >
                    Seed 30 Sample Lengkap
                  </Button>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Settings panel coming soon. For now, you can manage users and payments.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="ads" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <div>
                    <CardTitle>Advertising</CardTitle>
                    <CardDescription>Kelola iklan dashboard</CardDescription>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <Input placeholder="Cari judul" value={adQ} onChange={(e) => setAdQ(e.target.value)} />
                    <select value={adPosition} onChange={(e) => setAdPosition(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Semua Posisi</option>
                      <option value="dashboard_left">Left Sidebar</option>
                      <option value="dashboard_right">Right Sidebar</option>
                      <option value="dashboard_top">Top</option>
                      <option value="dashboard_center">Center</option>
                      <option value="dashboard_middle">Middle (legacy)</option>
                      <option value="dashboard_bottom">Bottom</option>
                    </select>
                    <select value={adActive} onChange={(e) => setAdActive(e.target.value)} className="border rounded px-2 py-2 text-sm">
                      <option value="">Aktif: Semua</option>
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={loadAds}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Terapkan
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setAdQ('')
                          setAdPosition('')
                          setAdActive('')
                          loadAds()
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        className="bg-rose-500"
                        onClick={() => {
                          resetAdForm()
                          setShowAdDialog(true)
                        }}
                      >
                        Tambah Iklan
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul</TableHead>
                      <TableHead>Posisi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ads.map((ad) => (
                      <TableRow key={ad.id}>
                        <TableCell>
                          <div className="font-medium">{ad.title}</div>
                          <div className="text-xs text-gray-500">{ad.description || '-'}</div>
                        </TableCell>
                        <TableCell className="capitalize">{ad.position.replace('dashboard_', '')}</TableCell>
                        <TableCell>
                          <Badge className={ad.isActive ? 'bg-green-500' : 'bg-gray-400'}>
                            {ad.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {ad.startDate ? new Date(ad.startDate).toLocaleDateString('id-ID') : '-'}{' '}
                            {' - '}{ad.endDate ? new Date(ad.endDate).toLocaleDateString('id-ID') : 'Tidak ditentukan'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingAd(ad)
                                setAdTitle(ad.title || '')
                                setAdDescription(ad.description || '')
                                setAdImageUrl(ad.imageUrl || '')
                                setAdLinkUrl(ad.linkUrl || '')
                                setAdPosInput(ad.position || 'dashboard_top')
                                setAdStart(ad.startDate ? new Date(ad.startDate).toISOString().substring(0, 10) : '')
                                setAdEnd(ad.endDate ? new Date(ad.endDate).toISOString().substring(0, 10) : '')
                                setAdIsActiveInput(ad.isActive ? 'true' : 'false')
                                setShowAdDialog(true)
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteAd(ad.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      {/* Edit User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Ubah data user. Password opsional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Name</Label>
                <Input value={userNameInput} onChange={(e) => setUserNameInput(e.target.value)} placeholder="Nama" />
              </div>
              <div>
                <Label className="text-sm">Email</Label>
                <Input value={userEmailInput} onChange={(e) => setUserEmailInput(e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">Admin</Label>
                <select value={userIsAdminInput} onChange={(e) => setUserIsAdminInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                  <option value="false">Bukan Admin</option>
                  <option value="true">Admin</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">Premium</Label>
                <select value={userIsPremiumInput} onChange={(e) => setUserIsPremiumInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                  <option value="false">Tidak Premium</option>
                  <option value="true">Premium</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">Blocked</Label>
                <select value={userIsBlockedInput} onChange={(e) => setUserIsBlockedInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                  <option value="false">Aktif</option>
                  <option value="true">Blocked</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Password (opsional)</Label>
              <Input type="password" value={userPasswordInput} onChange={(e) => setUserPasswordInput(e.target.value)} placeholder="Kosongkan jika tidak diganti" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Batal</Button>
            <Button onClick={saveEditUser}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>Ubah plan dan masa berlaku subscription</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Plan</Label>
                <select value={subPlanInput} onChange={(e) => setSubPlanInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">Duration (bulan)</Label>
                <Input value={subDurationInput} onChange={(e) => setSubDurationInput(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Mulai</Label>
                <Input type="date" value={subStartInput} onChange={(e) => setSubStartInput(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">Selesai</Label>
                <Input type="date" value={subEndInput} onChange={(e) => setSubEndInput(e.target.value)} />
              </div>
            </div>
            {subPlanInput === 'free' && (
              <div>
                <Label className="text-sm">Trial</Label>
                <select value={subTrialInput} onChange={(e) => setSubTrialInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubDialog(false)}>Batal</Button>
            <Button onClick={saveEditSub}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={showUserDetailDialog} onOpenChange={setShowUserDetailDialog}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-3xl md:max-w-5xl lg:max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail User</DialogTitle>
            <DialogDescription>Profil dan hasil psikotes</DialogDescription>
          </DialogHeader>
          {userDetail && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {userDetail.name || userDetail.profile?.fullName || 'Unknown'}
                  </CardTitle>
                  <CardDescription>{userDetail.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  {userDetail.isBlocked && lastVerificationUrl && (
                    <div className="mb-3 p-3 border rounded bg-amber-50">
                      <div className="text-sm text-amber-800">Tautan verifikasi terbaru:</div>
                      <a href={lastVerificationUrl} target="_blank" rel="noopener noreferrer" className="text-rose-600 text-sm break-all hover:underline">
                        {lastVerificationUrl}
                      </a>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            try {
                              navigator.clipboard.writeText(lastVerificationUrl)
                              alert('Tautan verifikasi disalin ke clipboard')
                            } catch {}
                          }}
                        >
                          Copy Link
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mb-3">
                    {userDetail.isAdmin && <Badge className="bg-purple-500">Admin</Badge>}
                    {userDetail.isPremium && <Badge className="bg-amber-500">Premium</Badge>}
                    {userDetail.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Joined</span>
                      <div className="font-medium">{new Date(userDetail.createdAt).toLocaleDateString('id-ID')}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Unique Code</span>
                      <div><Badge variant="outline">{userDetail.uniqueCode || '-'}</Badge></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profil</CardTitle>
                  <CardDescription>Ringkasan biodata</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Nama Lengkap</span>
                      <div className="font-medium">{userDetail.profile?.fullName || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Gender</span>
                      <div className="font-medium">{userDetail.profile?.gender || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Usia</span>
                      <div className="font-medium">{userDetail.profile?.age ?? '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Kota</span>
                      <div className="font-medium">{userDetail.profile?.city || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Pendidikan</span>
                      <div className="font-medium">{userDetail.profile?.education || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Pekerjaan</span>
                      <div className="font-medium">{userDetail.profile?.occupation || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Agama</span>
                      <div className="font-medium">{userDetail.profile?.religion || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Level Religius</span>
                      <div className="font-medium">{userDetail.profile?.religiousLevel || '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Psikotes</CardTitle>
                  <CardDescription>Skor dan hasil</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(userDetail.psychotests || []).map((t: any) => (
                      <div key={t.id} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold capitalize">
                            {t.testType === 'pre_marriage' ? 'Pra-Nikah' :
                             t.testType === 'disc' ? 'DISC' :
                             t.testType === 'clinical' ? 'Clinical' :
                             t.testType === '16pf' ? '16PF' : t.testType}
                          </div>
                          <Badge className="bg-blue-500">{Math.round((t.score || 0) * 100) / 100}%</Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{t.result || '-'}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {t.completedAt ? new Date(t.completedAt).toLocaleDateString('id-ID') : '-'}
                        </div>
                      </div>
                    ))}
                    {(!userDetail.psychotests || userDetail.psychotests.length === 0) && (
                      <div className="text-sm text-gray-600">Belum ada hasil psikotes</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDetailDialog(false)}>Tutup</Button>
            {userDetail?.isBlocked && (
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => resendVerification(userDetail.id)}
                title="Kirim ulang verifikasi email"
              >
                Resend Verification
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Review Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Payment</DialogTitle>
            <DialogDescription>
              Review the payment proof and approve or reject
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">User</p>
                    <p className="font-medium">
                      {getInitials(selectedPayment.user?.name) || selectedPayment.user?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-bold text-lg text-rose-600">
                      Rp {selectedPayment.amount?.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Unique Code</p>
                    <p className="font-medium">{selectedPayment.uniqueCode}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Expected</p>
                    <p className="font-medium">
                      Rp {(50000 + parseInt(selectedPayment.uniqueCode)).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>

              {selectedPayment.proofUrl && (
                <div>
                  <Label>Payment Proof</Label>
                  <a
                    href={selectedPayment.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1 text-rose-500 hover:underline"
                  >
                    Click to view proof
                  </a>
                </div>
              )}

              <div>
                <Label htmlFor="note">Admin Note (optional)</Label>
                <Input
                  id="note"
                  placeholder="Add a note..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>

              {selectedPayment.amount !== (50000 + parseInt(selectedPayment.uniqueCode)) && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Amount mismatch! Expected: Rp {(50000 + parseInt(selectedPayment.uniqueCode)).toLocaleString('id-ID')}, Received: Rp {selectedPayment.amount?.toLocaleString('id-ID')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentDialog(false)
                setPaymentNote('')
                setSelectedPayment(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handlePaymentAction('reject')}
              disabled={!selectedPayment}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600"
              onClick={() => handlePaymentAction('approve')}
              disabled={!selectedPayment || selectedPayment.amount !== (50000 + parseInt(selectedPayment.uniqueCode))}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showAdDialog} onOpenChange={setShowAdDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAd ? 'Edit Iklan' : 'Tambah Iklan'}</DialogTitle>
            <DialogDescription>Informasi iklan dashboard</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Judul</Label>
              <Input value={adTitle} onChange={(e) => setAdTitle(e.target.value)} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input value={adDescription} onChange={(e) => setAdDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Image URL</Label>
                <Input value={adImageUrl} onChange={(e) => setAdImageUrl(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">
                  Gambar iklan yang ditampilkan. Simpan file di /public/ads lalu isi seperti /ads/banner-top.jpg
                </p>
                {adImageUrl && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <img src={adImageUrl} alt="Preview" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>
              <div>
                <Label>Link URL</Label>
                <Input value={adLinkUrl} onChange={(e) => setAdLinkUrl(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">
                  Tujuan saat iklan diklik, mis. https://contoh.com/landing
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Posisi</Label>
                <select value={adPosInput} onChange={(e) => setAdPosInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                  <option value="dashboard_left">Left Sidebar</option>
                  <option value="dashboard_right">Right Sidebar</option>
                  <option value="dashboard_top">Top</option>
                  <option value="dashboard_center">Center</option>
                  <option value="dashboard_middle">Middle (legacy)</option>
                  <option value="dashboard_bottom">Bottom</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  {adPosInput === 'dashboard_left' ? 'Disarankan: 300×300 px (atau 300×250)' :
                   adPosInput === 'dashboard_right' ? 'Disarankan: 300×300 px (atau 300×250)' :
                   adPosInput === 'dashboard_top' ? 'Disarankan: 1200×240 px (banner lebar)' :
                   adPosInput === 'dashboard_center' ? 'Disarankan: 800×250 px' :
                   adPosInput === 'dashboard_middle' ? 'Disarankan: 800×300 px' :
                   adPosInput === 'dashboard_bottom' ? 'Disarankan: 1200×180 px' :
                   'Disarankan: 400×160 px'}
                </p>
              </div>
              <div>
                <Label>Mulai</Label>
                <Input type="date" value={adStart} onChange={(e) => setAdStart(e.target.value)} />
              </div>
              <div>
                <Label>Selesai</Label>
                <Input type="date" value={adEnd} onChange={(e) => setAdEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <select value={adIsActiveInput} onChange={(e) => setAdIsActiveInput(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdDialog(false); resetAdForm() }}>Batal</Button>
            <Button onClick={submitAd}>{editingAd ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
