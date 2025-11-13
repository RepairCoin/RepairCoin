"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { authManager } from "@/utils/auth";
import { adminApi } from "@/services/api/admin";
import { useAuthStore } from "@/stores/authStore";

export interface AdminProfile {
  address: string;
  name?: string;
  email?: string;
  isSuperAdmin: boolean;
  permissions: string[];
  role?: string;
}

export function useAdminAuth() {
  // Leverage the existing useAuth hook for base authentication
  const { account, isAdmin: isAdminFromAuth, isLoading: baseAuthLoading } = useAuthStore();

  // Admin-specific state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string>("");
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminProfileLoading, setAdminProfileLoading] = useState(true);

  // Track previous account address to detect actual changes
  const previousAddressRef = useRef<string | null>(null);

  // Combine loading states
  const loading = baseAuthLoading || adminProfileLoading;

  // NOTE: authenticateAdmin removed - authentication is handled by useAuthInitializer
  // Admin authentication happens automatically when wallet connects

  // Fetch admin profile with permissions (cookies sent automatically)
  const fetchAdminProfile = useCallback(async () => {
    if (!account?.address) return null;

    // Don't attempt to fetch admin profile if not an admin
    if (!isAdminFromAuth) return null;

    try {
      // NOTE: Authentication is now handled globally by useAuthInitializer
      // Just fetch the admin profile directly (cookies are already set)
      const profile = await adminApi.getAdminProfile();
      return profile;
    } catch {
      return null;
    }
  }, [account, isAdminFromAuth]);

  // Check admin-specific permissions and status
  useEffect(() => {
    // Reset admin-specific state when account changes
    setIsSuperAdmin(false);
    setAdminRole("");
    setAdminPermissions([]);
    const currentAddress = account?.address || null;
    const hasAddressChanged = previousAddressRef.current !== currentAddress;

    // Only clear tokens if the address actually changed (account switch or disconnect)
    if (hasAddressChanged && previousAddressRef.current !== null) {
      console.log("🔄 Account changed, clearing admin tokens");
      authManager.clearToken("admin");
      localStorage.removeItem('adminAuthToken');
      localStorage.removeItem('isSuperAdmin');
      localStorage.removeItem('adminRole');
    }

    // Update the previous address ref
    previousAddressRef.current = currentAddress;

    // Reset admin-specific state when account changes or on first load
    if (hasAddressChanged) {
      setIsSuperAdmin(false);
      setAdminRole("");
      setAdminPermissions([]);
    }

    setAdminProfileLoading(true);

    const checkAdminStatus = async () => {
      if (!account?.address || !isAdminFromAuth) {
        setAdminProfileLoading(false);
        return;
      }

      // Check if this is a super admin from env (all addresses in ADMIN_ADDRESSES are super admins)
      const adminAddresses = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || "")
        .split(",")
        .map((addr) => addr.toLowerCase().trim())
        .filter(addr => addr.length > 0);

      // All addresses in ADMIN_ADDRESSES are super admins
      const isSuperAdminFromEnv = adminAddresses.includes(account.address.toLowerCase());

      console.log("=== ADMIN AUTH DEBUG ===");
      console.log("NEXT_PUBLIC_ADMIN_ADDRESSES env:", process.env.NEXT_PUBLIC_ADMIN_ADDRESSES);
      console.log("Parsed admin addresses:", adminAddresses);
      console.log("Connected wallet address:", account.address);
      console.log("Connected wallet (lowercase):", account.address.toLowerCase());
      console.log("Is super admin from env:", isSuperAdminFromEnv);
      console.log("=======================")

      try {
        // Small delay to ensure wallet is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to fetch admin profile - this will confirm admin status and get permissions
        // Note: If the /admin/me endpoint doesn't exist, we'll fall back to env-based determination
        const profile = await fetchAdminProfile();
        
        if (profile) {
          // Admin profile fetched successfully
          // Trust the backend's determination of super admin status
          const isSuper = profile.isSuperAdmin === true;
          setIsSuperAdmin(isSuper);

          // Set role from profile
          const role = profile.role || (isSuper ? 'super_admin' : 'admin');
          setAdminRole(role);

          // Set permissions - super admin gets ['*'], others get specific permissions
          const perms = profile.permissions || [];
          setAdminPermissions(perms);
        } else {
          // Fallback: If no profile endpoint exists, use env-based determination
          // All addresses in ADMIN_ADDRESSES are super admins
          if (isSuperAdminFromEnv) {
            setIsSuperAdmin(true);
            setAdminRole('super_admin');
            setAdminPermissions(['*']); // Super admin gets all permissions
          } else {
            // Regular admin
            setIsSuperAdmin(false);
            setAdminRole('admin');
            setAdminPermissions(['shops.view', 'customers.view', 'transactions.view']);
          }
        }
      } catch {
        // Silent fail
      } finally {
        setAdminProfileLoading(false);
      }
    };

    // Only check admin status if user is authenticated as admin from base auth
    if (account?.address && isAdminFromAuth) {
      checkAdminStatus();
    } else {
      setAdminProfileLoading(false);
    }
  }, [account, isAdminFromAuth, fetchAdminProfile]);

  // Helper function to check if user has a specific permission
  const hasPermission = useCallback((permission: string) => {
    return isSuperAdmin || adminPermissions.includes('*') || adminPermissions.includes(permission);
  }, [isSuperAdmin, adminPermissions]);

  return {
    account,
    isAdmin: isAdminFromAuth,
    isSuperAdmin,
    adminRole,
    adminPermissions,
    loading,
    hasPermission,
  };
}