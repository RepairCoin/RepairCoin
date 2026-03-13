import { useState, useEffect, useCallback } from "react";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/shared/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useCustomerProfileQuery } from "../queries";
import { useUpdateCustomerProfileMutation } from "../mutations";
import { CustomerEditFormData } from "../../types";
import { isValidEmail } from "../../utils";

/**
 * Hook for customer edit profile screen
 */
export const useCustomerEditProfile = () => {
  const { account } = useAuthStore();
  const { data: customerData } = useCustomerProfileQuery(account?.address || "");
  const updateProfileMutation = useUpdateCustomerProfileMutation(account?.address || "");
  const { showSuccess, showError } = useAppToast();

  const [formData, setFormData] = useState<CustomerEditFormData>({
    name: "",
    email: "",
    phone: "",
  });

  // Initialize form data when customer data loads
  useEffect(() => {
    if (customerData?.customer) {
      setFormData({
        name: customerData.customer.name || "",
        email: customerData.customer.email || "",
        phone: customerData.customer.phone || "",
      });
    }
  }, [customerData]);

  const updateField = useCallback((field: keyof CustomerEditFormData) => (text: string) => {
    setFormData((prev) => ({ ...prev, [field]: text }));
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
      });

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
  };
};
