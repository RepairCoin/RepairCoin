'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  PauseCircle,
  RefreshCw,
  X
} from 'lucide-react';
import apiClient from '@/services/api/client';

interface Subscription {
  id: number;
  shopId: string;
  shopName?: string;
  status: 'pending' | 'active' | 'cancelled' | 'paused' | 'defaulted';
  monthlyAmount: number;
  subscriptionType: string;
  billingMethod?: 'credit_card' | 'ach' | 'wire' | 'crypto';
  billingReference?: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  enrolledAt: string;
  activatedAt?: string;
  cancelledAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  cancellationReason?: string;
  pauseReason?: string;
  notes?: string;
  createdBy?: string;
  isActive: boolean;
  daysOverdue?: number;
}

interface SubscriptionStats {
  totalActive: number;
  totalPending: number;
  totalPaused: number;
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
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Modal states
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const calculateStats = useCallback((subs: Subscription[]) => {
    const stats: SubscriptionStats = {
      totalActive: subs.filter(s => s.status === 'active').length,
      totalPending: subs.filter(s => s.status === 'pending').length,
      totalPaused: subs.filter(s => s.status === 'paused').length,
      totalCancelled: subs.filter(s => s.status === 'cancelled').length,
      totalRevenue: subs.reduce((sum, s) => sum + s.totalPaid, 0),
      monthlyRecurring: subs.filter(s => s.status === 'active').reduce((sum, s) => sum + s.monthlyAmount, 0),
      overdueCount: subs.filter(s => s.daysOverdue && s.daysOverdue > 0).length
    };
    setStats(stats);
  }, []);

