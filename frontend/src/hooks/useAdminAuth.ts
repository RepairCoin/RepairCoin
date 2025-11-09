"use client";

import { useState, useEffect, useCallback } from "react";
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
  
  // Combine loading states
  const loading = baseAuthLoading || adminProfileLoading;

  // Generate JWT token for admin authentication
  const generateAdminToken = useCallback(async (
    forceRefresh: boolean = false
  ): Promise<string | null> => {
    if (!account?.address) {
      return null;
    }

    // Check if we already have a token stored (unless forcing refresh)
    if (!forceRefresh) {
      const storedToken = authManager.getToken("admin");
      if (storedToken) {
        return storedToken;
      }
    }

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/admin`;
      
      // Note: auth/admin endpoint is not in adminApi, using direct fetch
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: account.address,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.token;
        if (token) {
          // Store token using authManager
          authManager.setToken("admin", token, 24); // 24 hour expiry
          
          // Also store in localStorage for the axios interceptor
          localStorage.setItem("adminAuthToken", token);
          
          // Update super admin status if provided in response
          if (data.user?.isSuperAdmin !== undefined) {
            setIsSuperAdmin(data.user.isSuperAdmin);
            if (data.user.isSuperAdmin) {
              localStorage.setItem('isSuperAdmin', 'true');
            } else {
              localStorage.removeItem('isSuperAdmin');
            }
          }
          
          return token;
        }
      } else {
        const errorData = await response.json();
        // Only show error if it's not a 403 (which is expected when switching from admin to non-admin)
        if (response.status !== 403) {
          console.error("Admin auth failed:", response.status, errorData);
          toast.error(errorData.error || "Admin authentication failed");
        }
        // For 403, silently fail as this is expected when the user is not an admin
      }
    } catch (error) {
      console.error("Failed to generate admin token:", error);
      toast.error("Network error during authentication");
    }

    return null;
  }, [account, setIsSuperAdmin]);

  // Fetch admin profile with permissions
  const fetchAdminProfile = useCallback(async () => {
    if (!account?.address) return null;
    
    // Don't attempt to fetch admin profile if not an admin
    if (!isAdminFromAuth) return null;
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        // Don't log error - this is expected when switching from admin to non-admin
        return null;
      }
      
      // Use the admin API service
      const profile = await adminApi.getAdminProfile();
      return profile;
    } catch (error) {
      return null;
    }
  }, [account, generateAdminToken, isAdminFromAuth]);

  // Check admin-specific permissions and status
  useEffect(() => {
    // Reset admin-specific state when account changes
    setIsSuperAdmin(false);
    setAdminRole("");
    setAdminPermissions([]);
    
    // Clear any cached admin tokens
    authManager.clearToken("admin");
    localStorage.removeItem('isSuperAdmin');
    localStorage.removeItem('adminRole');
    
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
          localStorage.setItem('adminRole', role);
          
          // Set permissions - super admin gets ['*'], others get specific permissions
          const perms = profile.permissions || [];
          setAdminPermissions(perms);
          
          // Store super admin status for future reference
          if (isSuper) {
            localStorage.setItem('isSuperAdmin', 'true');
          } else {
            localStorage.removeItem('isSuperAdmin');
          }
        } else {
          // Fallback: If no profile endpoint exists, use env-based determination
          // All addresses in ADMIN_ADDRESSES are super admins
          if (isSuperAdminFromEnv) {
            setIsSuperAdmin(true);
            setAdminRole('super_admin');
            setAdminPermissions(['*']); // Super admin gets all permissions
            localStorage.setItem('isSuperAdmin', 'true');
            localStorage.setItem('adminRole', 'super_admin');
          } else {
            // Regular admin
            setIsSuperAdmin(false);
            setAdminRole('admin');
            setAdminPermissions(['shops.view', 'customers.view', 'transactions.view']);
            localStorage.removeItem('isSuperAdmin');
            localStorage.setItem('adminRole', 'admin');
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
    generateAdminToken,
    hasPermission,
  };
}