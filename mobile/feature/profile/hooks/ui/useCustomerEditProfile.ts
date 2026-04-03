import { useState, useEffect, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/shared/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useCustomerProfileQuery } from "../queries";
import { useUpdateCustomerProfileMutation } from "../mutations";
import { CustomerEditFormData } from "../../types";
import { isValidEmail } from "../../utils";
import { queryClient, queryKeys } from "@/shared/config/queryClient";

/**
 * Hook for customer edit profile screen
 */
export const useCustomerEditProfile = () => {
  const { account, accessToken } = useAuthStore();
  const { data: customerData } = useCustomerProfileQuery(account?.address || "");
  const updateProfileMutation = useUpdateCustomerProfileMutation(account?.address || "");
  const { showSuccess, showError, showWarning } = useAppToast();

  const [formData, setFormData] = useState<CustomerEditFormData>({
    name: "",
    email: "",
    phone: "",
    profileImageUrl: "",
  });

  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Initialize form data when customer data loads
  useEffect(() => {
    if (customerData?.customer) {
      const imageUrl = customerData.customer.profileImageUrl || customerData.customer.profile_image_url || "";
      setFormData({
        name: customerData.customer.name || "",
        email: customerData.customer.email || "",
        phone: customerData.customer.phone || "",
        profileImageUrl: imageUrl,
      });
      setSelectedAvatar(imageUrl || null);
    }
  }, [customerData]);

  const updateField = useCallback((field: keyof CustomerEditFormData) => (text: string) => {
    setFormData((prev) => ({ ...prev, [field]: text }));
  }, []);

  // Upload avatar image to server
  const uploadAvatar = useCallback(async (uri: string): Promise<string | null> => {
    try {
      setIsUploadingAvatar(true);

      if (!accessToken) {
        throw new Error("Authentication required");
      }

      const filename = uri.split("/").pop() || "avatar.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : "image/jpeg";

      const uploadFormData = new FormData();
      uploadFormData.append("image", {
        uri,
        name: filename,
        type: mimeType,
      } as any);

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";
      const url = `${baseUrl}/upload/customer-avatar`;

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

      // Refetch so account screen picks up the new image immediately
      if (account?.address) {
        await queryClient.refetchQueries({
          queryKey: queryKeys.customerProfile(account.address),
        });
      }

      return result.url;
    } catch (error) {
      console.error("Upload avatar error:", error);
      showError("Failed to upload photo. Please try again.");
      return null;
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [accessToken, account?.address, showError]);

  // Handle avatar pick
  const handleAvatarPick = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
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
      setSelectedAvatar(localUri);

      const uploadedUrl = await uploadAvatar(localUri);

      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, profileImageUrl: uploadedUrl }));
      } else {
        // Revert to previous image on failure
        setSelectedAvatar(formData.profileImageUrl || null);
      }
    }
  }, [uploadAvatar, formData.profileImageUrl, showWarning]);

  // Remove avatar
  const removeAvatar = useCallback(() => {
    setSelectedAvatar(null);
    setFormData((prev) => ({ ...prev, profileImageUrl: "" }));
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!isValidEmail(formData.email)) {
      showError("Please enter a valid email address");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        profile_image_url: formData.profileImageUrl,
      });

      // Refetch so account screen updates immediately
      if (account?.address) {
        await queryClient.refetchQueries({
          queryKey: queryKeys.customerProfile(account.address),
        });
      }

      showSuccess("Profile updated successfully");
      goBack();
    } catch (error) {
      showError("Failed to update profile. Please try again.");
      console.error("Error updating profile:", error);
    }
  }, [formData, updateProfileMutation, showSuccess, showError]);

  return {
    formData,
    updateField,
    handleSaveChanges,
    isPending: updateProfileMutation.isPending,
    walletAddress: account?.address,
    goBack,
    // Avatar upload
    selectedAvatar,
    isUploadingAvatar,
    handleAvatarPick,
    removeAvatar,
  };
};
