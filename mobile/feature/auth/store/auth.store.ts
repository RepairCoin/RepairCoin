import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { AuthMethod } from "../types";
export type { AuthMethod };

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
  isDemo: boolean;
  authMethod: AuthMethod;
  setAccount: (account: any) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  setUserType: (userType: string) => void;
  setUserProfile: (userProfile: any) => void;
  setHasHydrated: (state: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsDemo: (isDemo: boolean) => void;
  setAuthMethod: (method: AuthMethod) => void;
  resetState: () => void;
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
        isDemo: false,
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
        setIsDemo: (isDemo) => {
          set({ isDemo }, false, "setIsDemo");
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
              isDemo: false,
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
        isDemo: state.isDemo,
        authMethod: state.authMethod,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        console.log("[Auth] Store hydrated");
      },
    },
  ),
);
