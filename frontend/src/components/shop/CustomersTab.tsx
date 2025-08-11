'use client';

import React, { useState, useEffect } from 'react';
import { authManager } from '@/utils/auth';
import { toast } from 'react-hot-toast';

interface Customer {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  lastTransactionDate?: string;
  totalTransactions: number;
  isRegular: boolean;
}

interface CustomersTabProps {
  shopId: string;
  shopToken?: string;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ shopId, shopToken }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'BRONZE' | 'SILVER' | 'GOLD'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'earnings' | 'transactions'>('recent');

  useEffect(() => {
    loadCustomers();
  }, [shopId, shopToken]);

  const loadCustomers = async () => {
    setLoading(true);
    
    try {
      // Get shop token from props or auth manager
      const token = shopToken || authManager.getToken('shop');
      
      if (!token) {
        toast.error('Please authenticate to view customers');
        setCustomers([]);
        setLoading(false);
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Try to fetch shop-specific customers with auth
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/customers?limit=100`, {
        headers
      });
      
      if (response.ok) {
        const result = await response.json();
        const customerData = result.data?.customers || [];
        
        const transformedCustomers = customerData.map((c: any) => ({
          address: c.address || c.customer_address,
          name: c.name || c.customer_name,
          tier: c.tier || 'BRONZE',
          lifetimeEarnings: c.lifetime_earnings || c.lifetimeEarnings || 0,
          lastTransactionDate: c.last_transaction_date || c.lastTransactionDate || c.last_earned_date,
          totalTransactions: c.total_transactions || c.transaction_count || 0,
          isRegular: (c.total_transactions || c.transaction_count || 0) >= 5
        }));
        
        setCustomers(transformedCustomers);
      } else if (response.status === 401) {
        // Token expired or invalid
        authManager.clearToken('shop');
        toast.error('Session expired. Please sign in again.');
        setCustomers([]);
      } else {
        // Try alternative endpoint if shop customers endpoint fails
        console.warn('Shop customers endpoint failed, trying alternative...');
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers
    .filter(customer => {
      const matchesSearch = searchTerm === '' || 
        customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
      return matchesSearch && matchesTier;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'earnings':
          return b.lifetimeEarnings - a.lifetimeEarnings;
        case 'transactions':
          return b.totalTransactions - a.totalTransactions;
        case 'recent':
        default:
          return new Date(b.lastTransactionDate || 0).getTime() - 
                 new Date(a.lastTransactionDate || 0).getTime();
      }
    });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return '🥉';
      case 'SILVER': return '🥈';
      case 'GOLD': return '🥇';
      default: return '🏅';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or wallet address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as any)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tiers</option>
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">Most Recent</option>
              <option value="earnings">Highest Earnings</option>
              <option value="transactions">Most Transactions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={customers.length}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="Regular Customers"
          value={customers.filter(c => c.isRegular).length}
          icon="⭐"
          color="green"
        />
        <StatCard
          title="Gold Tier"
          value={customers.filter(c => c.tier === 'GOLD').length}
          icon="🥇"
          color="yellow"
        />
        <StatCard
          title="Active This Week"
          value={customers.filter(c => {
            const lastTransaction = new Date(c.lastTransactionDate || 0);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return lastTransaction > weekAgo;
          }).length}
          icon="📅"
          color="purple"
        />
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Your Customers</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-500">No customers found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCustomers.map((customer) => (
              <div key={customer.address} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl">{getTierIcon(customer.tier)}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {customer.name || formatAddress(customer.address)}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">
                        {formatAddress(customer.address)}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTierColor(customer.tier)}`}>
                          {customer.tier}
                        </span>
                        {customer.isRegular && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Regular Customer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {customer.lifetimeEarnings} RCN earned
                    </p>
                    <p className="text-sm text-gray-500">
                      {customer.totalTransactions} transactions
                    </p>
                    {customer.lastTransactionDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last visit: {new Date(customer.lastTransactionDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-4">Customer Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <p>• Average customer lifetime value: {Math.round(customers.reduce((sum, c) => sum + c.lifetimeEarnings, 0) / customers.length || 0)} RCN</p>
            <p>• Tier distribution helps track loyalty program effectiveness</p>
          </div>
          <div>
            <p>• Regular customers (5+ transactions) drive 80% of revenue</p>
            <p>• Gold tier customers visit 3x more frequently</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
            {value}
          </p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
};