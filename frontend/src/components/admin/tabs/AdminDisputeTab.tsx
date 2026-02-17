'use client';

// frontend/src/components/admin/tabs/AdminDisputeTab.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Store,
  Calendar,
  RefreshCw,
  BarChart2,
} from 'lucide-react';
import {
  getAdminDisputes,
  adminResolveDispute,
  type DisputeEntry,
  type AdminDisputeStats,
} from '@/services/api/noShow';

type DisputeFilter = 'pending' | 'approved' | 'rejected' | 'all';

export default function AdminDisputeTab() {
  const [disputes, setDisputes] = useState<DisputeEntry[]>([]);
  const [stats, setStats] = useState<AdminDisputeStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [filter, setFilter] = useState<DisputeFilter>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{
    disputeId: string;
    currentStatus: string | undefined;
  } | null>(null);
  const [resolution, setResolution] = useState<'approved' | 'rejected'>('approved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const loadDisputes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminDisputes(filter, undefined, 50, 0);
      setDisputes(data.disputes);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load admin disputes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full text-xs">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    if (resolutionNotes.trim().length < 10) {
      setResolveError('Admin notes are required (minimum 10 characters)');
      return;
    }

    setIsResolving(true);
    setResolveError('');

    try {
      await adminResolveDispute(resolveModal.disputeId, resolution, resolutionNotes);
      setResolveModal(null);
      setResolutionNotes('');
      await loadDisputes();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            'Failed to resolve dispute.'
          : 'Failed to resolve dispute.';
      setResolveError(errorMsg);
    } finally {
      setIsResolving(false);
    }
  };

  const FILTER_TABS: { key: DisputeFilter; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'approved', label: 'Approved', count: stats.approved },
    { key: 'rejected', label: 'Rejected', count: stats.rejected },
    { key: 'all', label: 'All', count: stats.total },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">No-Show Disputes</h2>
          <p className="text-zinc-400 mt-1">Platform-wide dispute management and arbitration</p>
        </div>
        <button
          onClick={loadDisputes}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-zinc-400" />
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Total</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-zinc-800 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 uppercase tracking-wide">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-300">{stats.pending}</p>
        </div>
        <div className="bg-zinc-800 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 uppercase tracking-wide">Approved</span>
          </div>
          <p className="text-2xl font-bold text-green-300">{stats.approved}</p>
        </div>
        <div className="bg-zinc-800 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400 uppercase tracking-wide">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-300">{stats.rejected}</p>
        </div>
      </div>

      {/* Alert for pending */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            <strong>{stats.pending}</strong> dispute{stats.pending !== 1 ? 's' : ''} awaiting shop
            review. Use admin arbitration to override if needed.
          </p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-800 rounded-xl">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              filter === tab.key
                ? 'bg-zinc-700 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-xs opacity-60">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Disputes List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No {filter !== 'all' ? filter : ''} disputes found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden"
            >
              {/* Main Row */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(dispute.disputeStatus)}
                      <span className="text-xs text-zinc-500">
                        Submitted {formatDate(dispute.disputeSubmittedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-300">
                          {dispute.customerName || formatAddress(dispute.customerAddress)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-300">{dispute.shopName || dispute.shopId}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-400">{formatDate(dispute.scheduledTime)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() =>
                        setResolveModal({
                          disputeId: dispute.id,
                          currentStatus: dispute.disputeStatus,
                        })
                      }
                      className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      Admin Override
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === dispute.id ? null : dispute.id)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      {expandedId === dispute.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === dispute.id && (
                <div className="border-t border-zinc-700 p-4 space-y-3 bg-zinc-800/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
                        Customer Reason
                      </p>
                      <p className="text-sm text-zinc-200 bg-zinc-700/50 rounded-lg p-3">
                        {dispute.disputeReason || '—'}
                      </p>
                    </div>
                    {dispute.disputeStatus !== 'pending' && (
                      <div>
                        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
                          Resolution Notes
                        </p>
                        <p className="text-sm text-zinc-200 bg-zinc-700/50 rounded-lg p-3">
                          {dispute.disputeResolutionNotes || '—'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          By:{' '}
                          {dispute.disputeResolvedBy?.startsWith('admin:')
                            ? `Admin (${dispute.disputeResolvedBy.replace('admin:', '').slice(0, 8)}...)`
                            : dispute.disputeResolvedBy === 'system_auto'
                              ? 'Auto-approved (system)'
                              : 'Shop'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs text-zinc-500">
                    <div>
                      <span className="block text-zinc-400 font-medium">Order ID</span>
                      <span className="font-mono">{dispute.orderId.slice(0, 12)}...</span>
                    </div>
                    <div>
                      <span className="block text-zinc-400 font-medium">Customer Tier</span>
                      <span className="capitalize">{dispute.customerTierAtTime || 'unknown'}</span>
                    </div>
                    <div>
                      <span className="block text-zinc-400 font-medium">Marked On</span>
                      <span>{formatDate(dispute.markedNoShowAt)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Admin Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Admin Arbitration</h3>
                <p className="text-sm text-zinc-400">Override shop decision</p>
              </div>
            </div>

            {resolveModal.currentStatus !== 'pending' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-300">
                  ⚠️ This dispute is already{' '}
                  <strong>{resolveModal.currentStatus}</strong>. Admin override will change the
                  decision.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Decision</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setResolution('approved')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    resolution === 'approved'
                      ? 'bg-green-500/20 border-green-500 text-green-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-green-500/50'
                  }`}
                >
                  Approve
                </button>
                <button
                  onClick={() => setResolution('rejected')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    resolution === 'rejected'
                      ? 'bg-red-500/20 border-red-500 text-red-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-500/50'
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Admin Notes *</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Explain the reason for this admin decision..."
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {resolveError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">{resolveError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setResolveModal(null)}
                className="flex-1 py-2.5 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isResolving ? 'Resolving...' : 'Confirm Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
