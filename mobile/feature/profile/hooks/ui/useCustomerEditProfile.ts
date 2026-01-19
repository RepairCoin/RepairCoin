import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/store/auth.store";
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
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      });

      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
      console.error("Error updating profile:", error);
    }
  }, [formData, updateProfileMutation]);

  return {
    formData,
    updateField,
    handleSaveChanges,
    isPending: updateProfileMutation.isPending,
    walletAddress: account?.address,
    goBack,
  };
};
