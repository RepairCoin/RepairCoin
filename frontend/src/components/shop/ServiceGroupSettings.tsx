'use client';

import { useState, useEffect } from 'react';
import { serviceGroupApi, ServiceGroupLink } from '@/services/api/serviceGroups';
import { getMyGroups, AffiliateShopGroup } from '@/services/api/affiliateShopGroups';

interface ServiceGroupSettingsProps {
  serviceId: string;
  onUpdate?: () => void;
}

export function ServiceGroupSettings({ serviceId, onUpdate }: ServiceGroupSettingsProps) {
  const [shopGroups, setShopGroups] = useState<AffiliateShopGroup[]>([]);
  const [linkedGroups, setLinkedGroups] = useState<ServiceGroupLink[]>([]);
  const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    loadData();
  }, [serviceId]);

  const loadData = async () => {
    setLoadingGroups(true);
    try {
      const [groups, links] = await Promise.all([
        getMyGroups(),
        serviceGroupApi.getServiceGroups(serviceId)
      ]);
      console.log('Loaded service groups data:', { groups, links, serviceId });
      setShopGroups(groups);
      setLinkedGroups(links);
    } catch (error) {
      console.error('Error loading service groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleLinkGroup = async (groupId: string) => {
    setLoadingGroupId(groupId);
    try {
      await serviceGroupApi.linkServiceToGroup(serviceId, groupId, 100, 1.0);
      await loadData();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error linking group:', error);
      if (error.response?.status === 409) {
        alert('This service is already linked to this group.');
      } else {
        alert('Failed to link service to group. Make sure you are an active member.');
      }
      await loadData(); // Refresh to show current state
    } finally {
      setLoadingGroupId(null);
    }
  };

  const handleUnlinkGroup = async (groupId: string) => {
    setLoadingGroupId(groupId);
    try {
      await serviceGroupApi.unlinkServiceFromGroup(serviceId, groupId);
      await loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Error unlinking group:', error);
      alert('Failed to unlink service from group.');
    } finally {
      setLoadingGroupId(null);
    }
  };

  const handleUpdateRewards = async (groupId: string, percentage: number, multiplier: number) => {
    try {
      await serviceGroupApi.updateServiceGroupRewards(serviceId, groupId, percentage, multiplier);
      await loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating rewards:', error);
      alert('Failed to update reward settings.');
    }
  };

  const isLinked = (groupId: string) => {
    const result = linkedGroups.some(g => g.groupId === groupId && g.active);
    console.log('isLinked check:', { groupId, linkedGroups, result });
    return result;
  };
  const getLink = (groupId: string) => linkedGroups.find(l => l.groupId === groupId && l.active);

  if (loadingGroups) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-[#FFCC00]">Affiliate Group Rewards</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Link this service to your affiliate groups to issue custom group tokens when customers book.
          Group tokens are earned in addition to standard RCN rewards.
        </p>
      </div>

      {/* Available Groups */}
      <div className="space-y-3">
        {shopGroups.map(group => {
          const link = getLink(group.groupId);
          const linked = isLinked(group.groupId);

          return (
            <div key={group.groupId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{group.icon || '🏪'}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{group.groupName}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Earn {group.customTokenSymbol} ({group.customTokenName})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => linked ? handleUnlinkGroup(group.groupId) : handleLinkGroup(group.groupId)}
                  disabled={loadingGroupId === group.groupId}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    linked
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                      : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                  } ${loadingGroupId === group.groupId ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingGroupId === group.groupId ? 'Processing...' : linked ? 'Unlink' : 'Link Service'}
                </button>
              </div>

              {linked && link && (
                <div className="space-y-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Token Reward (% of service price)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={link.tokenRewardPercentage}
                      onChange={(e) => handleUpdateRewards(group.groupId, parseFloat(e.target.value), link.bonusMultiplier)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      100% = customer earns {group.customTokenSymbol} equal to service price
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Example: $50 service at 100% = 50 {group.customTokenSymbol}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Bonus Multiplier
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={link.bonusMultiplier}
                      onChange={(e) => handleUpdateRewards(group.groupId, link.tokenRewardPercentage, parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      1.0 = standard rewards, 2.0 = double rewards, 0.5 = half rewards
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                      Current reward: {(link.tokenRewardPercentage * link.bonusMultiplier / 100).toFixed(1)}x service price
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      For a $100 service, customers will earn {(100 * link.tokenRewardPercentage * link.bonusMultiplier / 100).toFixed(0)} {group.customTokenSymbol}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shopGroups.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="mb-2">You're not a member of any affiliate groups yet.</p>
          <p className="text-sm">Join or create a group to start offering group-specific rewards!</p>
        </div>
      )}
    </div>
  );
}
