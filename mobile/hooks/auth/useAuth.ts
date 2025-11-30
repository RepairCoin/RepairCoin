import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/services/auth.services";
import { useAuthStore } from "@/store/auth.store";
import { router } from "expo-router";

export function useAuth() {
  const useGetToken = () => {
    return useMutation({
      mutationFn: async (address: string) => {
        return await authApi.getToken(address);
      },
      onError: (error) => {
        console.log("[useGetToken] Error:", error);
      },
    });
  };

  const useCheckUserExists = () => {
    return useMutation({
      mutationFn: async (address: string) => {
        return await authApi.checkUserExists(address);
      },
      onError: (error) => {
        console.log("[useCheckUserExists] Error:", error);
      },
    });
  };

  // Hook for connecting wallet using Zustand store
  const useConnectWallet = () => {
    const setAccount = useAuthStore((state) => state.setAccount);
    const setUserProfile = useAuthStore((state) => state.setUserProfile);
    const setToken = useAuthStore((state) => state.setToken);
    const setUserType = useAuthStore((state) => state.setUserType);
    const getTokenMutation = useGetToken();

    return useMutation({
      mutationFn: async (address: string) => {
        if (!address) {
          throw new Error("No wallet address provided");
        }
        setAccount({ address });

        return await authApi.checkUserExists(address);
      },
      onSuccess: async (result, address) => {
        if (result.exists) {
          const getTokenResult = await getTokenMutation.mutateAsync(address);
          if (getTokenResult.success) {
            setUserProfile(result.user);
            setToken(getTokenResult.token);
            setUserType(result.type);

            if (!result.exists) {
              router.push("/register");
            } else {
              if (result.type === "customer") {
                router.push("/customer/tabs/home");
              } else if (result.type === "shop") {
                const active = result.user?.isActive || false;
                if (active) {
                  router.push("/shop/tabs/home");
                } else {
                  router.push("/register/pending");
                }
              } else {
                router.push("/customer/tabs/home");
              }
            }
          }
        }
      },
      onError: (error: any) => {
        console.error("[useConnectWallet] Error:", error);
      },
    });
  };

  return {
    useGetToken,
    useCheckUserExists,
    useConnectWallet,
  };
}
