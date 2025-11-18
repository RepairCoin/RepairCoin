"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { adminApi } from "@/services/api/admin";
import { useAdminAuth } from "./useAdminAuth";

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
  walletAddress?: string;
  wallet_address?: string;
  walletBalance?: number;
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
  suspended_at?: string;
  suspendedAt?: string;
  suspension_reason?: string;
  suspensionReason?: string;
  unsuspendRequest?: {
    id: string;
    requestReason: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
  };
  monthlyVolume?: number;
  customerCount?: number;
  lastActivity?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
}

export function useShopsData() {
  const {
    isAdmin,
    isSuperAdmin,
    adminRole,
  } = useAdminAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pendingShops, setPendingShops] = useState<Shop[]>([]);
  const [rejectedShops, setRejectedShops] = useState<Shop[]>([]);
  const [dataFetched, setDataFetched] = useState(false);

  // Load shops data
  const loadShopsData = useCallback(async () => {
    // Only fetch if we're an admin with proper permissions
    const canManageShops = isAdmin && (isSuperAdmin || adminRole === 'super_admin' || adminRole === 'admin');
    if (!canManageShops || dataFetched) return;

    setLoading(true);
    setError(null);

    try {
      // Cookies sent automatically with apiClient
      // Fetch ALL shops to get complete data
      const allShops = await adminApi.getShops({ active: 'all' as any, verified: 'all' as any });
      
      // Ensure allShops is an array
      const shopsArray = Array.isArray(allShops) ? allShops : [];

      // Separate shops based on their status
      // Check both snake_case and camelCase for suspension fields
      const activeVerifiedShops = shopsArray.filter(
        (shop: any) => shop.active && shop.verified && !shop.suspended_at && !shop.suspendedAt
      );
      const pendingShopsList = shopsArray.filter(
        (shop: any) => !shop.verified && !shop.suspended_at && !shop.suspendedAt
      );
      const rejectedShopsList = shopsArray.filter(
        (shop: any) => shop.suspended_at || shop.suspendedAt || (!shop.active && shop.verified)
      );

      setShops(activeVerifiedShops);
      setPendingShops(pendingShopsList);
      setRejectedShops(rejectedShopsList);
      setDataFetched(true);
    } catch (error) {
      console.error("Error loading shops data:", error);
      setError("Failed to load shops data");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSuperAdmin, adminRole, dataFetched]);

  // Load data when component mounts and conditions are met
  useEffect(() => {
    loadShopsData();
  }, [loadShopsData]);

  // Shop action handlers
  const refreshData = useCallback(async () => {
    setDataFetched(false);
    await loadShopsData();
  }, [loadShopsData]);

  const suspendShop = async (shopId: string) => {
    const success = await adminApi.suspendShop(shopId, "Admin action");
    if (!success) {
      throw new Error("Failed to suspend shop");
    }
    await refreshData();
  };

  const unsuspendShop = async (shopId: string) => {
    const success = await adminApi.unsuspendShop(shopId);
    if (!success) {
      throw new Error("Failed to unsuspend shop");
    }
    await refreshData();
  };

  const verifyShop = async (shopId: string) => {
    const success = await adminApi.verifyShop(shopId);
    if (!success) {
      throw new Error("Failed to verify shop");
    }
    await refreshData();
  };

  const approveShop = async (shopId: string) => {
    try {
      const success = await adminApi.approveShop(shopId);
      if (!success) {
        throw new Error("Failed to approve shop");
      }
      await refreshData();
      // Toast removed - let the component handle notifications
    } catch (error: any) {
      console.error("Error approving shop:", error);
      throw error; // Re-throw to let component handle the error
    }
  };

  const rejectShop = async (shopId: string, reason?: string) => {
    try {
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
      await refreshData();
      // Toast removed - let the component handle notifications
    } catch (error: any) {
      console.error("Error rejecting shop:", error);
      throw error; // Re-throw to let component handle the error
    }
  };

  const mintShopBalance = async (shopId: string, amount: number) => {
    try {
      const success = await adminApi.mintTokensToShop(shopId, amount);
      if (!success) {
        throw new Error("Failed to mint tokens");
      }
      await refreshData();
      toast.success(`Minted ${amount} RCN to shop ${shopId}`);
    } catch (error: any) {
      console.error("Error minting tokens:", error);
      toast.error(error.message || "Failed to mint tokens");
    }
  };

  return {
    loading,
    error,
    shops,
    pendingShops,
    rejectedShops,
    refreshData,
    shopActions: {
      suspend: suspendShop,
      unsuspend: unsuspendShop,
      verify: verifyShop,
      approve: approveShop,
      reject: rejectShop,
      mintBalance: mintShopBalance,
    },
  };
}