import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/feature/auth/services/auth.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";
import { useAppToast } from "@/shared/hooks/useAppToast";

export const useDemoLogin = () => {
  const setAccount = useAuthStore((state) => state.setAccount);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
  const setUserType = useAuthStore((state) => state.setUserType);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);
  const setIsDemo = useAuthStore((state) => state.setIsDemo);
  const { showError } = useAppToast();

  return useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      return await authApi.loginDemo();
    },
    onSuccess: (result) => {
      if (result.success) {
        const address = result.address;
        setAccount({ address });
        setUserProfile(result.profile);
        setAccessToken(result.token);
        setRefreshToken("");
        setUserType("customer");
        setIsDemo(true);
        apiClient.setAuthToken(result.token);
        router.replace("/customer/tabs/home");
      } else {
        showError("Could not start demo mode. Please try again.");
        setIsLoading(false);
      }
    },
    onError: (error: any) => {
      console.error("[useDemoLogin] Error:", error);
      setIsLoading(false);
      if (!error?.__toastShown) {
        showError("Could not start demo mode. Please try again.");
      }
    },
  });
};

export const useGetToken = () => {
  return useMutation({
    mutationFn: async (address: string) => {
      return await authApi.getToken(address);
    },
    onError: (error) => {
      console.log("[useGetToken] Error:", error);
    },
  });
};

export const useGetProfile = () => {
  return useMutation({
    mutationFn: async (address: string) => {
      return await authApi.checkUserExists(address);
    },
    onError: (error) => {
      console.log("[useCheckUserExists] Error:", error);
    },
  });
};

export const useConnectWallet = () => {
  const setAccount = useAuthStore((state) => state.setAccount);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
  const setUserType = useAuthStore((state) => state.setUserType);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);
  const { showError } = useAppToast();

  const getTokenMutation = useGetToken();

  return useMutation({
    mutationFn: async (params: { address: string; email?: string }) => {
      const { address, email } = params;
      if (!address) {
        throw new Error("No wallet address provided");
      }
      setIsLoading(true);
      setAccount({ address, email });

      return await authApi.checkUserExists(address);
    },
    onSuccess: async (result, params) => {
      const { address } = params;
      if (!result.exists) {
        router.replace("/register");
        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      const user = result.user as Record<string, any>;
      const userType = result.type;

      if (
        userType === "shop" &&
        (!user?.verified || !user?.active)
      ) {
        setUserProfile(user);
        setUserType("shop");
        const isActive = user?.isActive ?? user?.active;
        const isSuspended =
          !!user?.suspendedAt ||
          !!user?.suspended_at ||
          (user?.verified && !isActive);
        router.replace(
          isSuspended ? "/register/suspended" : "/register/pending",
        );
        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      try {
        const getTokenResult = await getTokenMutation.mutateAsync(address);
        if (getTokenResult.success) {
          setUserProfile(user);
          setAccessToken(getTokenResult.token);
          const refreshTk = getTokenResult.data?.refreshToken || getTokenResult.refreshToken || "";
          setRefreshToken(refreshTk);
          setUserType(userType);
          apiClient.setAuthToken(getTokenResult.token);

          if (userType === "customer") {
            router.replace("/customer/tabs/home");
          } else if (userType === "shop") {
            router.replace("/shop/tabs/home");
          } else {
            router.replace("/customer/tabs/home");
          }
        } else {
          console.error(
            "[useConnectWallet] Token result not successful:",
            getTokenResult,
          );
          showError("Could not complete sign-in. Please try again.");
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("[useConnectWallet] Token error:", err);
        if (userType === "shop") {
          setUserProfile(user);
          setUserType("shop");
          const isActive = user?.isActive ?? user?.active;
          const isSuspended =
            !!user?.suspendedAt ||
            !!user?.suspended_at ||
            (user?.verified && !isActive);
          router.replace(
            isSuspended ? "/register/suspended" : "/register/pending",
          );
          setTimeout(() => setIsLoading(false), 500);
        } else {
          if (!err?.__toastShown) {
            showError("Could not complete sign-in. Please try again.");
          }
          setIsLoading(false);
        }
      }
    },
    onError: (error: any) => {
      console.error("[useConnectWallet] Error:", error);
      if (error?.response?.status === 404 || error?.status === 404) {
        console.log(
          "[useConnectWallet] User not found, redirecting to register...",
        );
        router.replace("/register");
        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      setIsLoading(false);

      if (!error?.__toastShown) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Something went wrong. Please try again.";
        showError(message);
      }
    },
  });
};

