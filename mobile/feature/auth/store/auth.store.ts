import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import apiClient from "@/shared/utilities/axios";
import { AuthMethod } from "../types";

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
  account: any;
  accessToken: string | null;
  refreshToken: string | null;
  userType: string | null;
  userProfile: any;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  isLoading: boolean;
  authMethod: AuthMethod;
  setAccount: (account: any) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  setUserType: (userType: string) => void;
  setUserProfile: (userProfile: any) => void;
  setHasHydrated: (state: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setAuthMethod: (method: AuthMethod) => void;
  resetState: () => void;
  checkStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    devtools(
      (set, get) => ({
        account: null,
        accessToken: null,
        refreshToken: null,
        userType: null,
        userProfile: null,
        isAuthenticated: false,
        hasHydrated: false,
        isLoading: false,
        authMethod: null,
        setAccount: (account) => {
          set({ account }, false, "setAccount");
        },
        setHasHydrated: (state) => {
          set({ hasHydrated: state }, false, "setHasHydrated");
        },
        setIsLoading: (isLoading) => {
          set({ isLoading }, false, "setIsLoading");
        },
        setAuthMethod: (method) => {
          set({ authMethod: method }, false, "setAuthMethod");
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
            "setUserProfile",
          );
        },
        checkStoredAuth: async () => {
          const state = get();
          if (!state.accessToken || !state.userType) {
            return;
          }

          try {
            set({ isLoading: true }, false, "checkStoredAuth:start");

            // Re-fetch user profile based on user type
            if (state.userType === "shop" && state.userProfile?.walletAddress) {
              const response = await apiClient.get(
                `/shops/wallet/${state.userProfile.walletAddress}`,
              );
              if (response?.data?.shop) {
                set(
                  { userProfile: response.data.shop },
                  false,
                  "checkStoredAuth:updateProfile",
                );
              }
            } else if (
              state.userType === "customer" &&
              state.userProfile?.walletAddress
            ) {
              const response = await apiClient.get(
                `/customers/wallet/${state.userProfile.walletAddress}`,
              );
              if (response?.data?.customer) {
                set(
                  { userProfile: response.data.customer },
                  false,
                  "checkStoredAuth:updateProfile",
                );
              }
            }
          } catch (error) {
            console.error("[Auth] Error checking stored auth:", error);
          } finally {
            set({ isLoading: false }, false, "checkStoredAuth:end");
          }
        },
        resetState: () => {
          set(
            {
              account: null,
              userProfile: null,
              isAuthenticated: false,
              userType: null,
              accessToken: null,
              refreshToken: null,
              isLoading: false,
              authMethod: null,
            },
            false,
            "resetState",
          );
        },
      }),
      { name: "auth-store" },
    ),
    {
      name: "auth-store",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        account: state.account,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userType: state.userType,
        userProfile: state.userProfile,
        isAuthenticated: state.isAuthenticated,
        authMethod: state.authMethod,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        console.log("[Auth] Store hydrated");
      },
    },
  ),
);
