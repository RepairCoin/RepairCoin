'use client';

import React, { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  type: 'reward' | 'redemption' | 'purchase' | 'tier_bonus';
  amount: number;
  customerAddress?: string;
  customerName?: string;
  repairAmount?: number;
  status: 'completed' | 'failed' | 'pending';
  createdAt: string;
  failureReason?: string;
  totalCost?: number;
  paymentMethod?: string;
}

interface TransactionsTabProps {
  shopId: string;
  initialFilter?: 'all' | 'rewards' | 'redemptions' | 'purchases' | 'failed';
}

interface TransactionStats {
  totalRewards: number;
  totalRedemptions: number;
  totalPurchases: number;
  failedCount: number;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ shopId, initialFilter = 'all' }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'rewards' | 'redemptions' | 'purchases' | 'failed'>(initialFilter);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<TransactionStats>({
    totalRewards: 0,
    totalRedemptions: 0,
    totalPurchases: 0,
    failedCount: 0
  });
  const limit = 20;

  useEffect(() => {
    setFilter(initialFilter);
    setPage(1);
  }, [initialFilter]);

  useEffect(() => {
    loadTransactions();
  }, [page, filter]);

  const calculateStats = (transactionsList: Transaction[]) => {
    const stats: TransactionStats = {
      totalRewards: 0,
      totalRedemptions: 0,
      totalPurchases: 0,
      failedCount: 0
    };

    transactionsList.forEach(t => {
      if (t.status === 'failed') {
        stats.failedCount++;
      } else if (t.status === 'completed') {
        if (t.type === 'reward' || t.type === 'tier_bonus') {
          stats.totalRewards += t.amount;
        } else if (t.type === 'redemption') {
          stats.totalRedemptions += t.amount;
        } else if (t.type === 'purchase') {
          stats.totalPurchases += t.amount;
        }
      }
    });

    setStats(stats);
  };

  const loadTransactions = async () => {
    setLoading(true);
    
    try {
      // Get shop auth token
      const shopToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      
      if (!shopToken) {
        console.error('No shop authentication token found');
        setTransactions([]);
        setLoading(false);
        return;
      }
      
      // Fetch real transaction data
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/transactions?page=${page}&limit=${limit}${filter !== 'all' ? `&type=${filter}` : ''}`
        , {
          headers: {
            'Authorization': `Bearer ${shopToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Transactions API response:', result);
        const transactions = result.data?.transactions || [];
        
        // Transform the data to match our interface
        const transformedTransactions = transactions.map((t: any) => {
          // Debug log to see what we're getting
          console.log('Raw transaction data:', t);
          
          return {
            id: t.id,
            type: t.type || (t.transaction_type === 'issue_reward' ? 'reward' : t.transaction_type),
            amount: t.amount || t.token_amount,
            customerAddress: t.customer_address || t.recipient_address,
            customerName: t.customer_name || t.customerName,
            repairAmount: t.repair_amount || t.repairAmount,
            status: t.status || 'completed',
            createdAt: t.createdAt || t.created_at || t.timestamp,
            failureReason: t.failure_reason || t.error_message || t.failureReason,
            totalCost: t.totalCost || t.total_cost,
            paymentMethod: t.paymentMethod || t.payment_method
          };
        });

        setTransactions(transformedTransactions);
        calculateStats(transformedTransactions);
        setTotalPages(result.data?.totalPages || 1);
      } else {
        // If endpoint doesn't exist, try alternative endpoints
        const purchases = await fetchPurchaseHistory();
        const rewards = await fetchRewardHistory();
        const redemptions = await fetchRedemptionHistory();
        
        const allTransactions = [
          ...purchases.map((p: any) => ({
            id: p.id,
            type: 'purchase' as const,
            amount: p.amount,
            status: p.status || 'completed' as const,
            createdAt: p.createdAt,
            totalCost: p.totalCost,
            paymentMethod: p.paymentMethod
          })),
          ...rewards.map((r: any) => ({
            id: r.id,
            type: r.is_tier_bonus ? 'tier_bonus' as const : 'reward' as const,
            amount: r.amount,
            customerAddress: r.customer_address,
            repairAmount: r.repair_amount,
            status: r.status || 'completed' as const,
            createdAt: r.created_at
          })),
          ...redemptions.map((r: any) => ({
            id: r.id,
            type: 'redemption' as const,
            amount: r.amount,
            customerAddress: r.customer_address,
            status: r.status || 'completed' as const,
            createdAt: r.created_at
          }))
        ];

        // Apply filter
        const filtered = filter === 'all' 
          ? allTransactions
          : filter === 'failed'
          ? allTransactions.filter(t => t.status === 'failed')
          : allTransactions.filter(t => {
              if (filter === 'rewards') return t.type === 'reward' || t.type === 'tier_bonus';
              if (filter === 'redemptions') return t.type === 'redemption';
              if (filter === 'purchases') return t.type === 'purchase';
              return true;
            });

        // Sort by date
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Calculate stats before pagination
        calculateStats(filtered);

        // Paginate
        const startIndex = (page - 1) * limit;
        const paginatedTransactions = filtered.slice(startIndex, startIndex + limit);

        setTransactions(paginatedTransactions);
        setTotalPages(Math.ceil(filtered.length / limit));
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseHistory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/history/${shopId}`);
      if (response.ok) {
        const result = await response.json();
        return (result.data?.purchases || []).map((p: any) => ({
          ...p,
          createdAt: p.createdAt || p.created_at
        }));
      }
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    }
    return [];
  };

  const fetchRewardHistory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/rewards/history`);
      if (response.ok) {
        const result = await response.json();
        return result.data?.rewards || [];
      }
    } catch (error) {
      console.error('Error fetching reward history:', error);
    }
    return [];
  };

  const fetchRedemptionHistory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/redemptions/history`);
      if (response.ok) {
        const result = await response.json();
        return result.data?.redemptions || [];
      }
    } catch (error) {
      console.error('Error fetching redemption history:', error);
    }
    return [];
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reward': 
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      case 'tier_bonus':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z" clipRule="evenodd" />
          </svg>
        );
      case 'redemption':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        );
      case 'purchase':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'reward': return 'Reward Issued';
      case 'tier_bonus': return 'Tier Bonus';
      case 'redemption': return 'Customer Redemption';
      case 'purchase': return 'Credit Purchase';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reward': return 'text-green-500 bg-green-500';
      case 'tier_bonus': return 'text-yellow-500 bg-yellow-500';
      case 'redemption': return 'text-red-500 bg-red-500';
      case 'purchase': return 'text-blue-500 bg-blue-500';
      default: return 'text-gray-500 bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': 
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 bg-opacity-10 text-green-500 border border-green-500 border-opacity-20">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            Completed
          </span>
        );
      case 'failed': 
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500 bg-opacity-10 text-red-500 border border-red-500 border-opacity-20">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            Failed
          </span>
        );
      case 'pending': 
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500 bg-opacity-10 text-yellow-500 border border-yellow-500 border-opacity-20">
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
            Pending
          </span>
        );
      default: 
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500 bg-opacity-10 text-gray-500 border border-gray-500 border-opacity-20">
            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
            {status}
          </span>
        );
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'N/A';
      }
      
      // Format the date in a more readable way
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      return date.toLocaleString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'N/A';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Rewards</p>
              <p className="text-2xl font-bold text-[#FFCC00] mt-1">{stats.totalRewards} RCN</p>
            </div>
            <div className="w-12 h-12 bg-green-500 bg-opacity-20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Redemptions</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{stats.totalRedemptions} RCN</p>
            </div>
            <div className="w-12 h-12 bg-red-500 bg-opacity-20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Credits Purchased</p>
              <p className="text-2xl font-bold text-blue-500 mt-1">{stats.totalPurchases}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 bg-opacity-20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Failed Transactions</p>
              <p className="text-2xl font-bold text-yellow-500 mt-1">{stats.failedCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500 bg-opacity-20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-[#FFCC00] to-[#FFA500] bg-opacity-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Transaction History</h2>
            </div>
            <span className="text-sm text-gray-400">
              {transactions.length} {filter === 'all' ? 'total' : filter} transactions
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-800 h-24 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg font-medium">No transactions found</p>
            <p className="text-gray-500 text-sm mt-2">Transactions will appear here once they are processed</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-6 hover:bg-[#1A1A1A] transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeColor(transaction.type)} bg-opacity-20`}>
                      <div className={getTypeColor(transaction.type)}>
                        {getTypeIcon(transaction.type)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white text-lg">
                          {getTypeLabel(transaction.type)}
                        </h3>
                        {getStatusBadge(transaction.status)}
                      </div>
                      <div className="space-y-1 text-sm">
                        {transaction.customerAddress && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{transaction.customerName || formatAddress(transaction.customerAddress)}</span>
                          </div>
                        )}
                        {transaction.repairAmount && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            <span>Repair: ${transaction.repairAmount}</span>
                          </div>
                        )}
                        {transaction.type === 'purchase' && transaction.totalCost && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span>Total: ${transaction.totalCost.toFixed(2)}</span>
                            {transaction.paymentMethod && (
                              <span className="text-[#FFCC00]">• {transaction.paymentMethod.toUpperCase()}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-500 text-xs mt-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatDate(transaction.createdAt)}</span>
                        </div>
                      </div>
                      {transaction.failureReason && (
                        <div className="mt-3 p-3 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 rounded-lg">
                          <p className="text-sm text-red-400 flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {transaction.failureReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className={`text-2xl font-bold ${
                      transaction.type === 'redemption' ? 'text-red-500' : 'text-[#FFCC00]'
                    }`}>
                      {transaction.type === 'redemption' ? '-' : '+'}
                      {transaction.amount}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {transaction.type === 'purchase' ? 'Credits' : 'RCN'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-800 flex justify-between items-center bg-[#0D0D0D]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-[#1C1C1C] text-gray-400 rounded-lg hover:bg-[#252525] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-700"
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-medium transition-all ${
                      page === pageNum
                        ? 'bg-[#FFCC00] text-black shadow-lg shadow-yellow-500/25'
                        : 'bg-[#1C1C1C] text-gray-400 hover:bg-[#252525] hover:text-white border border-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-[#1C1C1C] text-gray-400 rounded-lg hover:bg-[#252525] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-700"
            >
              Next
              <svg className="w-5 h-5 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Failed Transactions Summary */}
      {filter === 'failed' && stats.failedCount > 0 && (
        <div className="mt-6 bg-gradient-to-br from-[#1C1C1C] to-[#252525] border border-red-500 border-opacity-30 rounded-2xl p-6">
          <div className="flex items-start">
            <div className="w-12 h-12 bg-red-500 bg-opacity-20 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-500 mb-3">Failed Transactions Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">Total Failed</p>
                  <p className="text-2xl font-bold text-red-500 mt-1">{stats.failedCount}</p>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">Common Cause</p>
                  <p className="text-white font-medium mt-1">Insufficient Balance</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-lg">
                <p className="text-yellow-500 font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Pro Tip: Enable auto-purchase to prevent failed tier bonus transactions
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {transactions.length > 0 && (
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 bg-gradient-to-br from-[#1C1C1C] to-[#252525] text-gray-400 rounded-lg hover:text-white transition-all border border-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button className="px-4 py-2 bg-gradient-to-br from-[#1C1C1C] to-[#252525] text-gray-400 rounded-lg hover:text-white transition-all border border-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};