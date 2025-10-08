'use client';

import React, { useState, useEffect } from 'react';
// Icon components
const TagIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a4 4 0 014 4v5a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4z" />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ArrowTrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

interface PromoCodeSummary {
  total_codes: number;
  active_codes: number;
  shops_with_codes: number;
  total_uses: number;
  total_bonus_issued: number;
  avg_uses_per_code: number;
}

interface TopPromoCode {
  code: string;
  name: string;
  shop_id: string;
  shop_name: string;
  times_used: number;
  total_bonus_issued: number;
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

export default function PromoCodesAnalyticsTab() {
  const [summary, setSummary] = useState<PromoCodeSummary | null>(null);
  const [topCodes, setTopCodes] = useState<TopPromoCode[]>([]);
  const [allCodes, setAllCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchAnalytics();
    fetchAllCodes();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminAuthToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/promo-codes/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setSummary(data.data.summary);
      setTopCodes(data.data.topCodes || []);
    } catch (err) {
      console.error('Error fetching promo code analytics:', err);
      setError('Failed to load analytics');
    }
  };

  const fetchAllCodes = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminAuthToken');
      const offset = (page - 1) * itemsPerPage;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/promo-codes?limit=${itemsPerPage}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch promo codes');
      }

      const data = await response.json();
      
      if (page === 1) {
        setAllCodes(data.data || []);
      } else {
        setAllCodes(prev => [...prev, ...(data.data || [])]);
      }
      
      setHasMore((data.data || []).length === itemsPerPage);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching promo codes:', err);
      setError('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    fetchAllCodes(currentPage + 1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (promoCode: PromoCode) => {
    if (!promoCode.is_active) return 'text-gray-500';
    
    const now = new Date();
    const start = new Date(promoCode.start_date);
    const end = new Date(promoCode.end_date);
    
    if (now < start) return 'text-blue-600';
    if (now > end) return 'text-red-600';
    return 'text-green-600';
  };

  const getStatusText = (promoCode: PromoCode) => {
    if (!promoCode.is_active) return 'Deactivated';
    
    const now = new Date();
    const start = new Date(promoCode.start_date);
    const end = new Date(promoCode.end_date);
    
    if (now < start) return 'Scheduled';
    if (now > end) return 'Expired';
    return 'Active';
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Total Promo Codes</h3>
              <TagIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.total_codes}</p>
            <p className="text-sm text-gray-500 mt-2">
              <span className="text-green-600 font-medium">{summary.active_codes}</span> active
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Total Uses</h3>
              <ChartBarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{(summary.total_uses || 0).toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2">
              Avg {(summary.avg_uses_per_code || 0).toFixed(1)} uses per code
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Total Bonus Issued</h3>
              <ArrowTrendingUpIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{(summary.total_bonus_issued || 0).toLocaleString()} RCN</p>
            <p className="text-sm text-gray-500 mt-2">
              Across {summary.shops_with_codes} shops
            </p>
          </div>
        </div>
      )}

      {/* Top Performing Promo Codes */}
      {topCodes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Promo Codes</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Times Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Bonus
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCodes.map((code, index) => (
                  <tr key={`${code.code}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{code.code}</div>
                        <div className="text-sm text-gray-500">{code.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{code.shop_name}</div>
                      <div className="text-xs text-gray-500">{code.shop_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{(code.times_used || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(code.total_bonus_issued || 0).toLocaleString()} RCN
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Promo Codes */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Promo Codes</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bonus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valid Period
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allCodes.map((promoCode) => (
                <tr key={promoCode.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{promoCode.code}</div>
                      <div className="text-sm text-gray-500">{promoCode.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{promoCode.shop_name}</div>
                    <div className="text-xs text-gray-500">{promoCode.shop_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {promoCode.bonus_type === 'fixed' 
                        ? `${promoCode.bonus_value} RCN`
                        : `${promoCode.bonus_value}%`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{promoCode.times_used}</div>
                    <div className="text-xs text-gray-500">
                      {promoCode.total_bonus_issued} RCN issued
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getStatusColor(promoCode)}`}>
                      {getStatusText(promoCode)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(promoCode.start_date)} - {formatDate(promoCode.end_date)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}