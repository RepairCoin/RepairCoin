import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/store/auth.store";
import { useShopProfileByWalletQuery } from "../queries";
import { useUpdateShopProfileMutation } from "../mutations";
import { ShopEditFormData } from "../../types";
import { isValidEmail } from "../../utils";

/**
 * Hook for shop edit profile screen
 */
export const useShopEditProfile = () => {
  const { account } = useAuthStore();
  const { data: shopData } = useShopProfileByWalletQuery(account?.address || "");
  const updateShopMutation = useUpdateShopProfileMutation(account?.address || "");

  const [formData, setFormData] = useState<ShopEditFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    facebook: "",
    twitter: "",
    instagram: "",
    website: "",
    walletAddress: "",
    location: {
      lat: "",
      lng: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Initialize form data when shop data loads
  useEffect(() => {
    if (shopData) {
      setFormData({
        name: shopData.name || "",
        email: shopData.email || "",
        phone: shopData.phone || "",
        address: shopData.address || "",
        city: shopData.location?.city || "",
        country: shopData.country || "",
        facebook: shopData.facebook || "",
        twitter: shopData.twitter || "",
        instagram: shopData.instagram || "",
        website: shopData.website || "",
        walletAddress: shopData.walletAddress || "",
        location: {
          lat: shopData.location?.lat || "",
          lng: shopData.location?.lng || "",
          city: shopData.location?.city || "",
          state: shopData.location?.state || "",
          zipCode: shopData.location?.zipCode || "",
        },
      });
    }
  }, [shopData]);

  const updateField = useCallback((field: keyof Omit<ShopEditFormData, "location">) => (text: string) => {
    setFormData((prev) => ({ ...prev, [field]: text }));
  }, []);

  const handleLocationSelect = useCallback((location: { lat: number; lng: number }) => {
    setFormData((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        lat: location.lat.toString(),
        lng: location.lng.toString(),
      },
    }));
    setShowLocationPicker(false);
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!shopData?.shopId) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      await updateShopMutation.mutateAsync({
        shopId: shopData.shopId,
        shopData: formData as any,
      });
      Alert.alert("Success", "Shop details updated successfully", [
        { text: "OK", onPress: () => goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update shop details");
    }
  }, [formData, shopData, updateShopMutation]);

  return {
    formData,
    updateField,
    handleSaveChanges,
    handleLocationSelect,
    showLocationPicker,
    setShowLocationPicker,
    isPending: updateShopMutation.isPending,
    goBack,
  };
};
