import { useState, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { apiClient } from "@/shared/utilities/axios";
import { useShop } from "../../account/hooks/useShopQuery";
import { SubscriptionFormData } from "../../services/shop.interface";

export function useSubscriptionForm() {
  const router = useRouter();
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData, isLoading: isLoadingShop } = useGetShopByWalletAddress(
    account?.address || ""
  );
  const { showError } = useAppToast();

  const [formData, setFormData] = useState<SubscriptionFormData>({
    shopName: "",
    email: "",
    phoneNumber: "",
    shopAddress: "",
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shopData) {
      setFormData((prev) => ({
        ...prev,
        shopName: shopData?.name || "",
        email: shopData?.email || "",
        phoneNumber: shopData?.phone || "",
        shopAddress: shopData?.address || "",
      }));
    }
  }, [shopData]);

  const updateFormData = <K extends keyof SubscriptionFormData>(
    field: K,
    value: SubscriptionFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    formData.shopName.trim() !== "" &&
    formData.email.trim() !== "" &&
    formData.phoneNumber.trim() !== "" &&
    formData.shopAddress.trim() !== "" &&
    formData.acceptTerms;

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (
        !formData.email ||
        !formData.shopName ||
        !formData.phoneNumber ||
        !formData.shopAddress
      ) {
        setError("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      const result = await apiClient.post<any>(
        "/shops/subscription/checkout-mobile",
        {
          billingEmail: formData.email,
          billingContact: formData.shopName,
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to create checkout session");
      }

      if (!result.data?.checkoutUrl) {
        throw new Error("No checkout URL returned");
      }

      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.data.checkoutUrl,
        "repaircoin://"
      );

      if (browserResult.type === "success") {
        const url = browserResult.url;
        if (url.includes("subscription-success")) {
          router.replace("/subscription-success");
        }
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Something went wrong";
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  return {
    formData,
    updateFormData,
    isFormValid,
    isLoading,
    isLoadingShop,
    error,
    handleSubmit,
    handleGoBack,
  };
}
