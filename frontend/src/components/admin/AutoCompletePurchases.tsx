'use client';

import React, { useState, useEffect } from 'react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { toast } from 'react-hot-toast';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export const AutoCompletePurchases: React.FC = () => {
  const { generateAdminToken } = useAdminDashboard();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

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
    if (!confirm('Auto-complete all purchases pending for more than 30 minutes?')) {
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
        toast.success(
          <div>
            <p className="font-semibold">Auto-completion successful!</p>
            <p className="text-sm">{result.data.completedCount} purchases completed</p>
          </div>,
          { duration: 5000 }
        );
        
        // Refresh stats
        await fetchStats();
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
            <p>Pending >30 min: <span className="text-yellow-400 font-medium">{stats.old_pending}</span></p>
            <p>Pending >1 hour: <span className="text-orange-400 font-medium">{stats.very_old_pending}</span></p>
            <p>Total amount: <span className="text-white font-medium">{stats.total_amount_pending} RCN</span></p>
          </div>

          {parseInt(stats.old_pending) > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">Old Pending Purchases Detected</p>
                  <p className="text-gray-300 mt-1">
                    {stats.old_pending} purchases have been pending for over 30 minutes. 
                    These are likely successful payments with failed webhooks.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleAutoComplete}
          disabled={loading || parseInt(stats.old_pending) === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Processing...' : `Auto-Complete ${stats.old_pending} Purchases`}
        </button>
      </div>
    </div>
  );
};