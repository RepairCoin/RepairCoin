'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { 
  CheckCircle, Clock, AlertCircle, Zap, RefreshCw, AlertTriangle, 
  DollarSign, Users, TrendingUp, Settings, History, Send, Shield,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Eye, Edit
} from 'lucide-react';
import { 
  getRCGMetrics, 
  getTreasuryAnalytics, 
  manualTokenTransfer, 
  bulkMintTokens,
  adjustTokenPricing,
  getCurrentPricing,
  getPricingHistory,
  emergencyFreeze,
  emergencyUnfreeze,
  getFreezeStatus,
  getFreezeAuditHistory
} from '@/services/api/admin';
import { WorkingChart } from '@/components/admin/charts/WorkingChart';

interface TreasuryStats {
  totalSupply: number | string;
  totalSold: number;
  totalRevenue: number;
  circulatingSupply?: number;
  warnings?: {
    hasDiscrepancies: boolean;
    customersWithMissingTokens: number;
    totalMissingTokens: number;
    message: string;
  };
}

interface RCGMetrics {
  totalSupply: string;
  circulatingSupply: string;
  allocations: Record<string, string>;
  shopTierDistribution: {
    standard: number;
    premium: number;
    elite: number;
    none: number;
    total: number;
  };
  revenueImpact: {
    standardRevenue: number;
    premiumRevenue: number;
    eliteRevenue: number;
    totalRevenue: number;
    discountsGiven: number;
  };
}

interface PricingData {
  standard: { tier: string; pricePerRcn: number; discountPercentage: number; updatedAt: string; updatedBy: string; };
  premium: { tier: string; pricePerRcn: number; discountPercentage: number; updatedAt: string; updatedBy: string; };
  elite: { tier: string; pricePerRcn: number; discountPercentage: number; updatedAt: string; updatedBy: string; };
}

interface AnalyticsData {
  revenue: Array<{ date: string; total_revenue: number; total_rcn_sold: number; transaction_count: number; }>;
  shopGrowth: Array<{ date: string; new_shops: number; }>;
  tokenDistribution: Array<{ date: string; tokens_issued: number; tokens_redeemed: number; }>;
  currentMetrics: any;
  tierDistribution: any;
}

