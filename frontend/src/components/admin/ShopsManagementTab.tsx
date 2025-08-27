'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Store,
  ChevronRight,
  Search,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  Coins,
  Wallet,
  Mail,
  Phone,
  Calendar,
  Eye,
  Edit,
  Power,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  Send
} from 'lucide-react';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { getContract, readContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';
import { createThirdwebClient } from 'thirdweb';
import { EditShopModal } from './EditShopModal';
import { ShopReviewModal } from './ShopReviewModal';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  active?: boolean;
  verified?: boolean;
  totalTokensIssued?: number;
  totalRedemptions?: number;
  crossShopEnabled?: boolean;
  cross_shop_enabled?: boolean;
  purchasedRcnBalance?: number;
  walletAddress?: string;
  wallet_address?: string;
  walletBalance?: number;
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
  suspended_at?: string;
  suspension_reason?: string;
  // Additional fields for UI
  monthlyVolume?: number;
  customerCount?: number;
  lastActivity?: string;
}

interface ShopsManagementTabProps {
  activeShops: Shop[];
  pendingShops: Shop[];
  rejectedShops?: Shop[];
  onApproveShop: (shopId: string) => Promise<void>;
  onRejectShop?: (shopId: string, reason?: string) => Promise<void>;
  onVerifyShop: (shopId: string) => Promise<void>;
  onSuspendShop: (shopId: string) => Promise<void>;
  onUnsuspendShop: (shopId: string) => Promise<void>;
  onEditShop?: (shop: Shop) => void;
  onMintBalance?: (shopId: string) => Promise<void>;
  onRefresh: () => void;
  generateAdminToken?: () => Promise<string | null>;
}

