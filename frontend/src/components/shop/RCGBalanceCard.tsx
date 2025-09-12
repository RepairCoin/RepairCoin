import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExternalLink, TrendingUp, Award } from 'lucide-react';
import { useRCGBalance } from '@/hooks/useRCGBalance';
import { formatNumber } from '@/lib/utils';
import { RCGPurchaseModal } from './RCGPurchaseModal';

interface RCGBalanceCardProps {
  shopId: string | undefined;
}

export function RCGBalanceCard({ shopId }: RCGBalanceCardProps) {
  const { rcgInfo, loading, error } = useRCGBalance(shopId);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  if (loading) {
    return (
      <Card className="animate-pulse bg-[#212121] border-gray-700">
        <CardHeader>
          <CardTitle className="text-[#FFCC00]">RCG Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-8 bg-gray-700 rounded" />
            <div className="h-4 bg-gray-700 rounded w-3/4" />
            <div className="h-20 bg-gray-700 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !rcgInfo) {
    return (
      <Card className="bg-[#212121] border-gray-700">
        <CardHeader>
          <CardTitle className="text-[#FFCC00]">RCG Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Unable to load RCG information</p>
        </CardContent>
      </Card>
    );
  }

  const tierColors = {
    none: 'text-gray-500',
    standard: 'text-blue-600',
    premium: 'text-purple-600',
    elite: 'text-yellow-600'
  };

  const tierBadgeColors = {
    none: 'bg-gray-100',
    standard: 'bg-blue-100',
    premium: 'bg-purple-100',
    elite: 'bg-yellow-100'
  };

  const progressPercentage = rcgInfo.nextTierInfo 
    ? ((rcgInfo.balance - (rcgInfo.currentTierInfo?.minRequired || 0)) / 
       (rcgInfo.nextTierInfo.required - (rcgInfo.currentTierInfo?.minRequired || 0))) * 100
    : 100;

  return (
    <Card className="bg-[#212121] border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-[#FFCC00]">RCG Governance Token</CardTitle>
          <Award className={`h-6 w-6 ${tierColors[rcgInfo.tier as keyof typeof tierColors]}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Display */}
        <div>
          <p className="text-sm text-gray-400">Your Balance</p>
          <p className="text-3xl font-bold text-white">{formatNumber(rcgInfo.balance)} RCG</p>
        </div>

        {/* Current Tier */}
        {rcgInfo.tier !== 'none' && rcgInfo.currentTierInfo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Current Tier</p>
              <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${tierBadgeColors[rcgInfo.tier as keyof typeof tierBadgeColors]} ${tierColors[rcgInfo.tier as keyof typeof tierColors]}`}>
                {rcgInfo.tier}
              </span>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">RCN Price:</span>
                <span className="font-medium text-white">${rcgInfo.currentTierInfo.rcnPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Discount:</span>
                <span className="font-medium text-green-400">{rcgInfo.currentTierInfo.discount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress to Next Tier */}
        {rcgInfo.nextTierInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Progress to {rcgInfo.nextTierInfo.tier} Tier</p>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </div>
            <Progress value={progressPercentage} className="h-2 bg-gray-700" />
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatNumber(rcgInfo.balance)} RCG</span>
              <span>{formatNumber(rcgInfo.nextTierInfo.required)} RCG</span>
            </div>
            <div className="bg-blue-900/20 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-blue-300">Need {formatNumber(rcgInfo.nextTierInfo.tokensNeeded)} more RCG</p>
              <p className="text-xs text-gray-400">
                Unlock ${rcgInfo.nextTierInfo.benefits.rcnPrice.toFixed(2)} per RCN ({rcgInfo.nextTierInfo.benefits.discount} discount)
              </p>
            </div>
          </div>
        )}

        {/* Max Tier Achieved */}
        {rcgInfo.tier === 'elite' && !rcgInfo.nextTierInfo && (
          <div className="bg-yellow-900/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" />
              <p className="text-sm font-medium text-yellow-400">Elite Tier Achieved!</p>
            </div>
            <p className="text-xs text-gray-400">
              You have reached the highest tier and enjoy maximum 40% discount on RCN purchases.
            </p>
          </div>
        )}

        {/* No Tier Message */}
        {rcgInfo.tier === 'none' && (
          <div className="bg-amber-900/20 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-amber-400">Basic Shop Status</p>
            <p className="text-xs text-amber-300">
              You can operate without RCG tokens, but you'll pay standard rates ($0.10/RCN).
              Hold 10,000+ RCG to unlock tier discounts.
            </p>
          </div>
        )}

        {/* Buy RCG Button */}
        <div className="pt-2">
          <Button 
            variant="outline" 
            className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 hover:border-gray-500"
            onClick={() => setShowPurchaseModal(true)}
          >
            Buy RCG Tokens
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
      
      {/* Purchase Modal */}
      <RCGPurchaseModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        currentBalance={rcgInfo.balance}
        currentTier={rcgInfo.tier}
        nextTierRequired={rcgInfo.nextTierInfo?.required || 0}
      />
    </Card>
  );
}