export const AdvancedTreasuryTab: React.FC = () => {
  const { generateAdminToken } = useAdminDashboard();
  
  // Main tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'rcg' | 'analytics' | 'operations' | 'pricing'>('overview');
  
  // Data state
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  const [rcgMetrics, setRcgMetrics] = useState<RCGMetrics | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [pricingHistory, setPricingHistory] = useState<any[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | '60d' | '90d'>('30d');
  
  // Modal state
  const [showManualTransfer, setShowManualTransfer] = useState(false);
  const [showBulkMint, setShowBulkMint] = useState(false);
  const [showPricingAdjust, setShowPricingAdjust] = useState(false);
  const [showEmergencyFreeze, setShowEmergencyFreeze] = useState(false);
  const [showEmergencyUnfreeze, setShowEmergencyUnfreeze] = useState(false);
  const [freezeStatus, setFreezeStatus] = useState<any>(null);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  
  // Form state
  const [manualTransferForm, setManualTransferForm] = useState({
    customerAddress: '',
    amount: '',
    reason: ''
  });
  const [bulkMintForm, setBulkMintForm] = useState({
    recipients: '',
    amount: '',
    reason: ''
  });
  const [pricingForm, setPricingForm] = useState({
    tier: 'standard' as 'standard' | 'premium' | 'elite',
    newPrice: '',
    reason: ''
  });
  const [freezeReason, setFreezeReason] = useState('');

  useEffect(() => {
    loadAllData();
    loadFreezeStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    } else if (activeTab === 'pricing') {
      loadPricing();
    }
  }, [activeTab, analyticsPeriod]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const token = await generateAdminToken();
      if (!token) throw new Error('Authentication failed');

      // Load basic treasury stats
      const treasuryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (treasuryResponse.ok) {
        const treasuryResult = await treasuryResponse.json();
        setTreasuryStats(treasuryResult.data);
      }

      // Load RCG metrics
      try {
        const rcgResult = await getRCGMetrics();
        setRcgMetrics(rcgResult.data);
        if (rcgResult.warning) {
          toast.warning(`⚠️ ${rcgResult.warning}`, { duration: 5000 });
        }
      } catch (error) {
        console.error('Error loading RCG metrics:', error);
      }
    } catch (error) {
      console.error('Error loading treasury data:', error);
      toast.error('Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      // Get admin token first to ensure authentication
      const token = await generateAdminToken();
      if (!token) {
        throw new Error('Authentication failed - no admin token available');
      }

      const response = await getTreasuryAnalytics(analyticsPeriod);
      
      // Handle different response formats from the API
      let analyticsData = null;
      if (response?.data) {
        analyticsData = response.data;
      } else if (response) {
        analyticsData = response;
      }

      // Validate the analytics data structure
      if (analyticsData && typeof analyticsData === 'object') {
        // Ensure required arrays exist with defaults
        const processedData = {
          revenue: Array.isArray(analyticsData.revenue) ? analyticsData.revenue : [],
          shopGrowth: Array.isArray(analyticsData.shopGrowth) ? analyticsData.shopGrowth : [],
          tokenDistribution: Array.isArray(analyticsData.tokenDistribution) ? analyticsData.tokenDistribution : [],
          currentMetrics: analyticsData.currentMetrics || null,
          tierDistribution: analyticsData.tierDistribution || null,
          period: analyticsData.period || analyticsPeriod,
          daysBack: analyticsData.daysBack || 30
        };

        setAnalyticsData(processedData);
      } else {
        setAnalyticsData(null);
        toast.error('Analytics data received in unexpected format');
      }
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        toast.error('Authentication failed. Please reconnect your wallet.');
      } else if (error?.response?.status === 500) {
        toast.error('Server error loading analytics. Please try again.');
      } else if (error?.message?.includes('Authentication failed')) {
        toast.error('Authentication failed. Please reconnect your wallet.');
      } else {
        toast.error('Failed to load analytics data');
      }
      
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadPricing = async () => {
    try {
      const [pricingResult, historyResult] = await Promise.all([
        getCurrentPricing(),
        getPricingHistory(undefined, 20)
      ]);
      setPricingData(pricingResult.data);
      setPricingHistory(historyResult.data);
    } catch (error) {
      console.error('Error loading pricing data:', error);
      toast.error('Failed to load pricing data');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    if (activeTab === 'analytics') await loadAnalytics();
    if (activeTab === 'pricing') await loadPricing();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleManualTransfer = async () => {
    try {
      const result = await manualTokenTransfer({
        customerAddress: manualTransferForm.customerAddress,
        amount: parseFloat(manualTransferForm.amount),
        reason: manualTransferForm.reason
      });
      
      toast.success(`Successfully transferred ${manualTransferForm.amount} RCN to ${manualTransferForm.customerAddress}`);
      setShowManualTransfer(false);
      setManualTransferForm({ customerAddress: '', amount: '', reason: '' });
      await loadAllData();
    } catch (error) {
      console.error('Error processing manual transfer:', error);
      toast.error('Failed to process manual transfer');
    }
  };

  const handleBulkMint = async () => {
    try {
      const recipients = bulkMintForm.recipients.split('\n').map(addr => addr.trim()).filter(addr => addr);
      
      const result = await bulkMintTokens({
        recipients,
        amount: parseFloat(bulkMintForm.amount),
        reason: bulkMintForm.reason
      });
      
      toast.success(`Bulk mint completed: ${result.data.successCount}/${result.data.totalRecipients} successful`);
      setShowBulkMint(false);
      setBulkMintForm({ recipients: '', amount: '', reason: '' });
      await loadAllData();
    } catch (error) {
      console.error('Error processing bulk mint:', error);
      toast.error('Failed to process bulk mint');
    }
  };

  const handlePricingAdjust = async () => {
    try {
      const result = await adjustTokenPricing({
        tier: pricingForm.tier,
        newPrice: parseFloat(pricingForm.newPrice),
        reason: pricingForm.reason
      });
      
      toast.success(`Successfully updated ${pricingForm.tier} tier pricing to $${pricingForm.newPrice}`);
      setShowPricingAdjust(false);
      setPricingForm({ tier: 'standard', newPrice: '', reason: '' });
      await loadPricing();
    } catch (error) {
      console.error('Error adjusting pricing:', error);
      toast.error('Failed to adjust pricing');
    }
  };

  const loadFreezeStatus = async () => {
    try {
      const [statusResponse, auditResponse] = await Promise.all([
        getFreezeStatus(),
        getFreezeAuditHistory(20)
      ]);
      
      if (statusResponse.success) {
        setFreezeStatus(statusResponse.data);
      }
      
      if (auditResponse.success) {
        setAuditHistory(auditResponse.data.auditHistory);
      }
    } catch (error) {
      console.error('Error loading freeze status:', error);
    }
  };

  const handleEmergencyFreeze = async () => {
    try {
      const response = await emergencyFreeze(freezeReason);
      
      if (response.success) {
        toast.error('🚨 Emergency freeze executed successfully');
        await loadFreezeStatus(); // Refresh freeze status
      } else {
        toast.error('❌ Emergency freeze partially failed');
      }
      
      setShowEmergencyFreeze(false);
      setFreezeReason('');
    } catch (error) {
      console.error('Error processing emergency freeze:', error);
      toast.error('Failed to process emergency freeze');
    }
  };

  const handleEmergencyUnfreeze = async () => {
    try {
      const response = await emergencyUnfreeze(freezeReason);
      
      if (response.success) {
        toast.success('✅ Emergency freeze lifted successfully');
        await loadFreezeStatus(); // Refresh freeze status
      } else {
        toast.error('❌ Emergency unfreeze partially failed');
      }
      
      setShowEmergencyUnfreeze(false);
      setFreezeReason('');
    } catch (error) {
      console.error('Error processing emergency unfreeze:', error);
      toast.error('Failed to process emergency unfreeze');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'percent', 
      minimumFractionDigits: 1,
      maximumFractionDigits: 1 
    }).format(num / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-400">Loading treasury data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Advanced Treasury Management</h1>
        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {refreshing && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span className="hidden xs:inline">Refresh Data</span>
            <span className="xs:hidden">Refresh</span>
          </button>
          {freezeStatus?.isFrozen ? (
            <button
              onClick={() => setShowEmergencyUnfreeze(true)}
              className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Lift Emergency Freeze</span>
              <span className="sm:hidden">Unfreeze</span>
            </button>
          ) : (
            <button
              onClick={() => setShowEmergencyFreeze(true)}
              className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Emergency Freeze</span>
              <span className="sm:hidden">Freeze</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      {treasuryStats?.warnings?.hasDiscrepancies && (
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-yellow-300 mb-1">Token Discrepancy Detected</h3>
              <p className="text-yellow-200">{treasuryStats.warnings.message}</p>
              <p className="text-sm text-yellow-300 mt-1">
                Total missing: {formatNumber(treasuryStats.warnings.totalMissingTokens)} RCN
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Freeze Status Banner */}
      {freezeStatus?.isFrozen && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-300 mb-1">🚨 EMERGENCY FREEZE ACTIVE</h3>
              <p className="text-red-200 mb-2">
                Critical treasury operations are currently frozen. 
                Frozen components: {freezeStatus.frozenComponents?.join(', ') || 'All systems'}
              </p>
              {freezeStatus.lastFreezeAction && (
                <div className="text-sm text-red-300">
                  <p>Initiated: {new Date(freezeStatus.lastFreezeAction.timestamp).toLocaleString()}</p>
                  <p>By: {freezeStatus.lastFreezeAction.admin_address}</p>
                  <p>Reason: {freezeStatus.lastFreezeAction.reason}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowEmergencyUnfreeze(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Lift Freeze
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-gray-800 rounded-xl p-1 overflow-x-auto">
        <div className="flex space-x-1 min-w-max sm:min-w-0">
          {[
            { id: 'overview', label: 'Overview', icon: DollarSign },
            { id: 'rcg', label: 'RCG Metrics', icon: PieChart },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'operations', label: 'Operations', icon: Settings },
            { id: 'pricing', label: 'Pricing', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 sm:flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && treasuryStats && (
        <div className="space-y-4 sm:space-y-6">
          {/* Treasury Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-4 sm:p-6 border border-blue-700">
              <div className="text-2xl sm:text-3xl mb-2">💎</div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(treasuryStats.totalRevenue)}</p>
              <p className="text-xs sm:text-sm text-blue-400 mt-1">From shop purchases</p>
            </div>

            <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-4 sm:p-6 border border-green-700">
              <div className="text-2xl sm:text-3xl mb-2">🏪</div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">RCN Sold to Shops</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{formatNumber(treasuryStats.totalSold)} RCN</p>
              <p className="text-xs sm:text-sm text-green-400 mt-1">Available for rewards</p>
            </div>

            <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-4 sm:p-6 border border-purple-700">
              <div className="text-2xl sm:text-3xl mb-2">🎁</div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Circulating Supply</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{formatNumber(treasuryStats.circulatingSupply || 0)} RCN</p>
              <p className="text-xs sm:text-sm text-purple-400 mt-1">In customer wallets</p>
            </div>

            <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-xl p-4 sm:p-6 border border-orange-700">
              <div className="text-2xl sm:text-3xl mb-2">⚠️</div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Discrepancies</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{treasuryStats.warnings?.customersWithMissingTokens || 0}</p>
              <p className="text-xs sm:text-sm text-orange-400 mt-1">Customers affected</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rcg' && rcgMetrics && (
        <div className="space-y-4 sm:space-y-6">
          {/* RCG Token Overview */}
          <div className="bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-700">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-4 sm:mb-6">RCG Token Distribution</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-4 sm:p-6 border border-purple-700">
                <div className="text-2xl sm:text-3xl mb-2">💜</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Supply</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{formatNumber(parseInt(rcgMetrics.totalSupply))} RCG</p>
                <p className="text-xs text-purple-400 mt-1">Fixed supply</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-xl p-4 sm:p-6 border border-indigo-700">
                <div className="text-2xl sm:text-3xl mb-2">🔄</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Circulating Supply</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{formatNumber(parseInt(rcgMetrics.circulatingSupply))} RCG</p>
                <p className="text-xs text-indigo-400 mt-1">Available for trading</p>
              </div>

              <div className="bg-gradient-to-br from-pink-900 to-pink-800 rounded-xl p-4 sm:p-6 border border-pink-700">
                <div className="text-2xl sm:text-3xl mb-2">🏪</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Shops</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.total}</p>
                <p className="text-xs text-pink-400 mt-1">Active partners</p>
              </div>
            </div>
          </div>

          {/* Shop Tier Distribution */}
          <div className="bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-700">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-3 sm:mb-4">Shop Tier Distribution</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-green-700">
                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🥉</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Standard Tier</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.standard}</p>
                <p className="text-xs text-gray-500">10K-49K RCG</p>
              </div>

              <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-blue-700">
                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🥈</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Premium Tier</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.premium}</p>
                <p className="text-xs text-blue-400">50K-199K RCG</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-yellow-700">
                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🥇</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Elite Tier</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.elite}</p>
                <p className="text-xs text-yellow-400">200K+ RCG</p>
              </div>

              <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-red-700">
                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">❌</div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">No Tier</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.none}</p>
                <p className="text-xs text-red-400">&lt;10K RCG</p>
              </div>
            </div>
          </div>

          {/* Revenue Impact */}
          <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Revenue Impact by Tier (30 days)</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Standard Tier Revenue</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.standardRevenue)}</p>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Premium Tier Revenue</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.premiumRevenue)}</p>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Elite Tier Revenue</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.eliteRevenue)}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-6 border border-green-700">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.totalRevenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Discounts Given</p>
                    <p className="text-xl font-bold text-red-400">-{formatCurrency(rcgMetrics.revenueImpact.discountsGiven)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Analytics Controls */}
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">Treasury Analytics</h2>
              <div className="flex items-center gap-2 sm:gap-4">
                <label className="text-xs sm:text-sm text-gray-400">Period:</label>
                <select
                  value={analyticsPeriod}
                  onChange={(e) => setAnalyticsPeriod(e.target.value as any)}
                  className="bg-gray-700 text-white rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-600 flex-1 sm:flex-initial"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="60d">Last 60 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-400">Loading analytics...</span>
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Row 1: Revenue Trends - Full Width */}
              {analyticsData.revenue && analyticsData.revenue.length > 0 ? (
                <WorkingChart
                  data={analyticsData.revenue.map(item => ({
                    date: item.date,
                    value: item.total_revenue || 0,
                    label: `$${(item.total_revenue || 0).toFixed(2)}`
                  }))}
                  title="Treasury Revenue Trends"
                  color="#22C55E"
                  formatValue={(value) => `$${value.toFixed(2)}`}
                  height={300}
                  type="bar"
                />
              ) : (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">Treasury Revenue Trends</h3>
                  <div className="text-center py-8 text-gray-500">
                    No revenue data available for the selected period
                  </div>
                </div>
              )}

              {/* Row 2: RCN Sales Volume - Full Width */}
              {analyticsData.revenue && analyticsData.revenue.length > 0 ? (
                <WorkingChart
                  data={analyticsData.revenue.map(item => ({
                    date: item.date,
                    value: item.total_rcn_sold || 0,
                    label: `${item.total_rcn_sold || 0} RCN`
                  }))}
                  title="Treasury RCN Sales Volume"
                  color="#4F9EF8"
                  formatValue={(value) => `${Math.round(value)} RCN`}
                  height={300}
                  type="bar"
                />
              ) : (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">Treasury RCN Sales Volume</h3>
                  <div className="text-center py-8 text-gray-500">
                    No RCN sales data available for the selected period
                  </div>
                </div>
              )}

              {/* Row 3: Token Flow Analysis - Full Width */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">Token Flow Analysis</h3>
                {analyticsData.tokenDistribution && analyticsData.tokenDistribution.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.tokenDistribution.slice(0, 7).map((item, index) => {
                      const maxIssued = Math.max(...analyticsData.tokenDistribution.map(d => d.tokens_issued || 0));
                      const maxRedeemed = Math.max(...analyticsData.tokenDistribution.map(d => d.tokens_redeemed || 0));
                      const issuedWidth = item.tokens_issued > 0 && maxIssued > 0 ? Math.min((item.tokens_issued / maxIssued) * 100, 100) : 0;
                      const redeemedWidth = item.tokens_redeemed > 0 && maxRedeemed > 0 ? Math.min((item.tokens_redeemed / maxRedeemed) * 100, 100) : 0;
                      
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{new Date(item.date).toLocaleDateString()}</span>
                            <span className="text-gray-300">
                              +{Math.round(item.tokens_issued || 0)} / -{Math.round(item.tokens_redeemed || 0)}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <div className="flex-1 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${issuedWidth}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <div className="flex-1 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${redeemedWidth}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No token distribution data available for the selected period
                  </div>
                )}
              </div>

              {/* Row 4: Shop Growth - Full Width */}
              {analyticsData.shopGrowth && analyticsData.shopGrowth.length > 0 ? (
                <WorkingChart
                  data={analyticsData.shopGrowth.map(item => ({
                    date: item.date,
                    value: item.new_shops || 0,
                    label: `${item.new_shops || 0} shops`
                  }))}
                  title="Treasury Shop Growth"
                  color="#A855F7"
                  formatValue={(value) => `${Math.round(value)} shops`}
                  height={300}
                  type="bar"
                />
              ) : (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">Treasury Shop Growth</h3>
                  <div className="text-center py-8 text-gray-500">
                    No shop growth data available for the selected period
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-white mb-2">No Analytics Data Available</h3>
                <p className="text-gray-400 mb-4">
                  Analytics data is not available for the selected period. This could be due to:
                </p>
                <ul className="text-gray-500 text-sm space-y-1 mb-6">
                  <li>• No transactions in the selected time period</li>
                  <li>• Database connectivity issues</li>
                  <li>• Missing required data tables</li>
                  <li>• Authentication problems</li>
                </ul>
                <button
                  onClick={loadAnalytics}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Operations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {/* Manual Token Transfer */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <Send className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold text-white">Manual Transfer</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Send tokens directly to a customer address for discrepancy resolution.
              </p>
              <button
                onClick={() => setShowManualTransfer(true)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Transfer Tokens
              </button>
            </div>

            {/* Bulk Token Minting */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-bold text-white">Bulk Mint</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Mass mint tokens for campaigns, airdrops, or promotional activities.
              </p>
              <button
                onClick={() => setShowBulkMint(true)}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                Bulk Mint
              </button>
            </div>

            {/* Price Adjustment */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-bold text-white">Adjust Pricing</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Update RCN pricing for different shop tiers with full audit trail.
              </p>
              <button
                onClick={() => setShowPricingAdjust(true)}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Adjust Pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="space-y-6">
          {/* Current Pricing Display */}
          {pricingData && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-6">Current Tier Pricing</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(pricingData).map(([tier, data]) => (
                  <div key={tier} className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-white capitalize">{tier} Tier</h4>
                      <button
                        onClick={() => {
                          setPricingForm({ tier: tier as any, newPrice: data.pricePerRcn.toString(), reason: '' });
                          setShowPricingAdjust(true);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-400">Price per RCN</p>
                        <p className="text-xl font-bold text-white">{formatCurrency(data.pricePerRcn)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400">Discount</p>
                        <p className="text-lg font-semibold text-green-400">{data.discountPercentage}%</p>
                      </div>
                      
                      <div className="pt-2 border-t border-gray-700">
                        <p className="text-xs text-gray-500">Last updated: {new Date(data.updatedAt).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">By: {data.updatedBy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing History */}
          {pricingHistory.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-6">Pricing History</h3>
              
              <div className="space-y-3">
                {pricingHistory.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-white capitalize">{entry.tier}</span>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-400">{formatCurrency(entry.oldPrice)}</span>
                          <ArrowUpRight className="w-4 h-4 text-gray-500" />
                          <span className="text-green-400">{formatCurrency(entry.newPrice)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{new Date(entry.updatedAt).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">By {entry.updatedBy}</p>
                      </div>
                    </div>
                    {entry.reason && (
                      <p className="text-sm text-gray-400 mt-2">{entry.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Components */}
      
      {/* Manual Transfer Modal */}
      {showManualTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Manual Token Transfer</h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Customer Address</label>
                <input
                  type="text"
                  value={manualTransferForm.customerAddress}
                  onChange={(e) => setManualTransferForm(prev => ({ ...prev, customerAddress: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Amount (RCN)</label>
                <input
                  type="number"
                  value={manualTransferForm.amount}
                  onChange={(e) => setManualTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Reason</label>
                <textarea
                  value={manualTransferForm.reason}
                  onChange={(e) => setManualTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Explain the reason for this transfer..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowManualTransfer(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleManualTransfer}
                disabled={!manualTransferForm.customerAddress || !manualTransferForm.amount || !manualTransferForm.reason}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Mint Modal */}
      {showBulkMint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Bulk Token Mint</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipients (one address per line, max 100)
                </label>
                <textarea
                  value={bulkMintForm.recipients}
                  onChange={(e) => setBulkMintForm(prev => ({ ...prev, recipients: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500"
                  placeholder="0x123...&#10;0x456...&#10;0x789..."
                  rows={6}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount per Recipient (RCN)</label>
                <input
                  type="number"
                  value={bulkMintForm.amount}
                  onChange={(e) => setBulkMintForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Reason</label>
                <textarea
                  value={bulkMintForm.reason}
                  onChange={(e) => setBulkMintForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500"
                  placeholder="Describe the campaign or reason for bulk minting..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowBulkMint(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkMint}
                disabled={!bulkMintForm.recipients || !bulkMintForm.amount || !bulkMintForm.reason}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                Mint Tokens
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Adjustment Modal */}
      {showPricingAdjust && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Adjust Tier Pricing</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tier</label>
                <select
                  value={pricingForm.tier}
                  onChange={(e) => setPricingForm(prev => ({ ...prev, tier: e.target.value as any }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricingForm.newPrice}
                  onChange={(e) => setPricingForm(prev => ({ ...prev, newPrice: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500"
                  placeholder="0.10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Reason for Change</label>
                <textarea
                  value={pricingForm.reason}
                  onChange={(e) => setPricingForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500"
                  placeholder="Explain the reason for this pricing change..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowPricingAdjust(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handlePricingAdjust}
                disabled={!pricingForm.newPrice || !pricingForm.reason}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                Update Pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Freeze Modal */}
      {showEmergencyFreeze && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold text-red-400 mb-3 sm:mb-4">🚨 Emergency Treasury Freeze</h3>
            
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-300 text-sm">
                <strong>Warning:</strong> This will initiate emergency protocols and alert all administrators. 
                Only use in case of security incidents or critical issues.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Emergency Reason</label>
              <textarea
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-red-500"
                placeholder="Describe the emergency situation requiring treasury freeze..."
                rows={4}
              />
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowEmergencyFreeze(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyFreeze}
                disabled={!freezeReason}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                🚨 Emergency Freeze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Unfreeze Modal */}
      {showEmergencyUnfreeze && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-3 sm:mb-4">✅ Lift Emergency Freeze</h3>
            <p className="text-gray-300 mb-4">
              This will restore normal treasury operations. Please provide a reason for lifting the emergency freeze.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason for lifting freeze *
              </label>
              <textarea
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white resize-none"
                rows={3}
                placeholder="Describe why the emergency freeze is being lifted..."
              />
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowEmergencyUnfreeze(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyUnfreeze}
                disabled={!freezeReason}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                ✅ Lift Emergency Freeze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};