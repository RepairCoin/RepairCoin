'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import {
  Tag,
  BarChart3,
  TrendingUp,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Percent,
  Coins,
  Power,
  Trash2,
  Loader2,
  Pencil,
  Trophy,
} from 'lucide-react';
import apiClient from '@/services/api/client';
import { toast } from 'react-hot-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PromoCodeSummary {
  total_codes: number;
  active_codes: number;
  shops_with_codes: number;
  total_uses: number;
  total_bonus_issued: number;
  avg_uses_per_code: number;
}

interface PromoCode {
  id: number;
  code: string;
  name: string;
  shop_name: string;
  shop_id: string;
  bonus_type: 'fixed' | 'percentage';
  bonus_value: number;
  is_active: boolean;
  times_used: number;
  total_bonus_issued: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

interface TopCode {
  code: string;
  name: string;
  shop_id: string;
  shop_name: string;
  times_used: number;
  total_bonus_issued: number;
}

interface EditForm {
  name: string;
  bonus_type: 'fixed' | 'percentage';
  bonus_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface StatCardData {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  colorClass: string;
  bgGradient: string;
}

export default function PromoCodesAnalyticsTab() {
  const [summary, setSummary] = useState<PromoCodeSummary | null>(null);
  const [allCodes, setAllCodes] = useState<PromoCode[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [topCodes, setTopCodes] = useState<TopCode[]>([]);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);
  const [editTarget, setEditTarget] = useState<PromoCode | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    bonus_type: 'fixed',
    bonus_value: 0,
    start_date: '',
    end_date: '',
    is_active: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAnalytics = async () => {
    try {
      // apiClient interceptor returns response.data directly
      // Backend returns: { success: true, data: { summary, topCodes } }
      const result = await apiClient.get('/admin/promo-codes/analytics');
      if (result?.success) {
        setSummary(result.data?.summary || null);
        setTopCodes(Array.isArray(result.data?.topCodes) ? result.data.topCodes : []);
      }
    } catch (err) {
      console.error('Error fetching promo code analytics:', err);
      setError('Failed to load analytics');
    }
  };

  const fetchAllCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      // API limit is max 100 per request
      // apiClient interceptor returns response.data directly
      // Backend returns: { success: true, data: promoCodes[] }
      const result = await apiClient.get('/admin/promo-codes', {
        params: { limit: 100, offset: 0 }
      });
      if (result?.success) {
        setAllCodes(Array.isArray(result.data) ? result.data : []);
      } else {
        setError('Failed to load promo codes');
      }
    } catch (err) {
      console.error('Error fetching promo codes:', err);
      setError('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAnalytics(), fetchAllCodes()]);
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  const handleToggleActive = async (code: PromoCode) => {
    setActioningId(code.id);
    try {
      const result = await apiClient.patch(`/admin/promo-codes/${code.id}/status`, {
        isActive: !code.is_active,
      });
      if (result?.success) {
        toast.success(code.is_active ? 'Promo code deactivated' : 'Promo code activated');
        await Promise.all([fetchAllCodes(), fetchAnalytics()]);
      } else {
        toast.error('Failed to update promo code');
      }
    } catch (err) {
      console.error('Error toggling promo code:', err);
      toast.error('Failed to update promo code');
    } finally {
      setActioningId(null);
    }
  };

  const openEdit = (code: PromoCode) => {
    setEditForm({
      name: code.name || '',
      bonus_type: code.bonus_type || 'fixed',
      bonus_value: code.bonus_value ?? 0,
      start_date: code.start_date ? code.start_date.slice(0, 10) : '',
      end_date: code.end_date ? code.end_date.slice(0, 10) : '',
      is_active: code.is_active,
    });
    setEditTarget(code);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const result = await apiClient.put(`/admin/promo-codes/${editTarget.id}`, editForm);
      if (result?.success) {
        toast.success('Promo code updated');
        setEditTarget(null);
        await Promise.all([fetchAllCodes(), fetchAnalytics()]);
      } else {
        toast.error('Failed to update promo code');
      }
    } catch (err) {
      console.error('Error updating promo code:', err);
      toast.error('Failed to update promo code');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActioningId(deleteTarget.id);
    try {
      const result = await apiClient.delete(`/admin/promo-codes/${deleteTarget.id}`);
      if (result?.success) {
        toast.success('Promo code deleted');
        setDeleteTarget(null);
        await Promise.all([fetchAllCodes(), fetchAnalytics()]);
      } else {
        toast.error('Failed to delete promo code');
      }
    } catch (err) {
      console.error('Error deleting promo code:', err);
      toast.error('Failed to delete promo code');
    } finally {
      setActioningId(null);
    }
  };

  const getPromoStatus = (promoCode: PromoCode): 'active' | 'scheduled' | 'expired' | 'deactivated' => {
    if (!promoCode.is_active) return 'deactivated';

    const now = new Date();
    const start = new Date(promoCode.start_date);
    const end = new Date(promoCode.end_date);

    if (now < start) return 'scheduled';
    if (now > end) return 'expired';
    return 'active';
  };

  const filterCodes = useCallback((filter: string, search: string) => {
    let filtered = [...allCodes];

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter((code) => getPromoStatus(code) === filter);
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (code) =>
          code.code.toLowerCase().includes(searchLower) ||
          code.name.toLowerCase().includes(searchLower) ||
          code.shop_name.toLowerCase().includes(searchLower) ||
          code.shop_id.toLowerCase().includes(searchLower)
      );
    }

    // Sort by usage (times_used) descending
    filtered.sort((a, b) => b.times_used - a.times_used);

    setFilteredCodes(filtered);
  }, [allCodes]);

