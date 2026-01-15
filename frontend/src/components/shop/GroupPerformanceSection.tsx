// frontend/src/components/shop/GroupPerformanceSection.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { serviceAnalyticsApi, GroupPerformanceAnalytics } from '@/services/api/serviceAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Package, Coins, TrendingUp, Gift } from 'lucide-react';

export function GroupPerformanceSection() {
  const [analytics, setAnalytics] = useState<GroupPerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroupPerformance();
  }, []);

  const loadGroupPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await serviceAnalyticsApi.getGroupPerformanceAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load group performance analytics:', err);
      setError(err.message || 'Failed to load group performance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">{error || 'Failed to load group performance analytics'}</p>
        <button
          onClick={loadGroupPerformance}
          className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, groupBreakdown, servicesLinked } = analytics;

  // Check if shop has any group activity
  if (summary.totalGroupsActive === 0 && summary.totalServicesLinked === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-8 text-center">
        <div className="mb-4">
          <Users className="h-16 w-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Group Activity Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Link your services to affiliate groups to start earning group tokens and tracking performance metrics.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 mt-6">
          <Gift className="h-5 w-5 text-purple-400" />
          <span className="text-purple-300 font-semibold">Join affiliate groups to unlock this feature</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-purple-600/20 to-purple-500/20 rounded-xl border border-purple-500/30">
          <Users className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Group Performance Analytics</h3>
          <p className="text-gray-400 text-sm">Track affiliate group bookings and token issuance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Services Linked</CardTitle>
            <Package className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{summary.totalServicesLinked}</div>
            <p className="text-xs text-gray-400">
              to {summary.totalGroupsActive} {summary.totalGroupsActive === 1 ? 'group' : 'groups'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Bookings</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{summary.totalBookingsFromGroups}</div>
            <p className="text-xs text-gray-400">from group-linked services</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Tokens Issued</CardTitle>
            <Coins className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{summary.totalGroupTokensIssued.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
            <p className="text-xs text-gray-400">group tokens awarded</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{summary.totalGroupsActive}</div>
            <p className="text-xs text-gray-400">affiliate partnerships</p>
          </CardContent>
        </Card>
      </div>

      {/* Group Breakdown Table */}
      {groupBreakdown.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Performance by Group
            </CardTitle>
            <CardDescription className="text-gray-400">
              Revenue and token issuance breakdown per affiliate group
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Group</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Services</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Bookings</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Revenue</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Tokens Issued</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {groupBreakdown.map((group) => (
                    <tr key={group.groupId} className="border-b border-gray-800/50 hover:bg-purple-900/10 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{group.icon || '🎁'}</span>
                          <div>
                            <div className="font-semibold text-white">{group.groupName}</div>
                            <div className="text-xs text-purple-300">{group.customTokenSymbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-white">{group.servicesLinked}</td>
                      <td className="py-4 px-4 text-right text-white">{group.totalBookings}</td>
                      <td className="py-4 px-4 text-right text-green-400 font-semibold">
                        ${group.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right text-purple-400 font-semibold">
                        {group.tokensIssued.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            group.conversionRate >= 5 ? 'bg-green-500/20 text-green-400' :
                            group.conversionRate >= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {group.conversionRate.toFixed(1)}%
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services Linked Table */}
      {servicesLinked.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-400" />
              Services Linked to Groups
            </CardTitle>
            <CardDescription className="text-gray-400">
              Individual service performance within affiliate groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {servicesLinked.map((service) => (
                <div
                  key={service.serviceId}
                  className="p-4 bg-[#1A1A1A] border border-gray-800 rounded-lg hover:border-purple-500/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{service.serviceName}</h4>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {service.groups.map((group, index) => (
                          <div
                            key={`${service.serviceId}-${group.groupId}-${index}`}
                            className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-purple-600/20 to-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold"
                          >
                            <span>{group.customTokenSymbol}</span>
                            <span className="text-purple-400">
                              {group.tokenRewardPercentage}%
                              {group.bonusMultiplier !== 1 && ` × ${group.bonusMultiplier}x`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{service.bookings} bookings</div>
                      <div className="text-sm text-green-400 font-semibold">
                        ${service.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