export const ShopsManagementTab: React.FC<ShopsManagementTabProps> = ({
  activeShops,
  pendingShops,
  rejectedShops = [],
  onApproveShop,
  onRejectShop,
  onVerifyShop,
  onSuspendShop,
  onUnsuspendShop,
  onEditShop,
  onMintBalance,
  onRefresh,
  generateAdminToken
}) => {
  const [viewMode, setViewMode] = useState<'all' | 'active' | 'pending' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; shop: Shop | null }>({ isOpen: false, shop: null });
  const [reviewModal, setReviewModal] = useState<{ isOpen: boolean; shop: Shop | null }>({ isOpen: false, shop: null });
  const [shopBalances, setShopBalances] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);

  // Fetch wallet balances
  useEffect(() => {
    const fetchBalances = async () => {
      const contract = getContract({
        client,
        chain: baseSepolia,
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      });

      const balances: Record<string, number> = {};
      const allShops = [...activeShops, ...pendingShops, ...rejectedShops];
      
      for (const shop of allShops) {
        const walletAddr = shop.walletAddress || shop.wallet_address;
        if (walletAddr) {
          try {
            const balance = await readContract({
              contract,
              method: "function balanceOf(address account) view returns (uint256)",
              params: [walletAddr as `0x${string}`],
            });
            balances[shop.shopId || shop.shop_id || ''] = Number(balance) / 10**18;
          } catch (error) {
            console.error(`Error fetching balance for shop ${shop.shopId}:`, error);
            balances[shop.shopId || shop.shop_id || ''] = 0;
          }
        }
      }
      
      setShopBalances(balances);
    };

    fetchBalances();
  }, [activeShops, pendingShops, rejectedShops]);

  // Combine all shops for unified view
  const allShops = [
    ...activeShops.map(s => ({ ...s, status: 'active' as const })),
    ...pendingShops.map(s => ({ ...s, status: 'pending' as const })),
    ...rejectedShops.map(s => ({ ...s, status: 'rejected' as const }))
  ];

  // Filter shops based on view mode and search
  const filteredShops = allShops.filter(shop => {
    // View mode filter
    if (viewMode !== 'all' && shop.status !== viewMode) return false;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const shopId = shop.shopId || shop.shop_id || '';
      const walletAddr = shop.walletAddress || shop.wallet_address || '';
      
      return (
        shop.name.toLowerCase().includes(term) ||
        shopId.toLowerCase().includes(term) ||
        shop.email?.toLowerCase().includes(term) ||
        walletAddr.toLowerCase().includes(term)
      );
    }
    
    return true;
  });

  const getStatusBadge = (shop: Shop & { status: string }) => {
    if (shop.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    
    if (shop.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3" />
          Pending Approval
        </span>
      );
    }

    // Active shop statuses
    const badges = [];
    
    if (shop.verified) {
      badges.push(
        <span key="verified" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <ShieldCheck className="w-3 h-3" />
          Verified
        </span>
      );
    }
    
    if (shop.active) {
      badges.push(
        <span key="active" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    } else if (shop.suspended_at) {
      badges.push(
        <span key="suspended" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" />
          Suspended
        </span>
      );
    }
    
    if (shop.crossShopEnabled || shop.cross_shop_enabled) {
      badges.push(
        <span key="crossshop" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <RefreshCw className="w-3 h-3" />
          Cross-Shop
        </span>
      );
    }
    
    return <div className="flex flex-wrap gap-2">{badges}</div>;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const handleAction = async (action: () => Promise<void>, successMessage: string) => {
    setIsProcessing(true);
    try {
      await action();
      toast.success(successMessage);
      onRefresh();
    } catch (error) {
      console.error('Action failed:', error);
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Shop Name', 'Shop ID', 'Status', 'Email', 'Phone', 'Wallet', 'Tokens Issued', 'Join Date'];
    const rows = filteredShops.map(shop => [
      shop.name,
      shop.shopId || shop.shop_id || '',
      shop.status,
      shop.email || '',
      shop.phone || '',
      shop.walletAddress || shop.wallet_address || '',
      (shop.totalTokensIssued || 0).toString(),
      formatDate(shop.joinDate || shop.join_date)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shops_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Shop data exported successfully');
  };

  // Statistics
  const stats = {
    total: allShops.length,
    active: activeShops.filter(s => s.active && s.verified).length,
    pending: pendingShops.length,
    rejected: rejectedShops.length,
    verified: activeShops.filter(s => s.verified).length,
    totalTokensIssued: activeShops.reduce((sum, s) => sum + (s.totalTokensIssued || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader 
        title="Shop Management"
        subtitle="Manage all shop applications and active shops"
        icon={Store}
      />

      {/* Main Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50">
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50 space-y-6">
          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'pending', 'rejected'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                  viewMode === mode 
                    ? 'bg-yellow-500 text-gray-900' 
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {mode === 'all' ? 'All Shops' : mode}
                {mode !== 'all' && (
                  <span className="ml-2 text-xs">
                    ({mode === 'active' ? stats.active : mode === 'pending' ? stats.pending : stats.rejected})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, email, or wallet address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Shop List */}
        <div className="p-6 space-y-4">
          {filteredShops.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No shops found matching your criteria</p>
            </div>
          ) : (
            filteredShops.map((shop) => {
              const shopId = shop.shopId || shop.shop_id || '';
              const isExpanded = expandedShopId === shopId;
              const walletAddr = shop.walletAddress || shop.wallet_address;
              
              return (
                <div
                  key={shopId}
                  className="bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all"
                >
                  <div 
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedShopId(isExpanded ? null : shopId)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                          <ChevronRight className="w-5 h-5 text-yellow-400 mt-1" />
                        </div>
                        
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                          <Store className="w-6 h-6 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-white mb-1">{shop.name}</h3>
                              <p className="text-sm text-gray-400 mb-3">ID: {shopId}</p>
                              {getStatusBadge(shop)}
                            </div>
                            
                            <div className="text-right">
                              {shop.status === 'active' && (
                                <>
                                  <div className="text-2xl font-bold text-yellow-400">
                                    {shop.totalTokensIssued || 0} RCN
                                  </div>
                                  <div className="text-xs text-gray-400">Tokens Issued</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-700/50 p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Contact Info */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase">Contact Information</h4>
                          {shop.email && (
                            <div className="flex items-center gap-3 text-gray-300">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{shop.email}</span>
                            </div>
                          )}
                          {shop.phone && (
                            <div className="flex items-center gap-3 text-gray-300">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{shop.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-gray-300">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">Joined: {formatDate(shop.joinDate || shop.join_date)}</span>
                          </div>
                        </div>

                        {/* Wallet Info */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase">Wallet & Balance</h4>
                          {walletAddr && (
                            <div className="flex items-center gap-3 text-gray-300">
                              <Wallet className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-mono">{formatAddress(walletAddr)}</span>
                            </div>
                          )}
                          {shop.status === 'active' && (
                            <>
                              <div className="flex items-center gap-3 text-gray-300">
                                <Coins className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  Purchased: {(shop.purchasedRcnBalance || 0).toFixed(2)} RCN
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-gray-300">
                                <TrendingUp className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  On-chain: {shopBalances[shopId]?.toFixed(2) || '0.00'} RCN
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-400 uppercase">Quick Actions</h4>
                          <div className="flex flex-wrap gap-2">
                            {shop.status === 'pending' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(() => onApproveShop(shopId), 'Shop approved successfully');
                                  }}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                  <CheckCircle className="w-3 h-3 inline mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewModal({ isOpen: true, shop });
                                  }}
                                  className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
                                >
                                  <Eye className="w-3 h-3 inline mr-1" />
                                  Review
                                </button>
                                {onRejectShop && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(() => onRejectShop(shopId), 'Shop rejected');
                                    }}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                  >
                                    <XCircle className="w-3 h-3 inline mr-1" />
                                    Reject
                                  </button>
                                )}
                              </>
                            )}
                            
                            {shop.status === 'active' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditModal({ isOpen: true, shop });
                                  }}
                                  className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors text-sm font-medium"
                                >
                                  <Edit className="w-3 h-3 inline mr-1" />
                                  Edit
                                </button>
                                
                                {!shop.verified && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(() => onVerifyShop(shopId), 'Shop verified successfully');
                                    }}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                  >
                                    <ShieldCheck className="w-3 h-3 inline mr-1" />
                                    Verify
                                  </button>
                                )}
                                
                                {shop.purchasedRcnBalance && shop.purchasedRcnBalance > 0 && onMintBalance && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(() => onMintBalance(shopId), 'Tokens minted to blockchain');
                                    }}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                  >
                                    <Send className="w-3 h-3 inline mr-1" />
                                    Mint {shop.purchasedRcnBalance} RCN
                                  </button>
                                )}
                                
                                {shop.active ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(() => onSuspendShop(shopId), 'Shop suspended');
                                    }}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                  >
                                    <ShieldOff className="w-3 h-3 inline mr-1" />
                                    Suspend
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(() => onUnsuspendShop(shopId), 'Shop unsuspended');
                                    }}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                  >
                                    <Power className="w-3 h-3 inline mr-1" />
                                    Unsuspend
                                  </button>
                                )}
                              </>
                            )}
                            
                            {shop.status === 'rejected' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewModal({ isOpen: true, shop });
                                  }}
                                  className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
                                >
                                  <Eye className="w-3 h-3 inline mr-1" />
                                  View Details
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(() => onApproveShop(shopId), 'Shop reconsidered and approved');
                                  }}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                  <RefreshCw className="w-3 h-3 inline mr-1" />
                                  Reconsider
                                </button>
                              </>
                            )}
                          </div>
                          
                          {shop.suspension_reason && (
                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                              <p className="text-xs text-red-400">
                                <strong>Reason:</strong> {shop.suspension_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {editModal.shop && generateAdminToken && (
        <EditShopModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, shop: null })}
          shop={editModal.shop}
          generateAdminToken={generateAdminToken}
          onRefresh={onRefresh}
        />
      )}
      
      {reviewModal.shop && (
        <ShopReviewModal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal({ isOpen: false, shop: null })}
          shop={reviewModal.shop}
          onApprove={(shopId) => {
            handleAction(() => onApproveShop(shopId), 'Shop approved successfully');
            setReviewModal({ isOpen: false, shop: null });
          }}
          onReject={(shopId, reason) => {
            if (onRejectShop) {
              handleAction(() => onRejectShop(shopId, reason), 'Shop rejected');
            }
            setReviewModal({ isOpen: false, shop: null });
          }}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
}> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]} bg-gray-800/50 backdrop-blur-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs mb-1">{title}</p>
          <p className="text-xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};