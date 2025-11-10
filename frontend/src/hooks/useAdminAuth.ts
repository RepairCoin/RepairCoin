"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";
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
  const authInProgressRef = useRef(false);

  // Combine loading states
  const loading = baseAuthLoading || adminProfileLoading;

  // Authenticate admin (cookie set by backend automatically)
  const authenticateAdmin = useCallback(async (): Promise<boolean> => {
    if (!account?.address) {
      return false;
    }

    // Prevent duplicate authentication attempts
    if (authInProgressRef.current) {
      console.log('[useAdminAuth] Authentication already in progress, skipping duplicate call');
      return false;
    }

    authInProgressRef.current = true;

    try {
      const response = await apiClient.post('/auth/admin', {
        address: account.address,
      });

      if (response.success && response.data) {
        console.log("=".repeat(60));
        console.log("🔐 ADMIN DATA (Admin POV):");
        console.log("=".repeat(60));
        console.log("Address:", account.address);
        console.log("Is Super Admin:", response.data.user?.isSuperAdmin);
        console.log("Role:", response.data.user?.role);
        console.log("Permissions:", response.data.user?.permissions || "Not specified");
        console.log("=".repeat(60));
        console.log("Full Admin Object:", response.data.user);
        console.log("=".repeat(60));

        // Update super admin status from response
        if (response.data.user?.isSuperAdmin !== undefined) {
          setIsSuperAdmin(response.data.user.isSuperAdmin);
        }
        return true;
      } else {
        // Silently fail for non-admins (403 is expected)
        return false;
      }
    } catch (error) {
      console.error("Failed to authenticate admin:", error);
      return false;
    } finally {
      authInProgressRef.current = false;
    }
  }, [account, setIsSuperAdmin]);

  // Fetch admin profile with permissions (cookies sent automatically)
  const fetchAdminProfile = useCallback(async () => {
    if (!account?.address) return null;

    // Don't attempt to fetch admin profile if not an admin
    if (!isAdminFromAuth) return null;

    try {
      // Ensure admin is authenticated
      const authenticated = await authenticateAdmin();
      if (!authenticated) {
        return null;
      }

      // Use the admin API service (cookies sent automatically)
      const profile = await adminApi.getAdminProfile();
      return profile;
    } catch (error) {
      return null;
    }
  }, [account, authenticateAdmin, isAdminFromAuth]);

  // Check admin-specific permissions and status
  useEffect(() => {
    // Reset admin-specific state when account changes
    setIsSuperAdmin(false);
    setAdminRole("");
    setAdminPermissions([]);

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
      } catch (error) {
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
    authenticateAdmin,
    hasPermission,
  };
}