  const loadSubscriptions = useCallback(async (syncFromStripe = false) => {
    try {
      if (syncFromStripe) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      // Add sync parameter to fetch latest status from Stripe (disabled by default for performance)
      const response = await apiClient.get('/admin/subscription/subscriptions', {
        params: syncFromStripe ? { sync: 'true' } : {}
      });

      if (response.success) {
        const subs = response.data || [];
        setSubscriptions(subs);
        calculateStats(subs);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [calculateStats]);

  const handleSync = async () => {
    await loadSubscriptions(true);
  };

  const filterSubscriptions = useCallback((tab: string) => {
    let filtered: Subscription[] = [];

    switch (tab) {
      case 'active':
        filtered = subscriptions.filter(s => s.status === 'active');
        break;
      case 'pending':
        filtered = subscriptions.filter(s => s.status === 'pending');
        break;
      case 'paused':
        filtered = subscriptions.filter(s => s.status === 'paused');
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
  }, [subscriptions]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    filterSubscriptions(activeTab);
  }, [subscriptions, activeTab, filterSubscriptions]);

  const handleApprove = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);

      await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/approve`,
        {
          nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        }
      );

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

      await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/cancel`,
        {
          reason: cancellationReason || 'Cancelled by administrator'
        }
      );

      setShowCancelModal(false);
      setCancellationReason('');
      // Sync after canceling to get latest status from Stripe
      await loadSubscriptions(true);
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

      await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/pause`
      );

      setShowPauseModal(false);
      setSelectedSubscription(null);
      // Sync after pausing to get latest status from Stripe
      await loadSubscriptions(true);
    } catch (error) {
      console.error('Error pausing subscription:', error);
      alert('Failed to pause subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);

      // First, try to sync from Stripe to ensure we have the latest status
      console.log('Syncing subscription from Stripe before resume...');
      try {
        const syncData = await apiClient.post(
          `/admin/subscription/subscriptions/${selectedSubscription.id}/sync`
        );

        console.log('Sync result:', syncData);

        // If sync shows it's already active, just reload and show success
        if (syncData.data?.newStatus === 'active') {
          await loadSubscriptions();
          setShowResumeModal(false);
          setSelectedSubscription(null);
          alert('Subscription was already active in Stripe. Status updated successfully.');
          return;
        }
      } catch (syncError) {
        console.warn('Sync failed, continuing with resume:', syncError);
      }

      // Now attempt to resume
      await apiClient.post(
        `/admin/subscription/subscriptions/${selectedSubscription.id}/resume`
      );

      setShowResumeModal(false);
      setSelectedSubscription(null);
      // Sync after resuming to get latest status from Stripe
      await loadSubscriptions(true);
    } catch (error) {
      console.error('Error resuming subscription:', error);
      alert('Failed to resume subscription');
    } finally {
      setActionLoading(false);
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
        if (isNaN(date.getTime())) {
          return <span className="text-gray-400">-</span>;
        }

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
              onClick={() => {
                setSelectedSubscription(sub);
                setShowResumeModal(true);
              }}
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
    <div className="space-y-4 md:space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <Card className="border-2 border-[#FFCC00]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalActive}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#FFCC00]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalPending}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#FFCC00]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Paused</CardTitle>
              <PauseCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalPaused}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#FFCC00]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{stats.overdueCount}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#FFCC00] col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Monthly Recurring</CardTitle>
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">${stats.monthlyRecurring}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#FFCC00]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">${stats.totalRevenue}</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#FFCC00]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Cancelled</CardTitle>
              <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalCancelled}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription Tabs */}
      <Card className="border-2 border-[#FFCC00]">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b-2 border-[#FFCC00] bg-transparent">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <TabsList className="inline-flex justify-start rounded-none h-auto p-0 bg-transparent border-none w-full sm:w-auto min-w-max">
                  <TabsTrigger
                    value="all"
                    className="rounded-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm data-[state=active]:bg-[#FFCC00] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:rounded-tl-lg transition-all whitespace-nowrap"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="active"
                    className="rounded-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm data-[state=active]:bg-[#FFCC00] data-[state=active]:text-black data-[state=active]:font-semibold transition-all whitespace-nowrap"
                  >
                    Active
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending"
                    className="rounded-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm data-[state=active]:bg-[#FFCC00] data-[state=active]:text-black data-[state=active]:font-semibold transition-all whitespace-nowrap"
                  >
                    Pending
                  </TabsTrigger>
                  <TabsTrigger
                    value="paused"
                    className="rounded-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm data-[state=active]:bg-[#FFCC00] data-[state=active]:text-black data-[state=active]:font-semibold transition-all whitespace-nowrap"
                  >
                    Paused
                  </TabsTrigger>
                  <TabsTrigger
                    value="overdue"
                    className="rounded-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm data-[state=active]:bg-[#FFCC00] data-[state=active]:text-black data-[state=active]:font-semibold transition-all whitespace-nowrap"
                  >
                    Overdue
                  </TabsTrigger>
                  <TabsTrigger
                    value="cancelled"
                    className="rounded-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm data-[state=active]:bg-[#FFCC00] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:rounded-tr-lg transition-all whitespace-nowrap"
                  >
                    Cancelled
                  </TabsTrigger>
                </TabsList>
              </div>

              <Button
                onClick={handleSync}
                disabled={syncing || loading}
                variant="outline"
                size="sm"
                className="mx-2 my-2 sm:my-0 sm:mr-4 bg-[#FFCC00] text-black border-[#FFCC00] hover:bg-[#FFD700] hover:border-[#FFD700] transition-colors text-xs sm:text-sm font-semibold whitespace-nowrap flex-shrink-0"
              >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync from Stripe'}</span>
                <span className="sm:hidden">{syncing ? 'Sync...' : 'Sync'}</span>
              </Button>
            </div>

            <TabsContent value={activeTab} className="mt-0 p-3 sm:p-6">
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
      {showApproveModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Approve Subscription
              </p>
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Approve subscription for <span className="text-white font-semibold">{selectedSubscription.shopName || selectedSubscription.shopId}</span>?
              </p>

              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">This will:</h4>
                <ul className="space-y-1 text-sm text-green-300">
                  <li>• Activate the subscription immediately</li>
                  <li>• Grant operational status to the shop</li>
                  <li>• Set first payment due in 30 days</li>
                  <li>• Send activation email to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-3xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Approving...' : 'Approve Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Cancel Subscription
              </p>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-gray-300">
                Cancel subscription for <span className="text-white font-semibold">{selectedSubscription.shopName || selectedSubscription.shopId}</span>?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full p-3 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter reason for cancellation..."
                />
              </div>

              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <h4 className="font-semibold text-red-400 mb-2">Warning:</h4>
                <ul className="space-y-1 text-sm text-red-300">
                  <li>• Shop will lose operational status immediately</li>
                  <li>• Cannot issue rewards or process redemptions</li>
                  <li>• Shop can resubscribe at any time</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Keep Active
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-3xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Pause Subscription
              </p>
              <button
                onClick={() => setShowPauseModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Pause subscription for <span className="text-white font-semibold">{selectedSubscription.shopName || selectedSubscription.shopId}</span>?
              </p>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">Pausing will:</h4>
                <ul className="space-y-1 text-sm text-blue-300">
                  <li>• Temporarily suspend billing</li>
                  <li>• Maintain operational status for 30 days</li>
                  <li>• Allow shop to resume anytime</li>
                  <li>• Send notification to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPauseModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-3xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Pausing...' : 'Pause Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Modal */}
      {showResumeModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Resume Subscription
              </p>
              <button
                onClick={() => setShowResumeModal(false)}
                disabled={actionLoading}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">
                Resume subscription for <span className="text-white font-semibold">{selectedSubscription.shopName || selectedSubscription.shopId}</span>?
              </p>

              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">Resuming will:</h4>
                <ul className="space-y-1 text-sm text-green-300">
                  <li>• Reactivate billing immediately</li>
                  <li>• Restore full operational status</li>
                  <li>• Allow shop to issue rewards and redemptions</li>
                  <li>• Send confirmation notification to shop owner</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowResumeModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResume}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-3xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Resuming...' : 'Resume Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl transform transition-all">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Subscription Details
              </p>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="border-b border-gray-700 pb-6">
                  <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Shop Name</label>
                      <p className="text-white font-medium">{selectedSubscription.shopName || selectedSubscription.shopId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Shop ID</label>
                      <p className="text-white font-medium">{selectedSubscription.shopId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                      <p className="text-white font-medium capitalize">{selectedSubscription.status}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Subscription Type</label>
                      <p className="text-white font-medium">{selectedSubscription.subscriptionType}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-b border-gray-700 pb-6">
                  <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                    Payment Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Monthly Amount</label>
                      <p className="text-white font-medium">${selectedSubscription.monthlyAmount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Payments Made</label>
                      <p className="text-white font-medium">{selectedSubscription.paymentsMade}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Total Paid</label>
                      <p className="text-white font-medium">${selectedSubscription.totalPaid}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Next Payment</label>
                      <p className="text-white font-medium">
                        {selectedSubscription.nextPaymentDate && !isNaN(new Date(selectedSubscription.nextPaymentDate).getTime())
                          ? new Date(selectedSubscription.nextPaymentDate).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Last Payment</label>
                      <p className="text-white font-medium">
                        {selectedSubscription.lastPaymentDate && !isNaN(new Date(selectedSubscription.lastPaymentDate).getTime())
                          ? new Date(selectedSubscription.lastPaymentDate).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline Information */}
                <div className={selectedSubscription.cancellationReason ? "border-b border-gray-700 pb-6" : ""}>
                  <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                    Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Enrolled Date</label>
                      <p className="text-white font-medium">
                        {selectedSubscription.enrolledAt && !isNaN(new Date(selectedSubscription.enrolledAt).getTime())
                          ? new Date(selectedSubscription.enrolledAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Activated Date</label>
                      <p className="text-white font-medium">
                        {selectedSubscription.activatedAt && !isNaN(new Date(selectedSubscription.activatedAt).getTime())
                          ? new Date(selectedSubscription.activatedAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
                          : '-'}
                      </p>
                    </div>
                    {selectedSubscription.cancelledAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Cancelled Date</label>
                        <p className="text-white font-medium">
                          {!isNaN(new Date(selectedSubscription.cancelledAt).getTime())
                            ? new Date(selectedSubscription.cancelledAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
                            : '-'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancellation Information */}
                {selectedSubscription.cancellationReason && (
                  <div>
                    <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                      Cancellation Information
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Cancellation Reason</label>
                      <p className="text-white">{selectedSubscription.cancellationReason}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}