"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { authManager } from "@/utils/auth";
import { adminApi } from "@/services/api/admin";

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

export interface Shop {
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
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
  suspended_at?: string;
  suspension_reason?: string;
}

export function useAdminDashboardData(
  isAdmin: boolean,
  isSuperAdmin: boolean,
  adminPermissions: string[],
  generateAdminToken: (forceRefresh?: boolean) => Promise<string | null>,
  hasPermission: (permission: string) => boolean
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pendingShops, setPendingShops] = useState<Shop[]>([]);
  const [rejectedShops, setRejectedShops] = useState<Shop[]>([]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        setError("Failed to authenticate as admin");
        return;
      }

      // Fetch platform statistics using API service
      const statsData = await adminApi.getStats();
      if (statsData) {
        setStats(statsData);
      } else {
        // If failed, try refreshing the token
        authManager.clearToken("admin");
        const newToken = await generateAdminToken(true);
        if (newToken) {
          const retryStats = await adminApi.getStats();
          if (retryStats) {
            setStats(retryStats);
          }
        } else {
          setError(
            "Failed to authenticate as admin. Please check your wallet address."
          );
          setLoading(false);
          return;
        }
      }

      // Only fetch shops if user has manage_shops permission
      const canManageShops = hasPermission('manage_shops');
      if (canManageShops) {
        // Fetch ALL shops to get complete data using API service
        const allShops = await adminApi.getShops({ active: 'all' as any, verified: 'all' as any });

        // Ensure allShops is an array
        const shopsArray = Array.isArray(allShops) ? allShops : [];

        // Separate shops based on their status
        const activeVerifiedShops = shopsArray.filter(
          (shop: any) => shop.active && shop.verified && !shop.suspended_at
        );
        const pendingShops = shopsArray.filter(
          (shop: any) => !shop.verified && !shop.suspended_at
        );
        const rejectedShops = shopsArray.filter(
          (shop: any) => shop.suspended_at || (!shop.active && shop.verified)
        );

        setShops(activeVerifiedShops);
        setPendingShops(pendingShops);
        setRejectedShops(rejectedShops);
      } else {
        // Clear all shops if user doesn't have permission
        setShops([]);
        setPendingShops([]);
        setRejectedShops([]);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, generateAdminToken, hasPermission, isSuperAdmin]);

  useEffect(() => {
    // Load dashboard data when admin is confirmed and either:
    // - Has permissions set, or
    // - Is a super admin (who has all permissions implicitly)
    if (isAdmin && (adminPermissions.length > 0 || isSuperAdmin)) {
      loadDashboardData();
    }
  }, [isAdmin, isSuperAdmin, adminPermissions.length, loadDashboardData]);

  // Shop action handlers
  const suspendShop = async (shopId: string) => {
    const success = await adminApi.suspendShop(shopId, "Admin action");
    if (!success) {
      throw new Error("Failed to suspend shop");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const unsuspendShop = async (shopId: string) => {
    const success = await adminApi.unsuspendShop(shopId);
    if (!success) {
      throw new Error("Failed to unsuspend shop");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const verifyShop = async (shopId: string) => {
    const success = await adminApi.verifyShop(shopId);
    if (!success) {
      throw new Error("Failed to verify shop");
    }
  };

  const approveShop = async (shopId: string) => {
    try {
      const success = await adminApi.approveShop(shopId);
      if (!success) {
        throw new Error("Failed to approve shop");
      }

      // Refresh the data after approval
      await loadDashboardData();
      toast.success(`Shop ${shopId} approved successfully!`);
    } catch (error: any) {
      console.error("Error approving shop:", error);
      toast.error(error.message || "Failed to approve shop");
    }
  };

  const rejectShop = async (shopId: string, reason?: string) => {
    console.log("Rejecting shop:", shopId);
    try {
      // Use the reject endpoint if available, otherwise use suspend
      const success = await adminApi.rejectShop(shopId, reason || "Does not meet requirements");
      if (!success) {
        // Fallback to suspend for backward compatibility
        const suspendSuccess = await adminApi.suspendShop(
          shopId,
          `Application Rejected: ${reason || "Does not meet requirements"}`
        );
        if (!suspendSuccess) {
          throw new Error("Failed to reject shop");
        }
      }

      // Refresh the data after rejection
      await loadDashboardData();
      toast.success(`Shop application rejected successfully!`);
    } catch (error: any) {
      console.error("Error rejecting shop:", error);
      toast.error(error.message || "Failed to reject shop");
      throw error; // Re-throw to handle in the UI
    }
  };

  const mintShopBalance = async (shopId: string) => {
    try {
      const result = await adminApi.mintShopBalance(shopId);
      if (!result.success) {
        throw new Error("Failed to mint balance");
      }

      toast.success(result.message || "Balance minted successfully");

      // Refresh shops data
      loadDashboardData();
    } catch (error) {
      console.error("Error minting balance:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to mint balance"
      );
    }
  };

  // Customer action handlers
  const mintTokensToCustomer = async (
    customerAddress: string,
    amount: number,
    reason: string
  ) => {
    try {
      const result = await adminApi.mintTokens({
        address: customerAddress,
        amount,
        reason,
      });

      if (result.success) {
        await loadDashboardData();
      } else {
        setError("Failed to mint tokens");
      }
    } catch (error) {
      console.error("Error minting tokens:", error);
      setError("Failed to mint tokens");
    }
  };

  const suspendCustomer = async (address: string, reason: string = "Admin decision") => {
    const success = await adminApi.suspendCustomer(address, reason);
    if (!success) {
      throw new Error("Failed to suspend customer");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  const unsuspendCustomer = async (address: string) => {
    const success = await adminApi.unsuspendCustomer(address);
    if (!success) {
      throw new Error("Failed to unsuspend customer");
    }
    
    // Refresh the data to show updated status
    loadDashboardData();
  };

  return {
    loading,
    error,
    setError,
    stats,
    shops,
    pendingShops,
    rejectedShops,
    loadDashboardData,
    // Shop actions
    suspendShop,
    unsuspendShop,
    verifyShop,
    approveShop,
    rejectShop,
    mintShopBalance,
    // Customer actions
    mintTokensToCustomer,
    suspendCustomer,
    unsuspendCustomer,
  };
}