  useEffect(() => {
    fetchAnalytics();
    fetchAllCodes();
  }, []);

  useEffect(() => {
    filterCodes(filterStatus, searchQuery);
  }, [allCodes, filterStatus, searchQuery, filterCodes]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (promoCode: PromoCode) => {
    const status = getPromoStatus(promoCode);

    const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
      active: {
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: CheckCircle,
      },
      scheduled: {
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: Clock,
      },
      expired: {
        color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        icon: AlertCircle,
      },
      deactivated: {
        color: 'bg-red-500/10 text-red-400 border-red-500/20',
        icon: XCircle,
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  const getStatCards = (): StatCardData[] => {
    if (!summary) return [];

    return [
      {
        title: 'Total Codes',
        value: summary.total_codes,
        subtitle: `${summary.active_codes} active`,
        icon: Tag,
        colorClass: 'text-yellow-400',
        bgGradient: 'from-yellow-500/20 to-yellow-600/10',
      },
      {
        title: 'Total Uses',
        value: (summary.total_uses || 0).toLocaleString(),
        subtitle: `Avg ${(Number(summary.avg_uses_per_code) || 0).toFixed(1)}/code`,
        icon: BarChart3,
        colorClass: 'text-blue-400',
        bgGradient: 'from-blue-500/20 to-blue-600/10',
      },
      {
        title: 'Bonus Issued',
        value: `${(summary.total_bonus_issued || 0).toLocaleString()} RCN`,
        subtitle: `Across ${summary.shops_with_codes} shops`,
        icon: TrendingUp,
        colorClass: 'text-emerald-400',
        bgGradient: 'from-emerald-500/20 to-emerald-600/10',
      },
    ];
  };

  // All Codes Table Columns
  const allCodesColumns: Column<PromoCode>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (code) => code.code,
      accessor: (code) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-[#FFCC00] to-yellow-600 flex items-center justify-center flex-shrink-0">
            <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{code.code}</p>
            <p className="text-xs text-gray-400 truncate">{code.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'shop',
      header: 'Shop',
      sortable: true,
      sortValue: (code) => code.shop_name,
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      accessor: (code) => (
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{code.shop_name}</p>
          <p className="text-xs text-gray-400 font-mono truncate">{code.shop_id}</p>
        </div>
      ),
    },
    {
      key: 'bonus',
      header: 'Bonus',
      sortable: true,
      sortValue: (code) => code.bonus_value || 0,
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      accessor: (code) => {
        // Handle null/undefined values
        if (!code.bonus_type || code.bonus_value == null) {
          return <span className="text-gray-500 text-sm">-</span>;
        }

        return (
          <div className="flex items-center gap-2">
            {code.bonus_type === 'fixed' ? (
              <Coins className="w-4 h-4 text-yellow-400" />
            ) : (
              <Percent className="w-4 h-4 text-blue-400" />
            )}
            <span className="text-sm font-medium text-white">
              {code.bonus_type === 'fixed'
                ? `${code.bonus_value} RCN`
                : `${code.bonus_value}%`}
            </span>
          </div>
        );
      },
    },
    {
      key: 'usage',
      header: 'Usage',
      sortable: true,
      sortValue: (code) => code.times_used,
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      accessor: (code) => (
        <div className="text-sm">
          <p className="text-white font-medium">{code.times_used} uses</p>
          <p className="text-purple-400 text-xs">{code.total_bonus_issued} RCN issued</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (code) => getPromoStatus(code),
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      accessor: (code) => getStatusBadge(code),
    },
    {
      key: 'validity',
      header: 'Valid Period',
      sortable: true,
      sortValue: (code) => new Date(code.end_date).getTime(),
      className: 'hidden xl:table-cell',
      headerClassName: 'hidden xl:table-cell',
      accessor: (code) => (
        <div className="text-sm">
          <p className="text-white">{formatDate(code.start_date)}</p>
          <p className="text-gray-400 text-xs">to {formatDate(code.end_date)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (code) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(code);
            }}
            disabled={actioningId === code.id}
            title={code.is_active ? 'Deactivate' : 'Activate'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
              code.is_active
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {actioningId === code.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5" />
            )}
            {code.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(code);
            }}
            title="Edit promo code"
            className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-400 border border-gray-700 hover:text-[#FFCC00] hover:border-[#FFCC00]/40 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(code);
            }}
            title="Delete promo code"
            className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-400 border border-gray-700 hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading promo codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Promo Code Analytics"
        subtitle="Monitor promo code performance across all shops"
      />

      {/* Statistics Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {getStatCards().map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`bg-gradient-to-br ${card.bgGradient} bg-[#212121] rounded-2xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {card.title}
                  </p>
                  <div className={`p-2 rounded-lg bg-black/30 ${card.colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
                <p className="text-xs text-gray-400">{card.subtitle}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Top Performing Codes */}
      {topCodes.length > 0 && (
        <div className="bg-[#212121] rounded-2xl border border-gray-700/50 p-4 md:p-6">
          <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
            <Trophy className="w-5 h-5 text-[#FFCC00]" />
            Top Performing Codes
          </h3>
          <div className="space-y-2">
            {topCodes.slice(0, 5).map((tc, i) => (
              <div
                key={`${tc.shop_id}-${tc.code}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#2a2a2a] border border-gray-700/40"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#FFCC00]/15 text-[#FFCC00] text-sm font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{tc.code}</p>
                  <p className="text-xs text-gray-400 truncate">{tc.shop_name || tc.shop_id}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-white">{tc.times_used} uses</p>
                  <p className="text-xs text-purple-400">
                    {Number(tc.total_bonus_issued || 0).toLocaleString()} RCN
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Promo Codes */}
      <div className="bg-[#212121] rounded-3xl">
        <div
          className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-3 md:py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-900 font-semibold">
            All Promo Codes
          </p>
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 border-b border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by code, name, or shop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#2F2F2F] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>

            {/* Filter and Refresh */}
            <div className="flex gap-2 sm:gap-3">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value)}>
                <SelectTrigger variant="dark" className="flex-1 sm:flex-none sm:w-auto text-sm">
                  <SelectValue placeholder="All Codes" />
                </SelectTrigger>
                <SelectContent variant="dark">
                  <SelectItem variant="dark" value="all">All Codes</SelectItem>
                  <SelectItem variant="dark" value="active">Active</SelectItem>
                  <SelectItem variant="dark" value="scheduled">Scheduled</SelectItem>
                  <SelectItem variant="dark" value="expired">Expired</SelectItem>
                  <SelectItem variant="dark" value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>

              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="px-3 sm:px-4 py-2 bg-[#FFCC00] text-black border border-yellow-500 rounded-3xl hover:bg-yellow-500 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 md:mx-6 mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="p-4 md:p-6">
          <DataTable
            data={filteredCodes}
            columns={allCodesColumns}
            keyExtractor={(code) => code.id.toString()}
            headerClassName="bg-gray-900/60 border-gray-800"
            emptyMessage={`No ${filterStatus === 'all' ? '' : filterStatus} promo codes found`}
            emptyIcon={<Tag className="w-12 h-12 text-gray-500 mx-auto mb-4" />}
            showPagination={true}
            itemsPerPage={10}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
                <Pencil className="w-5 h-5 text-[#FFCC00]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Edit promo code</h3>
                <p className="text-xs text-gray-400 font-mono">{editTarget.code}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Bonus Type</label>
                  <select
                    value={editForm.bonus_type}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, bonus_type: e.target.value as 'fixed' | 'percentage' }))
                    }
                    className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  >
                    <option value="fixed">Fixed (RCN)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Bonus Value</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.bonus_value}
                    onChange={(e) => setEditForm((f) => ({ ...f, bonus_value: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-600 text-[#FFCC00] focus:ring-[#FFCC00]"
                />
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 py-2.5 border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={savingEdit}
                className="flex-1 py-2.5 bg-[#FFCC00] hover:bg-yellow-500 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete promo code?</h3>
            </div>
            <p className="text-sm text-gray-300">
              This permanently deletes <span className="font-semibold text-white">{deleteTarget.code}</span>
              {deleteTarget.times_used > 0 && (
                <>
                  {' '}and its usage history (
                  <span className="text-red-400">{deleteTarget.times_used} uses</span>)
                </>
              )}
              . This cannot be undone. To keep the record, deactivate it instead.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actioningId === deleteTarget.id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actioningId === deleteTarget.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
