'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'react-hot-toast';

interface ReferralData {
  referralCode: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    successfulReferrals: number;
    pendingReferrals: number;
    totalEarned: number;
    referrals: Array<{
      id: string;
      refereeAddress?: string;
      status: string;
      createdAt: string;
      completedAt?: string;
    }>;
  };
  rcnBreakdown: {
    totalBalance: number;
    earnedBalance: number;
    marketBalance: number;
    redeemableBalance: number;
    homeShop?: string;
    breakdownByShop: { [shopId: string]: number };
    breakdownByType: { [type: string]: number };
    crossShopLimit: number;
  };
}

export function ReferralDashboard() {
  const account = useActiveAccount();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (account?.address) {
      loadReferralData();
    }
  }, [account?.address]);

  const loadReferralData = async () => {
    if (!account?.address) return;

    try {
      setLoading(true);
      
      // Fetch referral stats and RCN breakdown using wallet address
      const [statsResponse, breakdownResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrals/stats/${account.address}`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrals/rcn-breakdown/${account.address}`)
      ]);

      if (statsResponse.ok && breakdownResponse.ok) {
        const statsData = await statsResponse.json();
        const breakdownData = await breakdownResponse.json();
        
        // Check if we have a referral code
        let referralCode = statsData.data.referralCode;
        let referralLink = '';
        
        if (!referralCode) {
          // Generate referral code if not exists
          const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrals/generate/${account.address}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (generateResponse.ok) {
            const generateData = await generateResponse.json();
            referralCode = generateData.data.referralCode;
            referralLink = generateData.data.referralLink;
          }
        } else {
          referralLink = `${process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin}/register?ref=${referralCode}`;
        }
        
        setReferralData({
          referralCode,
          referralLink,
          stats: statsData.data,
          rcnBreakdown: breakdownData.data
        });
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (!referralData?.referralLink) return;
    
    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralData.referralLink);
      toast.success('Referral link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    } finally {
      setCopying(false);
    }
  };

  const copyReferralCode = async () => {
    if (!referralData?.referralCode) return;
    
    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralData.referralCode);
      toast.success('Referral code copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy code');
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!referralData) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <p className="text-gray-600">Unable to load referral data. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Code Section */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Your Referral Program</h2>
        <p className="text-lg opacity-90 mb-6">
          Earn 25 RCN for each friend who joins! They get 10 RCN as a welcome bonus.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-6">
            <p className="text-sm opacity-90 mb-2">Your Referral Code</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-mono font-bold">{referralData.referralCode}</p>
              <button
                onClick={copyReferralCode}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                disabled={copying}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="bg-white/20 backdrop-blur rounded-xl p-6">
            <p className="text-sm opacity-90 mb-2">Share Your Link</p>
            <button
              onClick={copyReferralLink}
              className="w-full bg-white text-purple-600 font-semibold py-3 px-4 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-2"
              disabled={copying}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {copying ? 'Copying...' : 'Copy Referral Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Referrals</p>
              <p className="text-3xl font-bold text-gray-900">{referralData.stats.totalReferrals}</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Successful</p>
              <p className="text-3xl font-bold text-green-600">{referralData.stats.successfulReferrals}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{referralData.stats.pendingReferrals}</p>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Earned</p>
              <p className="text-3xl font-bold text-purple-600">{referralData.stats.totalEarned} RCN</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
      </div>

      {/* RCN Balance Breakdown */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Your RCN Breakdown</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Balance Overview</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Balance:</span>
                <span className="font-bold text-lg">{referralData.rcnBreakdown.totalBalance.toFixed(2)} RCN</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Earned (Redeemable):</span>
                <span className="font-bold text-green-600">{referralData.rcnBreakdown.earnedBalance.toFixed(2)} RCN</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Market Bought:</span>
                <span className="font-bold text-gray-500">{referralData.rcnBreakdown.marketBalance.toFixed(2)} RCN</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cross-Shop Limit (20%):</span>
                  <span className="font-bold text-blue-600">{referralData.rcnBreakdown.crossShopLimit.toFixed(2)} RCN</span>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Earnings by Type</h4>
            <div className="space-y-3">
              {Object.entries(referralData.rcnBreakdown.breakdownByType).map(([type, amount]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-gray-600 capitalize">{type.replace(/_/g, ' ')}:</span>
                  <span className="font-bold">{amount} RCN</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {referralData.rcnBreakdown.homeShop && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Home Shop:</span> {referralData.rcnBreakdown.homeShop}
              <br />
              <span className="text-xs">You can redeem 100% of your earned RCN at your home shop</span>
            </p>
          </div>
        )}
      </div>

      {/* Recent Referrals */}
      {referralData.stats.referrals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Recent Referrals</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {referralData.stats.referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {referral.refereeAddress ? (
                        <span className="font-mono">
                          {referral.refereeAddress.slice(0, 6)}...{referral.refereeAddress.slice(-4)}
                        </span>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        referral.status === 'completed' ? 'bg-green-100 text-green-800' :
                        referral.status === 'expired' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {referral.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {referral.completedAt ? new Date(referral.completedAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}