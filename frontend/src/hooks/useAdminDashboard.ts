"use client";

import { useAdminAuth } from './useAdminAuth';
import { useAdminDashboardData } from './useAdminDashboardData';

export function useAdminDashboard(options?: {
  skipDataLoad?: boolean; // Skip initial data load (useful for components that don't need data)
}) {
  // Get authentication data and functions
  const {
    account,
    isAdmin,
    isSuperAdmin,
    adminRole,
    adminPermissions,
    loading: authLoading,
    hasPermission,
  } = useAdminAuth();

  // Get dashboard data and actions
  // Only load data if not explicitly skipped
  const {
    loading: dataLoading,
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
  } = useAdminDashboardData(
    options?.skipDataLoad ? false : isAdmin,
    isSuperAdmin,
    adminRole,
    adminPermissions,
    hasPermission
  );

  // Combined loading state
  const loading = authLoading || (options?.skipDataLoad ? false : dataLoading);

  return {
    // Authentication
    account,
    isAdmin,
    isSuperAdmin,
    adminRole,
    adminPermissions,
    hasPermission,

    // Data
    stats,
    shops,
    pendingShops,
    rejectedShops,
    
    // State
    loading,
    authLoading,
    dataLoading,
    error,
    setError,
    
    // Data actions
    loadDashboardData,
    refreshData: loadDashboardData, // Alias for clarity
    
    // Shop actions
    shopActions: {
      suspend: suspendShop,
      unsuspend: unsuspendShop,
      verify: verifyShop,
      approve: approveShop,
      reject: rejectShop,
      mintBalance: mintShopBalance,
    },
    
    // Customer actions
    customerActions: {
      mintTokens: mintTokensToCustomer,
      suspend: suspendCustomer,
      unsuspend: unsuspendCustomer,
    },
    
    // Individual action exports for backward compatibility
    suspendShop,
    unsuspendShop,
    verifyShop,
    approveShop,
    rejectShop,
    mintShopBalance,
    mintTokensToCustomer,
    suspendCustomer,
    unsuspendCustomer,
  };
}

// Re-export types for convenience
export type { PlatformStats, Shop } from './useAdminDashboardData';
export type { AdminProfile } from './useAdminAuth';