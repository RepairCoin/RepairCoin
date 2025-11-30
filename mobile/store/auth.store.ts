import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

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
  token: string | null;
  userType: string | null;
  userProfile: any;

  // Actions
  setAccount: (account: any) => void;
  setToken: (token: string) => void;
  setUserType: (userType: string) => void;
  setUserProfile: (userProfile: any) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    devtools(
      (set) => ({
        // Initial state
        account: null,
        token: null,
        userType: null,
        userProfile: null,

        // Actions
        setAccount: (account) => {
          set({ account }, false, "setAccount");
        },

        setToken: (token) => {
          set({ token }, false, "setToken");
        },

        setUserType: (userType) => {
          set({ userType }, false, "setUserType");
        },

        setUserProfile: (userProfile) => {
          set({ userProfile }, false, "setUserProfile");
        }
      }),
      { name: "AuthStore" }
    ),
    {
      name: "AuthStore",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
