"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/services/api/admin";
import { useAdminAuth } from "./useAdminAuth";

export interface PlatformStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  activeCustomersLast30Days: number;
  averageTransactionValue: number;
  topPerformingShops: Array<{
    shopId: string;
    name: string;
    totalTransactions: number;
  }>;
}

// New optimized platform statistics from materialized view
export interface OptimizedPlatformStats {
  tokenStats: {
    totalRcnMinted: number;
    totalRcnRedeemed: number;
    totalRcnCirculating: number;
  };
  userStats: {
    totalActiveCustomers: number;
    customersBronze: number;
    customersSilver: number;
    customersGold: number;
  };
  shopStats: {
    totalActiveShops: number;
    shopsWithSubscription: number;
  };
  revenueStats: {
    totalRevenue: number;
    revenueLast30Days: number;
  };
  transactionStats: {
    totalTransactions: number;
    transactionsLast24h: number;
  };
  referralStats: {
    totalReferrals: number;
    totalReferralRewards: number;
  };
  lastUpdated: Date;
}

export function useOverviewData() {
  const { isAdmin } = useAdminAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [dataFetched, setDataFetched] = useState(false);

  const loadOverviewData = useCallback(async () => {
    if (!isAdmin || dataFetched) return;

    setLoading(true);
    setError(null);

    try {
      // Cookies sent automatically with apiClient
      // Fetch optimized platform statistics from materialized view
      const optimizedStats = await adminApi.getPlatformStatistics();
      if (optimizedStats) {
        // Transform to match old PlatformStats interface for backward compatibility
        const transformedStats: PlatformStats = {
          totalCustomers: optimizedStats.userStats.totalActiveCustomers,
          totalShops: optimizedStats.shopStats.totalActiveShops,
          totalTransactions: optimizedStats.transactionStats.totalTransactions,
          totalTokensIssued: optimizedStats.tokenStats.totalRcnMinted,
          totalRedemptions: optimizedStats.tokenStats.totalRcnRedeemed,
          activeCustomersLast30Days: optimizedStats.userStats.totalActiveCustomers, // Approximation
          averageTransactionValue: optimizedStats.transactionStats.totalTransactions > 0
            ? optimizedStats.tokenStats.totalRcnMinted / optimizedStats.transactionStats.totalTransactions
            : 0,
          topPerformingShops: [] // This would need separate endpoint
        };

        setStats(transformedStats);
        setDataFetched(true);
      } else {
        // Fallback to old endpoint if new one fails
        const statsData = await adminApi.getStats();
        if (statsData) {
          setStats(statsData as PlatformStats);
          setDataFetched(true);
        } else {
          setError("Failed to load platform statistics");
        }
      }
    } catch (error) {
      console.error("Error loading overview data:", error);
      setError("Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, dataFetched]);

  // Load data when component mounts
  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  const refreshData = useCallback(async () => {
    setDataFetched(false);
    await loadOverviewData();
  }, [loadOverviewData]);

  return {
    loading,
    error,
    stats,
    refreshData,
  };
}