import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useShop } from "./useShopQuery";
import { apiClient } from "@/shared/utilities/axios";
import { SubscriptionFormData, SubscriptionResponse } from "../types";

export function useSubscriptionForm() {
  const router = useRouter();
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData, isLoading: isLoadingShop } = useGetShopByWalletAddress(
    account?.address || ""
  );
  const { showSuccess, showError } = useAppToast();

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

      const result = await apiClient.post<SubscriptionResponse>(
        "/shops/subscription/subscribe-mobile",
        {
          billingEmail: formData.email,
          billingContact: formData.shopName,
          billingPhone: formData.phoneNumber,
          billingAddress: formData.shopAddress,
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to create subscription");
      }

      if (result.data?.clientSecret) {
        router.push({
          pathname: "/shop/payment/payment-card",
          params: {
            clientSecret: result.data.clientSecret,
            subscriptionId: result.data.subscriptionId || "",
          },
        });
      } else {
        showSuccess(result.data?.nextSteps || result.data?.message || "Subscription created successfully!");

        setTimeout(() => {
          router.push("/shop/tabs/home");
        }, 3000);
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
