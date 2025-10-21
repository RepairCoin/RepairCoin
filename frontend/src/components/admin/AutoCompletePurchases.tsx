'use client';

import React, { useState, useEffect } from 'react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { toast } from 'react-hot-toast';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTreasurySync } from '@/hooks/useTreasurySync';

export const AutoCompletePurchases: React.FC = () => {
  const { generateAdminToken } = useAdminDashboard();
  const { triggerRefresh, subscribeToRefresh } = useTreasurySync();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    fetchStats();
    
    // Subscribe to refresh events from other components
    const unsubscribe = subscribeToRefresh('auto-complete', fetchStats);
    return unsubscribe;
  }, [subscribeToRefresh]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const token = await generateAdminToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/purchases/pending-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleAutoComplete = async () => {
    if (!confirm('Verify with Stripe and auto-complete confirmed successful payments? Only purchases with successful Stripe payments will be completed.')) {
      return;
    }

    setLoading(true);
    try {
      const token = await generateAdminToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/purchases/auto-complete-old-purchases`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        const { completedCount, skippedCount, failedCount, failures } = result.data;
        
        if (skippedCount > 0 || failedCount > 0) {
          toast.success(
            <div>
              <p className="font-semibold">Stripe Verification Complete!</p>
              <p className="text-sm">{completedCount} verified & completed</p>
              {skippedCount > 0 && <p className="text-sm">{skippedCount} unverified payments skipped</p>}
              {failedCount > 0 && <p className="text-sm">{failedCount} failed</p>}
              <p className="text-xs text-blue-300 mt-1">Only confirmed Stripe payments completed</p>
            </div>,
            { duration: 8000 }
          );
          
          if (failures) {
            console.warn('Auto-complete failures:', failures);
          }
        } else {
          toast.success(
            <div>
              <p className="font-semibold">Stripe Verification Complete!</p>
              <p className="text-sm">{completedCount} verified purchases completed</p>
              <p className="text-xs text-blue-300 mt-1">All payments confirmed with Stripe</p>
            </div>,
            { duration: 6000 }
          );
        }
        
        // Refresh stats and notify other components
        await fetchStats();
        triggerRefresh('auto-complete');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to auto-complete purchases');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to auto-complete purchases');
    } finally {
      setLoading(false);
    }
  };

  if (loadingStats) {
    return <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
      <div className="h-6 bg-gray-700 rounded w-1/3"></div>
    </div>;
  }

  if (!stats || stats.total_pending === '0') {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Pending Purchase Auto-Complete</h3>
          </div>
          
          <div className="space-y-2 text-sm text-gray-400 mb-4">
            <p>Total pending: <span className="text-white font-medium">{stats.total_pending}</span></p>
            <p>Pending {'>'}30 min: <span className="text-yellow-400 font-medium">{stats.old_pending}</span></p>
            <p>Verifiable old pending: <span className="text-blue-400 font-medium">{stats.verifiable_old_pending || 0}</span></p>
            <p>No payment reference: <span className="text-red-400 font-medium">{stats.no_payment_reference || 0}</span></p>
            <p>Total amount: <span className="text-white font-medium">{stats.total_amount_pending} RCN</span></p>
          </div>

          {parseInt(stats.verifiable_old_pending || '0') > 0 && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-400 font-medium">Verifiable Pending Purchases</p>
                  <p className="text-gray-300 mt-1">
                    {stats.verifiable_old_pending} purchases can be verified with Stripe before auto-completion.
                    Only successful payments will be completed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {parseInt(stats.no_payment_reference || '0') > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Unverifiable Purchases</p>
                  <p className="text-gray-300 mt-1">
                    {stats.no_payment_reference} purchases have no payment reference and cannot be verified.
                    These likely abandoned checkouts - will not be auto-completed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleAutoComplete}
          disabled={loading || parseInt(stats.verifiable_old_pending || '0') === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Verifying with Stripe...' : `Verify & Complete ${stats.verifiable_old_pending || 0} Purchases`}
        </button>
      </div>
    </div>
  );
};