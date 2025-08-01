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
}

interface TransactionsTabProps {
  shopId: string;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ shopId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'rewards' | 'redemptions' | 'purchases' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    loadTransactions();
  }, [page, filter]);

  const loadTransactions = async () => {
    setLoading(true);
    
    try {
      // Fetch real transaction data
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/transactions?page=${page}&limit=${limit}${filter !== 'all' ? `&type=${filter}` : ''}`
      );

      if (response.ok) {
        const result = await response.json();
        const transactions = result.data?.transactions || [];
        
        // Transform the data to match our interface
        const transformedTransactions = transactions.map((t: any) => ({
          id: t.id,
          type: t.type || (t.transaction_type === 'issue_reward' ? 'reward' : t.transaction_type),
          amount: t.amount || t.token_amount,
          customerAddress: t.customer_address || t.recipient_address,
          customerName: t.customer_name,
          repairAmount: t.repair_amount,
          status: t.status || 'completed',
          createdAt: t.created_at || t.createdAt,
          failureReason: t.failure_reason || t.error_message
        }));

        setTransactions(transformedTransactions);
        setTotalPages(result.data?.totalPages || 1);
      } else {
        // If endpoint doesn't exist, try alternative endpoints
        const purchases = await fetchPurchaseHistory();
        const rewards = await fetchRewardHistory();
        const redemptions = await fetchRedemptionHistory();
        
        const allTransactions = [
          ...purchases.map((p: any) => ({
            id: p.id,
            type: 'purchase',
            amount: p.amount,
            status: p.status,
            createdAt: p.createdAt
          })),
          ...rewards.map((r: any) => ({
            id: r.id,
            type: r.is_tier_bonus ? 'tier_bonus' : 'reward',
            amount: r.amount,
            customerAddress: r.customer_address,
            repairAmount: r.repair_amount,
            status: r.status || 'completed',
            createdAt: r.created_at
          })),
          ...redemptions.map((r: any) => ({
            id: r.id,
            type: 'redemption',
            amount: r.amount,
            customerAddress: r.customer_address,
            status: r.status || 'completed',
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
      case 'reward': return '🎁';
      case 'tier_bonus': return '🏆';
      case 'redemption': return '💸';
      case 'purchase': return '💰';
      default: return '📝';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'reward': return 'Reward Issued';
      case 'tier_bonus': return 'Tier Bonus';
      case 'redemption': return 'Customer Redemption';
      case 'purchase': return 'RCN Purchase';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="flex flex-wrap gap-2">
          {['all', 'rewards', 'redemptions', 'purchases', 'failed'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => {
                setFilter(filterType as any);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === filterType
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              {filterType === 'failed' && ' ❌'}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getTypeIcon(transaction.type)}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {getTypeLabel(transaction.type)}
                      </h3>
                      <div className="text-sm text-gray-600 mt-1">
                        {transaction.customerAddress && (
                          <p>
                            Customer: {transaction.customerName || formatAddress(transaction.customerAddress)}
                          </p>
                        )}
                        {transaction.repairAmount && (
                          <p>Repair Amount: ${transaction.repairAmount}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {transaction.failureReason && (
                        <p className="text-sm text-red-600 mt-2">
                          Failed: {transaction.failureReason}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      transaction.type === 'redemption' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.type === 'redemption' ? '-' : '+'}{transaction.amount} RCN
                    </p>
                    <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold ${
                      getStatusColor(transaction.status)
                    }`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Failed Transactions Summary */}
      {filter === 'failed' && transactions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-red-900 mb-4">Failed Transactions Summary</h3>
          <div className="space-y-2 text-sm">
            <p className="text-red-700">
              Total failed transactions: {transactions.filter(t => t.status === 'failed').length}
            </p>
            <p className="text-red-700">
              Most common failure: Insufficient RCN balance
            </p>
            <p className="text-red-700 font-medium mt-3">
              💡 Tip: Set up auto-purchase to avoid failed tier bonuses
            </p>
          </div>
        </div>
      )}
    </div>
  );
};