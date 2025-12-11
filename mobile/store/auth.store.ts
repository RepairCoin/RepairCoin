import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import apiClient from "@/utilities/axios";
import { router } from "expo-router";

const secureStorage = {
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
  // State
  account: any;
  accessToken: string | null;
  refreshToken: string | null;
  userType: string | null;
  userProfile: any;
  isAuthenticated: boolean;
  hasHydrated: boolean;

  // Actions
  setAccount: (account: any) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  setUserType: (userType: string) => void;
  setUserProfile: (userProfile: any) => void;
  setHasHydrated: (state: boolean) => void;
  logout: (navigate?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    devtools(
      (set, get) => ({
        // Initial state
        account: null,
        accessToken: null,
        refreshToken: null,
        userType: null,
        userProfile: null,
        isAuthenticated: false,
        hasHydrated: false,

        // Actions
        setAccount: (account) => {
          set({ account }, false, "setAccount");
        },

        setHasHydrated: (state) => {
          set({ hasHydrated: state }, false, "setHasHydrated");
        },

        setAccessToken: (accessToken) => {
          set({ accessToken }, false, "setAccessToken");
        },

        setRefreshToken: (refreshToken) => {
          set({ refreshToken }, false, "setRefreshToken");
        },

        setUserType: (userType) => {
          set({ userType }, false, "setUserType");
        },

        setUserProfile: (userProfile) => {
          set(
            {
              userProfile,
              isAuthenticated: !!(get().account && userProfile),
            },
            false,
            "setUserProfile"
          );
        },

        logout: async (navigate = true) => {
          const state = get();

          // Disconnect wallet if any
          if (state.account?.disconnect) {
            try {
              await state.account.disconnect();
              console.log("[Auth] Account disconnected");
            } catch (error) {
              console.error("[Auth] Error disconnecting:", error);
            }
          }

          // Clear axios auth token
          try {
            await apiClient.clearAuthToken();
            console.log("[Auth] API auth token cleared");
          } catch (error) {
            console.error("[Auth] Error clearing API token:", error);
          }

          // Clear SecureStore (this is what Zustand persist uses)
          try {
            const keys = ['auth-store', 'repairCoin_authData', 'repairCoin_authToken', 'repairCoin_userType', 'repairCoin_walletAddress', 'payment-session-storage'];
            await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
            console.log("[Auth] SecureStore cleared");
          } catch (error) {
            console.error("[Auth] Error clearing SecureStore:", error);
          }

          // Reset Zustand state
          set(
            {
              account: null,
              userProfile: null,
              isAuthenticated: false,
              userType: null,
              accessToken: null,
              refreshToken: null,
            },
            false,
            "logout"
          );

          console.log("[Auth] User logged out successfully");

          if (navigate) {
            router.replace("/onboarding1");
          }
        },
      }),
      { name: "auth-store" }
    ),
    {
      name: "auth-store",
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        console.log("[Auth] Store hydrated");
      },
    }
  )
);
