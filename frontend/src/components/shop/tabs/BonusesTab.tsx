'use client';

import React from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { 
  calculateTierDistribution, 
  calculateBonusesAvailable,
  getAverageBonusAmount,
  TIER_CONFIG,
  formatRCN,
  TierBonusStats
} from '@/utils/tierCalculations';

interface ShopData {
  purchasedRcnBalance: number;
}

interface BonusesTabProps {
  tierStats: TierBonusStats | null;
  shopData: ShopData | null;
}

export const BonusesTab: React.FC<BonusesTabProps> = ({ tierStats, shopData }) => {
  const tierDistribution = calculateTierDistribution(tierStats);
  const bonusesAvailable = calculateBonusesAvailable(
    shopData?.purchasedRcnBalance || 0, 
    tierStats
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Focused Bonus Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon="🏆"
          value={tierStats?.totalBonusesIssued || 0}
          label="Total Bonuses Issued"
          color="purple"
          description="Lifetime tier bonuses"
        />
        <StatCard
          icon="💎"
          value={formatRCN(tierStats?.totalBonusAmount || 0)}
          label="Total RCN in Bonuses"
          color="green"
          description="Extra rewards given"
        />
        <StatCard
          icon="📊"
          value={`${tierStats?.averageBonusPerTransaction?.toFixed(1) || 0} RCN`}
          label="Average Bonus"
          color="blue"
          description="Per qualifying transaction"
        />
        <StatCard
          icon="⚡"
          value={bonusesAvailable}
          label="Bonuses Available"
          color="yellow"
          description={`Based on ${formatRCN(shopData?.purchasedRcnBalance || 0)} balance`}
        />
      </div>

      {/* Comprehensive Tier Bonus Performance */}
      <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Tier Bonus Performance</h3>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-purple-500">🏆</span>
              <span className="text-gray-400">Total:</span>
              <span className="font-bold text-white">{tierStats?.totalBonusesIssued || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">💎</span>
              <span className="text-gray-400">RCN:</span>
              <span className="font-bold text-white">{formatRCN(tierStats?.totalBonusAmount || 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-500">📊</span>
              <span className="text-gray-400">Avg:</span>
              <span className="font-bold text-white">{formatRCN(getAverageBonusAmount(tierStats))}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tierDistribution.map((tier) => (
            <div key={tier.name} className="bg-[#0D0D0D] rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{tier.icon}</span>
                <div>
                  <h4 className="font-bold text-white">{tier.displayName} Tier</h4>
                  <p className="text-xs text-gray-400">+{tier.bonusAmount} RCN bonus</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Bonuses Issued</span>
                  <span className="font-semibold text-white">{tier.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Total RCN</span>
                  <span className="font-semibold text-white">{formatRCN(tier.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Share</span>
                  <span className="font-semibold text-white">{tier.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                  <div 
                    className={`bg-gradient-to-r ${tier.gradientClass} h-2 rounded-full`}
                    style={{ width: `${tier.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Component for displaying bonus guidelines
interface GuidelineCardProps {
  icon: string;
  title: string;
  items: string[];
}

const GuidelineCard: React.FC<GuidelineCardProps> = ({ icon, title, items }) => {
  return (
    <div className="bg-[#0D0D0D] rounded-xl p-6 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h4 className="font-semibold text-lg text-white">{title}</h4>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-green-500 mt-1">•</span>
            <span className="text-sm text-gray-300">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

