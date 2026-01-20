import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useShop } from "@/hooks/shop/useShop";
import { apiClient } from "@/utilities/axios";
import { SubscriptionFormData, SubscriptionResponse } from "../../types";

export function useSubscriptionForm() {
  const router = useRouter();
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData, isLoading: isLoadingShop } = useGetShopByWalletAddress(
    account?.address || ""
  );

  const [formData, setFormData] = useState<SubscriptionFormData>({
    shopName: "",
    email: "",
    phoneNumber: "",
    shopAddress: "",
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form with existing shop data
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

      // Validate form
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

      // Use the mobile-specific endpoint that returns clientSecret for native payment
      const result = await apiClient.post<SubscriptionResponse>(
        "/shops/subscription/subscribe-mobile",
        {
          billingEmail: formData.email,
          billingContact: formData.shopName,
          billingPhone: formData.phoneNumber,
          billingAddress: formData.shopAddress,
        }
      );

      // Check if response is successful
      if (!result.success) {
        throw new Error(result.error || "Failed to create subscription");
      }

      // Handle native payment with clientSecret
      if (result.data?.clientSecret) {
        // Navigate to native payment screen with clientSecret
        router.push({
          pathname: "/shop/payment/payment-card",
          params: {
            clientSecret: result.data.clientSecret,
            subscriptionId: result.data.subscriptionId || "",
          },
        });
      } else {
        // Fallback: Show success message if no payment required
        Alert.alert(
          "Success",
          result.data?.nextSteps || result.data?.message || "Subscription created successfully!"
        );

        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push("/shop/tabs/home");
        }, 3000);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Something went wrong";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
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
