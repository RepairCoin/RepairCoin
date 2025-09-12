'use client';

import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Clock,
  PauseCircle,
  PlayCircle,
  RefreshCw
} from 'lucide-react';

interface Subscription {
  id: number;
  shopId: string;
  shopName?: string;
  status: 'pending' | 'active' | 'cancelled' | 'paused' | 'defaulted';
  monthlyAmount: number;
  subscriptionType: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  enrolledAt: string;
  activatedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  isActive: boolean;
  daysOverdue?: number;
}

interface SubscriptionStats {
  totalActive: number;
  totalPending: number;
  totalCancelled: number;
  totalRevenue: number;
  monthlyRecurring: number;
  overdueCount: number;
}

export default function SubscriptionManagementTab() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  // Modal states
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    filterSubscriptions(activeTab);
  }, [subscriptions, activeTab]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminAuthToken');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/subscription/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load subscriptions');
      }

      const result = await response.json();
      if (result.success) {
        const subs = result.data || [];
        setSubscriptions(subs);
        calculateStats(subs);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (subs: Subscription[]) => {
    const stats: SubscriptionStats = {
      totalActive: subs.filter(s => s.status === 'active').length,
      totalPending: subs.filter(s => s.status === 'pending').length,
      totalCancelled: subs.filter(s => s.status === 'cancelled').length,
      totalRevenue: subs.reduce((sum, s) => sum + s.totalPaid, 0),
      monthlyRecurring: subs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.monthlyAmount, 0),
      overdueCount: subs.filter(s => s.daysOverdue && s.daysOverdue > 0).length
    };
    setStats(stats);
  };

  const filterSubscriptions = (tab: string) => {
    let filtered: Subscription[] = [];
    
    switch (tab) {
      case 'active':
        filtered = subscriptions.filter(s => s.status === 'active');
        break;
      case 'pending':
        filtered = subscriptions.filter(s => s.status === 'pending');
        break;
      case 'overdue':
        filtered = subscriptions.filter(s => s.daysOverdue && s.daysOverdue > 0);
        break;
      case 'cancelled':
        filtered = subscriptions.filter(s => s.status === 'cancelled' || s.status === 'defaulted');
        break;
      default:
        filtered = subscriptions;
    }
    
    setFilteredSubscriptions(filtered);
  };

  const handleApprove = async () => {
    if (!selectedSubscription) return;
    
    try {
      setActionLoading(true);
      const token = localStorage.getItem('adminAuthToken');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/subscription/subscriptions/${selectedSubscription.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to approve subscription');
      }

      setShowApproveModal(false);
      await loadSubscriptions();
    } catch (error) {
      console.error('Error approving subscription:', error);
      alert('Failed to approve subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedSubscription) return;
    
    try {
      setActionLoading(true);
      const token = localStorage.getItem('adminAuthToken');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/subscription/subscriptions/${selectedSubscription.id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: cancellationReason || 'Cancelled by administrator'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      setShowCancelModal(false);
      setCancellationReason('');
      await loadSubscriptions();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!selectedSubscription) return;
    
    try {
      setActionLoading(true);
      const token = localStorage.getItem('adminAuthToken');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/subscription/subscriptions/${selectedSubscription.id}/pause`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to pause subscription');
      }

      setShowPauseModal(false);
      await loadSubscriptions();
    } catch (error) {
      console.error('Error pausing subscription:', error);
      alert('Failed to pause subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (subscription: Subscription) => {
    try {
      const token = localStorage.getItem('adminAuthToken');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/subscription/subscriptions/${subscription.id}/resume`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resume subscription');
      }

      await loadSubscriptions();
    } catch (error) {
      console.error('Error resuming subscription:', error);
      alert('Failed to resume subscription');
    }
  };

  // Table columns
  const columns: Column<Subscription>[] = [
    {
      key: 'shopId',
      header: 'Shop',
      accessor: (sub) => (
        <div>
          <div className="font-medium">{sub.shopName || sub.shopId}</div>
          <div className="text-sm text-gray-500">{sub.shopId}</div>
        </div>
      ),
      sortable: true
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (sub) => {
        const statusConfig = {
          active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
          pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
          paused: { color: 'bg-blue-100 text-blue-800', icon: PauseCircle },
          cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
          defaulted: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
        };
        
        const config = statusConfig[sub.status];
        const Icon = config.icon;
        
        return (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            <Icon className="w-3 h-3" />
            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
          </div>
        );
      },
      sortable: true
    },
    {
      key: 'monthlyAmount',
      header: 'Monthly',
      accessor: (sub) => `$${sub.monthlyAmount}`,
      sortable: true
    },
    {
      key: 'paymentsMade',
      header: 'Payments',
      accessor: (sub) => (
        <div>
          <div>{sub.paymentsMade} payments</div>
          <div className="text-sm text-gray-500">${sub.totalPaid} total</div>
        </div>
      ),
      sortable: true
    },
    {
      key: 'nextPaymentDate',
      header: 'Next Payment',
      accessor: (sub) => {
        if (!sub.nextPaymentDate || sub.status !== 'active') {
          return <span className="text-gray-400">-</span>;
        }
        
        const date = new Date(sub.nextPaymentDate);
        const now = new Date();
        const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return (
          <div>
            <div>{date.toLocaleDateString()}</div>
            {daysUntil < 0 && (
              <div className="text-xs text-red-600 font-medium">
                {Math.abs(daysUntil)} days overdue
              </div>
            )}
            {daysUntil >= 0 && daysUntil <= 7 && (
              <div className="text-xs text-yellow-600 font-medium">
                Due in {daysUntil} days
              </div>
            )}
          </div>
        );
      },
      sortable: true
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (sub) => (
        <div className="flex items-center gap-2">
          {sub.status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700"
              onClick={() => {
                setSelectedSubscription(sub);
                setShowApproveModal(true);
              }}
            >
              Approve
            </Button>
          )}
          
          {sub.status === 'active' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-blue-600 hover:text-blue-700"
                onClick={() => {
                  setSelectedSubscription(sub);
                  setShowPauseModal(true);
                }}
              >
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  setSelectedSubscription(sub);
                  setShowCancelModal(true);
                }}
              >
                Cancel
              </Button>
            </>
          )}
          
          {sub.status === 'paused' && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700"
              onClick={() => handleResume(sub)}
            >
              Resume
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedSubscription(sub);
              setShowDetailsModal(true);
            }}
          >
            Details
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActive}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPending}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdueCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.monthlyRecurring}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              <XCircle className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCancelled}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start rounded-none border-b h-auto p-0">
              <TabsTrigger value="all" className="rounded-none px-6 py-3">
                All Subscriptions
              </TabsTrigger>
              <TabsTrigger value="active" className="rounded-none px-6 py-3">
                Active
              </TabsTrigger>
              <TabsTrigger value="pending" className="rounded-none px-6 py-3">
                Pending Approval
              </TabsTrigger>
              <TabsTrigger value="overdue" className="rounded-none px-6 py-3">
                Overdue
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="rounded-none px-6 py-3">
                Cancelled
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-0 p-6">
              <DataTable
                data={filteredSubscriptions}
                columns={columns}
                keyExtractor={(sub) => sub.id.toString()}
                emptyMessage={`No ${activeTab === 'all' ? '' : activeTab} subscriptions found`}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Subscription</DialogTitle>
            <DialogDescription>
              Approve subscription for {selectedSubscription?.shopName || selectedSubscription?.shopId}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">This will:</h4>
              <ul className="space-y-1 text-sm text-green-700">
                <li>• Activate the subscription immediately</li>
                <li>• Grant operational status to the shop</li>
                <li>• Set first payment due in 30 days</li>
                <li>• Send activation email to shop owner</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? 'Approving...' : 'Approve Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Cancel subscription for {selectedSubscription?.shopName || selectedSubscription?.shopId}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Cancellation Reason
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full p-2 border rounded-lg"
                rows={3}
                placeholder="Enter reason for cancellation..."
              />
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">Warning:</h4>
              <ul className="space-y-1 text-sm text-red-700">
                <li>• Shop will lose operational status immediately</li>
                <li>• Cannot issue rewards or process redemptions</li>
                <li>• Shop can resubscribe at any time</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={actionLoading}>
              Keep Active
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>
              {actionLoading ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Modal */}
      <Dialog open={showPauseModal} onOpenChange={setShowPauseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pause Subscription</DialogTitle>
            <DialogDescription>
              Pause subscription for {selectedSubscription?.shopName || selectedSubscription?.shopId}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Pausing will:</h4>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>• Temporarily suspend billing</li>
                <li>• Maintain operational status for 30 days</li>
                <li>• Allow shop to resume anytime</li>
                <li>• Send notification to shop owner</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseModal(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handlePause} disabled={actionLoading}>
              {actionLoading ? 'Pausing...' : 'Pause Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
          </DialogHeader>
          
          {selectedSubscription && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Shop ID</label>
                  <p className="font-medium">{selectedSubscription.shopId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="font-medium capitalize">{selectedSubscription.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Monthly Amount</label>
                  <p className="font-medium">${selectedSubscription.monthlyAmount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="font-medium">{selectedSubscription.subscriptionType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrolled Date</label>
                  <p className="font-medium">{new Date(selectedSubscription.enrolledAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Activated Date</label>
                  <p className="font-medium">
                    {selectedSubscription.activatedAt 
                      ? new Date(selectedSubscription.activatedAt).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payments Made</label>
                  <p className="font-medium">{selectedSubscription.paymentsMade}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Paid</label>
                  <p className="font-medium">${selectedSubscription.totalPaid}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Next Payment</label>
                  <p className="font-medium">
                    {selectedSubscription.nextPaymentDate 
                      ? new Date(selectedSubscription.nextPaymentDate).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Payment</label>
                  <p className="font-medium">
                    {selectedSubscription.lastPaymentDate 
                      ? new Date(selectedSubscription.lastPaymentDate).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
              </div>
              
              {selectedSubscription.cancellationReason && (
                <div className="pt-4 border-t">
                  <label className="text-sm font-medium text-gray-500">Cancellation Reason</label>
                  <p className="mt-1">{selectedSubscription.cancellationReason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}