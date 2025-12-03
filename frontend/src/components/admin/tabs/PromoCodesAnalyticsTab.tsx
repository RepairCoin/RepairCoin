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
} from 'lucide-react';
import apiClient from '@/services/api/client';
import { toast } from 'react-hot-toast';

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

  const fetchAnalytics = async () => {
    try {
      // apiClient interceptor returns response.data directly
      // Backend returns: { success: true, data: { summary, topCodes } }
      const result = await apiClient.get('/admin/promo-codes/analytics');
      if (result?.success) {
        setSummary(result.data?.summary || null);
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
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#FFCC00] border border-gray-600 rounded-3xl text-black focus:outline-none focus:border-yellow-400 text-sm"
              >
                <option value="all">All Codes</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="deactivated">Deactivated</option>
              </select>

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
    </div>
  );
}
