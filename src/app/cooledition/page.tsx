'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  ArrowLeft
} from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  // Data
  const [insights, setInsights] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])

  // UI State
  const [activeTab, setActiveTab] = useState('overview')
  const [userSearch, setUserSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  // Dialogs
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [paymentNote, setPaymentNote] = useState('')

  useEffect(() => {
    checkAdminAccess()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'overview') loadInsights()
      if (activeTab === 'users') loadUsers()
      if (activeTab === 'payments') loadPayments()
    }
  }, [isAdmin, activeTab, userSearch, paymentFilter])

  const checkAdminAccess = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()

      if (!response.ok || !data.user?.isAdmin) {
        router.push('/')
        return
      }

      setIsAdmin(true)
      loadInsights()
    } catch (err) {
      router.push('/')
    } finally {
      setIsLoading(false)
    }
  }

  const loadInsights = async () => {
    try {
      const response = await fetch('/api/admin/insights')
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
      const url = `/api/admin/users?search=${userSearch}`
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
      const url = `/api/admin/payments${paymentFilter ? `?status=${paymentFilter}` : ''}`
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setPayments(data.payments || [])
      }
    } catch (err) {
      console.error('Error loading payments:', err)
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
          <Badge className="bg-rose-500">
            <Shield className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
                              <p className="font-medium">{user.name || 'Unknown'}</p>
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
                                {payment.user?.profile?.initials || payment.user?.name || 'Unknown'}
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

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage all registered users</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={loadUsers}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
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
                            <p className="font-medium">{user.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{user.profile?.initials || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payment Audit</CardTitle>
                    <CardDescription>Review and approve payments</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
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
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={loadPayments}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
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
                              {payment.user?.profile?.initials || payment.user?.name || 'Unknown'}
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
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Settings panel coming soon. For now, you can manage users and payments.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
                      {selectedPayment.user?.profile?.initials || selectedPayment.user?.name}
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
    </div>
  )
}

// Add missing import
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
