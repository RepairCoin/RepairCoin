import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useShopProfileByWalletQuery, useUpdateShopProfileMutation } from "../../hooks/useShopQuery";
import { ShopEditFormData } from "../../types";
import { isValidEmail } from "../../utils";

export const useShopEditProfile = () => {
  const { account, accessToken } = useAuthStore();
  const { data: shopData } = useShopProfileByWalletQuery(account?.address || "");
  const updateShopMutation = useUpdateShopProfileMutation(account?.address || "");
  const { showSuccess, showError, showWarning } = useAppToast();

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
    logoUrl: "",
    bannerUrl: "",
    location: {
      lat: "",
      lng: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

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
        logoUrl: shopData.logoUrl || "",
        bannerUrl: shopData.bannerUrl || "",
        location: {
          lat: shopData.location?.lat || "",
          lng: shopData.location?.lng || "",
          city: shopData.location?.city || "",
          state: shopData.location?.state || "",
          zipCode: shopData.location?.zipCode || "",
        },
      });
      setSelectedLogo(shopData.logoUrl || null);
      setSelectedBanner(shopData.bannerUrl || null);
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

  const uploadImage = useCallback(async (
    uri: string,
    type: "logo" | "banner"
  ): Promise<string | null> => {
    try {
      if (type === "logo") {
        setIsUploadingLogo(true);
      } else {
        setIsUploadingBanner(true);
      }

      if (!accessToken) {
        throw new Error("Authentication required");
      }

      const filename = uri.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : "image/jpeg";

      const uploadFormData = new FormData();
      uploadFormData.append("image", {
        uri: uri,
        name: filename,
        type: mimeType,
      } as any);

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";
      const endpoint = type === "logo" ? "shop-logo" : "shop-banner";
      const url = `${baseUrl}/upload/${endpoint}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Upload failed");
      }

      return result.url;
    } catch (error) {
      console.error(`Upload ${type} error:`, error);
      showError(`Failed to upload ${type}. Please try again.`);
      return null;
    } finally {
      if (type === "logo") {
        setIsUploadingLogo(false);
      } else {
        setIsUploadingBanner(false);
      }
    }
  }, [accessToken]);

  const handleLogoPick = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showWarning("Please allow access to your photo library");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setSelectedLogo(localUri);

      const uploadedUrl = await uploadImage(localUri, "logo");

      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      } else {
        setSelectedLogo(formData.logoUrl || null);
      }
    }
  }, [uploadImage, formData.logoUrl]);

  const handleBannerPick = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showWarning("Please allow access to your photo library");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setSelectedBanner(localUri);

      const uploadedUrl = await uploadImage(localUri, "banner");

      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, bannerUrl: uploadedUrl }));
      } else {
        setSelectedBanner(formData.bannerUrl || null);
      }
    }
  }, [uploadImage, formData.bannerUrl]);

  const removeLogo = useCallback(() => {
    setSelectedLogo(null);
    setFormData((prev) => ({ ...prev, logoUrl: "" }));
  }, []);

  const removeBanner = useCallback(() => {
    setSelectedBanner(null);
    setFormData((prev) => ({ ...prev, bannerUrl: "" }));
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!shopData?.shopId) {
      showError("Shop ID not found");
      return;
    }

    if (!isValidEmail(formData.email)) {
      showError("Please enter a valid email address");
      return;
    }

    try {
      await updateShopMutation.mutateAsync({
        shopId: shopData.shopId,
        shopData: formData as any,
      });
      showSuccess("Shop details updated successfully");
      goBack();
    } catch (error: any) {
      showError("Failed to update shop details");
    }
  }, [formData, shopData, updateShopMutation, showSuccess, showError]);

  return {
    formData,
    updateField,
    handleSaveChanges,
    handleLocationSelect,
    showLocationPicker,
    setShowLocationPicker,
    isPending: updateShopMutation.isPending,
    goBack,
    selectedLogo,
    selectedBanner,
    isUploadingLogo,
    isUploadingBanner,
    handleLogoPick,
    handleBannerPick,
    removeLogo,
    removeBanner,
  };
};
