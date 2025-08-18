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
  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';  
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      {/* Tier Bonus Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon="🏆"
          value={tierStats?.totalBonusesIssued || 0}
          label="Total Bonuses"
          color="purple"
        />
        <StatCard
          icon="💎"
          value={tierStats?.totalBonusAmount?.toFixed(0) || 0}
          label="RCN Awarded"
          color="indigo"
        />
        <StatCard
          icon="📊"
          value={tierStats?.averageBonusPerTransaction?.toFixed(1) || 0}
          label="Avg Bonus"
          color="green"
        />
        <StatCard
          icon="⚡"
          value={((shopData?.purchasedRcnBalance || 0) / 20).toFixed(0)}
          label="Bonuses Left"
          color="orange"
        />
      </div>

      {/* Tier Breakdown */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Tier Bonus Breakdown</h3>
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
                getTierColor={getTierColor}
              />
            );
          })}
        </div>
      </div>

      {/* How Tier Bonuses Work */}
      {/* <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">How Tier Bonuses Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <InfoSection
            title="Automatic Application"
            items={[
              'Applied to every repair ≥ $50',
              'Based on customer\'s current tier',
              'Deducted from your RCN balance',
              'Increases customer loyalty'
            ]}
            itemColor="green"
          />
          <InfoSection
            title="Balance Management"
            items={[
              'Maintain sufficient RCN balance',
              'Failed bonuses are logged for review',
              'Set up auto-purchase for convenience',
              'Monitor usage in analytics'
            ]}
            itemColor="blue"
          />
        </div>
      </div> */}

      {/* Bonus Requirements */}
      {/* <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Customer Tier Requirements</h3>
        <div className="space-y-4">
          <TierRequirement
            tier="Bronze"
            requirement="0-199 lifetime RCN earned"
            bonus="+10 RCN per repair"
            icon="🥉"
            color="orange"
          />
          <TierRequirement
            tier="Silver"
            requirement="200-999 lifetime RCN earned"
            bonus="+20 RCN per repair"
            icon="🥈"
            color="gray"
          />
          <TierRequirement
            tier="Gold"
            requirement="1000+ lifetime RCN earned"
            bonus="+30 RCN per repair"
            icon="🥇"
            color="yellow"
          />
        </div>
      </div> */}
    </div>
  );
};

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color }) => {
  const colorClasses = {
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="text-center">
        <div className="text-3xl mb-2">{icon}</div>
        <div className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]} mb-2`}>
          {value}
        </div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
};

interface TierCardProps {
  tier: string;
  tierData: { count: number; amount: number };
  bonusAmount: number;
  getTierColor: (tier: string) => string;
}

const TierCard: React.FC<TierCardProps> = ({ tier, tierData, bonusAmount, getTierColor }) => {
  const bgClasses = {
    BRONZE: 'bg-orange-50 border-orange-200',
    SILVER: 'bg-gray-50 border-gray-200',
    GOLD: 'bg-yellow-50 border-yellow-200',
  };

  const icons = {
    BRONZE: '🥉',
    SILVER: '🥈',
    GOLD: '🥇',
  };

  return (
    <div className={`p-6 rounded-xl border-2 ${bgClasses[tier as keyof typeof bgClasses]}`}>
      <div className="text-center">
        <div className="text-2xl mb-2">{icons[tier as keyof typeof icons]}</div>
        <h4 className={`font-bold text-lg mb-2 ${getTierColor(tier)}`}>
          {tier}
        </h4>
        <p className="text-2xl font-bold text-gray-900 mb-1">
          {tierData.count}
        </p>
        <p className="text-sm text-gray-600 mb-2">bonuses given</p>
        <p className="text-lg font-semibold text-gray-800">
          {tierData.amount} RCN awarded
        </p>
        <p className="text-xs text-gray-500 mt-2">
          +{bonusAmount} RCN per repair ≥ $50
        </p>
      </div>
    </div>
  );
};

interface InfoSectionProps {
  title: string;
  items: string[];
  itemColor: string;
}

const InfoSection: React.FC<InfoSectionProps> = ({ title, items, itemColor }) => {
  const iconColors = {
    green: 'text-green-500',
    blue: 'text-blue-500',
  };

  const icons = {
    green: '✓',
    blue: 'ℹ',
  };

  return (
    <div>
      <h4 className="font-bold text-lg text-gray-900 mb-4">{title}</h4>
      <ul className="space-y-2 text-gray-600">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            <span className={`${iconColors[itemColor as keyof typeof iconColors]} mr-2`}>
              {icons[itemColor as keyof typeof icons]}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface TierRequirementProps {
  tier: string;
  requirement: string;
  bonus: string;
  icon: string;
  color: string;
}

const TierRequirement: React.FC<TierRequirementProps> = ({ tier, requirement, bonus, icon, color }) => {
  const colorClasses = {
    orange: 'border-orange-200 bg-orange-50',
    gray: 'border-gray-200 bg-gray-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{tier} Tier</h4>
            <p className="text-sm text-gray-600">{requirement}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-900">{bonus}</p>
        </div>
      </div>
    </div>
  );
};