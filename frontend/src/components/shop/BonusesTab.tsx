'use client';

import React from 'react';

interface TierBonusStats {
  totalBonusesIssued: number;
  totalBonusAmount: number;
  bonusesByTier: { [key: string]: { count: number; amount: number } };
  averageBonusPerTransaction: number;
}

interface ShopData {
  purchasedRcnBalance: number;
}

interface BonusesTabProps {
  tierStats: TierBonusStats | null;
  shopData: ShopData | null;
}

export const BonusesTab: React.FC<BonusesTabProps> = ({ tierStats, shopData }) => {

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon="🏆"
          value={tierStats?.totalBonusesIssued || 0}
          label="Total Bonuses Issued"
          color="purple"
          description="Lifetime bonuses"
        />
        <StatCard
          icon="💎"
          value={`${tierStats?.totalBonusAmount?.toFixed(0) || 0}`}
          label="RCN Awarded"
          color="green"
          description="In tier bonuses"
        />
        <StatCard
          icon="📊"
          value={`${tierStats?.averageBonusPerTransaction?.toFixed(1) || 0}`}
          label="Average Bonus"
          color="blue"
          description="Per transaction"
        />
        <StatCard
          icon="⚡"
          value={Math.floor((shopData?.purchasedRcnBalance || 0) / 20)}
          label="Bonuses Available"
          color="yellow"
          description={`${shopData?.purchasedRcnBalance || 0} RCN balance`}
        />
      </div>

      {/* Tier Breakdown */}
      <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800 mb-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-white">Performance by Tier</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['BRONZE', 'SILVER', 'GOLD'].map((tier) => {
            const tierData = tierStats?.bonusesByTier?.[tier] || { count: 0, amount: 0 };
            const bonusAmount = tier === 'BRONZE' ? 10 : tier === 'SILVER' ? 20 : 30;
            
            return (
              <TierCard
                key={tier}
                tier={tier}
                tierData={tierData}
                bonusAmount={bonusAmount}
                totalBonuses={tierStats?.totalBonusesIssued || 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  color: string;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color, description }) => {
  const colorClasses = {
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-[#FFCC00]',
  };

  const textColorClasses = {
    purple: 'text-purple-500',
    green: 'text-green-500',
    blue: 'text-blue-500',
    yellow: 'text-[#FFCC00]',
  };

  return (
    <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800 hover:border-gray-700 transition-all">
      <div>
        <div className={`text-3xl font-bold ${textColorClasses[color as keyof typeof textColorClasses]} mb-1`}>
          {value}
        </div>
        <p className="text-sm text-white font-medium mb-1">{label}</p>
        {description && (
          <p className="text-xs text-gray-400">{description}</p>
        )}
      </div>
    </div>
  );
};

interface TierCardProps {
  tier: string;
  tierData: { count: number; amount: number };
  bonusAmount: number;
  totalBonuses: number;
}

const TierCard: React.FC<TierCardProps> = ({ tier, tierData, bonusAmount, totalBonuses }) => {
  const gradientClasses = {
    BRONZE: 'from-orange-500 to-orange-600',
    SILVER: 'from-gray-400 to-gray-500',
    GOLD: 'from-yellow-500 to-yellow-600',
  };

  const bgClasses = {
    BRONZE: 'bg-orange-500',
    SILVER: 'bg-gray-500',
    GOLD: 'bg-yellow-500',
  };

  const icons = {
    BRONZE: '🥉',
    SILVER: '🥈',
    GOLD: '🥇',
  };

  const percentage = totalBonuses ? 
    ((tierData.count / totalBonuses) * 100).toFixed(1) : '0';

  return (
    <div className="bg-[#0D0D0D] rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all">
      <div className={`bg-gradient-to-r ${gradientClasses[tier as keyof typeof gradientClasses]} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icons[tier as keyof typeof icons]}</span>
            <div>
              <h4 className="font-bold text-lg text-white">{tier}</h4>
              <p className="text-xs text-white text-opacity-80">+{bonusAmount} RCN per repair</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{tierData.count}</p>
            <p className="text-xs text-white text-opacity-80">bonuses</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Total Awarded</span>
          <span className="text-white font-bold">{tierData.amount} RCN</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Avg per Bonus</span>
          <span className="text-white font-bold">{bonusAmount} RCN</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${bgClasses[tier as keyof typeof bgClasses]}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <p className="text-center text-xs text-gray-500">{percentage}% of all bonuses</p>
      </div>
    </div>
  );
};


interface TierRequirementProps {
  tier: string;
  requirement: string;
  bonus: string;
  icon: string;
  gradient: string;
}

const TierRequirement: React.FC<TierRequirementProps> = ({ tier, requirement, bonus, icon, gradient }) => {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0D0D0D] border border-gray-700 hover:border-gray-600 transition-all group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
      <div className="relative p-6">
        <div className="flex items-center justify-center mb-4">
          <div className={`w-16 h-16 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center shadow-lg`}>
            <span className="text-3xl">{icon}</span>
          </div>
        </div>
        <div className="text-center">
          <h4 className="font-bold text-xl text-white mb-2">{tier} Tier</h4>
          <p className="text-sm text-gray-400 mb-3">{requirement}</p>
          <div className={`inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r ${gradient} shadow-lg`}>
            <span className="text-white font-bold text-lg">{bonus}</span>
          </div>
          <p className="text-xs text-gray-500 mt-3">per repair ≥ $50</p>
        </div>
      </div>
    </div>
  );
};