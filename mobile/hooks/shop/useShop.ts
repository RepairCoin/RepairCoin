import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { router } from "expo-router";
import { CreateShopRequest } from "@/interfaces/shop.interface";
import { shopApi } from "@/services/shop.services";

export function useShop() {
  const useRegisterShop = () => {
    const login = useAuthStore((state) => state.login);

    return useMutation({
      mutationFn: async (formData: CreateShopRequest) => {
        if (!formData.walletAddress) {
          throw new Error("No wallet address provided");
        }

        return await shopApi.register(formData);
      },
      onSuccess: async (result) => {
        if (result.success) {
          await login();
          router.push("/shop/tabs/home");
        }
      },
      onError: (error: any) => {
        console.error("[useRegisterShop] Error:", error);
        throw error;
      },
    });
  };

  return {
    useRegisterShop,
  }
}
