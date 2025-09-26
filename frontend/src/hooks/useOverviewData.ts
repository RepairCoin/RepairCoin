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

export function useOverviewData() {
  const { isAdmin, generateAdminToken } = useAdminAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [dataFetched, setDataFetched] = useState(false);

  const loadOverviewData = useCallback(async () => {
    if (!isAdmin || dataFetched) return;

    setLoading(true);
    setError(null);

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError("Failed to authenticate as admin");
        return;
      }

      // Fetch platform statistics
      const statsData = await adminApi.getStats();
      if (statsData) {
        setStats(statsData as PlatformStats);
        setDataFetched(true);
      } else {
        // Try refreshing the token
        const newToken = await generateAdminToken(true);
        if (newToken) {
          const retryStats = await adminApi.getStats();
          if (retryStats) {
            setStats(retryStats as PlatformStats);
            setDataFetched(true);
          }
        } else {
          setError("Failed to authenticate. Please check your wallet address.");
        }
      }
    } catch (error) {
      console.error("Error loading overview data:", error);
      setError("Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, generateAdminToken, dataFetched]);

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