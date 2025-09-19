"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { authManager } from "@/utils/auth";
import { useAuth } from "./useAuth";
import { adminApi } from "@/services/api/admin";

export interface AdminProfile {
  address: string;
  name?: string;
  email?: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

export function useAdminAuth() {
  // Leverage the existing useAuth hook for base authentication
  const { account, isAdmin: isAdminFromAuth, isLoading: baseAuthLoading } = useAuth();
  
  // Admin-specific state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminProfileLoading, setAdminProfileLoading] = useState(true);
  
  // Combine loading states
  const loading = baseAuthLoading || adminProfileLoading;

  // Generate JWT token for admin authentication
  const generateAdminToken = useCallback(async (
    forceRefresh: boolean = false
  ): Promise<string | null> => {
    console.log('🔑 generateAdminToken called', { account: account?.address, forceRefresh });
    
    if (!account?.address) {
      console.log('❌ No account address available');
      return null;
    }

    // Check if we already have a token stored (unless forcing refresh)
    if (!forceRefresh) {
      const storedToken = authManager.getToken("admin");
      if (storedToken) {
        console.log('✅ Using stored admin token');
        return storedToken;
      }
    }

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/admin`;
      console.log('🌐 Calling admin auth endpoint:', url);
      
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

      console.log('📨 Admin auth response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Admin auth successful:', data);
        const token = data.token;
        if (token) {
          // Store token using authManager
          authManager.setToken("admin", token, 24); // 24 hour expiry
          
          // Also store in localStorage for the axios interceptor
          localStorage.setItem("adminAuthToken", token);
          console.log('💾 Admin token stored in localStorage');
          
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
        console.error("❌ Admin auth failed:", response.status, errorData);
        toast.error(errorData.error || "Admin authentication failed");
      }
    } catch (error) {
      console.error("❌ Failed to generate admin token:", error);
      toast.error("Network error during authentication");
    }

    return null;
  }, [account, setIsSuperAdmin]);

  // Fetch admin profile with permissions
  const fetchAdminProfile = useCallback(async () => {
    if (!account?.address) return null;
    
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        console.error("Failed to generate admin token for profile fetch");
        return null;
      }
      
      // Use the admin API service
      const profile = await adminApi.getAdminProfile();
      console.log("Admin profile response:", profile);
      return profile;
    } catch (error) {
      console.error("Error fetching admin profile:", error);
      return null;
    }
  }, [account, generateAdminToken]);

  // Check admin-specific permissions and status
  useEffect(() => {
    // Reset admin-specific state when account changes
    console.log("Account changed, resetting admin permissions");
    setIsSuperAdmin(false);
    setAdminPermissions([]);
    
    // Clear any cached admin tokens
    authManager.clearToken("admin");
    localStorage.removeItem('isSuperAdmin');
    
    setAdminProfileLoading(true);
    
    const checkAdminStatus = async () => {
      if (!account?.address || !isAdminFromAuth) {
        console.log("No account address or not an admin");
        setAdminProfileLoading(false);
        return;
      }

      console.log("Checking admin permissions for:", account.address);

      // First, check if this is the super admin from env
      const adminAddresses = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || "")
        .split(",")
        .map((addr) => addr.toLowerCase().trim())
        .filter(addr => addr.length > 0);
      
      const isSuperAdminFromEnv = adminAddresses.length > 0 && adminAddresses[0] === account.address.toLowerCase();
      
      console.log("Admin addresses from env:", adminAddresses);
      console.log("Is super admin from env:", isSuperAdminFromEnv);

      try {
        // Small delay to ensure wallet is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to fetch admin profile - this will confirm admin status and get permissions
        // Note: If the /admin/me endpoint doesn't exist, we'll fall back to env-based determination
        const profile = await fetchAdminProfile();
        
        if (profile) {
          // Admin profile fetched successfully
          console.log("Admin profile fetched:", profile);
          console.log("Profile says Is Super Admin:", profile.isSuperAdmin);
          console.log("Profile Permissions:", profile.permissions);
          
          // Trust the backend's determination of super admin status
          const isSuper = profile.isSuperAdmin === true;
          setIsSuperAdmin(isSuper);
          
          // Set permissions - super admin gets ['*'], others get specific permissions
          const perms = profile.permissions || [];
          setAdminPermissions(perms);
          
          console.log("Final state - isSuperAdmin:", isSuper);
          console.log("Final state - permissions:", perms);
          
          // Store super admin status for future reference
          if (isSuper) {
            localStorage.setItem('isSuperAdmin', 'true');
          } else {
            localStorage.removeItem('isSuperAdmin');
          }
        } else {
          // Fallback: If no profile endpoint exists, use env-based determination
          console.log("No admin profile found, using env-based determination");
          
          // For backwards compatibility, assume super admin if first in env list
          if (isSuperAdminFromEnv) {
            setIsSuperAdmin(true);
            setAdminPermissions(['*']); // Super admin gets all permissions
            localStorage.setItem('isSuperAdmin', 'true');
          } else {
            // Regular admin
            setIsSuperAdmin(false);
            setAdminPermissions(['shops.view', 'customers.view', 'transactions.view']);
            localStorage.removeItem('isSuperAdmin');
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
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
    console.log("Checking permission:", permission, "Result:", isSuperAdmin || adminPermissions.includes('*') || adminPermissions.includes(permission));
    return isSuperAdmin || adminPermissions.includes('*') || adminPermissions.includes(permission);
  }, [isSuperAdmin, adminPermissions]);

  return {
    account,
    isAdmin: isAdminFromAuth,
    isSuperAdmin,
    adminPermissions,
    loading,
    generateAdminToken,
    hasPermission,
  };
}