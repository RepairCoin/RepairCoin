import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/shared/store/auth.store";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";
import { CustomerFormData } from "../../types";
import { INITIAL_CUSTOMER_FORM_DATA } from "../../constants";
import { validateCustomerForm, isValidEmail, hasMinLength } from "../../utils";

export const useCustomerRegister = () => {
  const { useRegisterCustomer } = useCustomer();
  const { mutate: registerCustomer, isPending: isLoading } = useRegisterCustomer();
  const account = useAuthStore((state) => state.account);

  const [formData, setFormData] = useState<CustomerFormData>(INITIAL_CUSTOMER_FORM_DATA);

  const updateFormData = useCallback(
    (field: keyof CustomerFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const isFormValid = useMemo(() => {
    return hasMinLength(formData.fullName, 2) && isValidEmail(formData.email);
  }, [formData.fullName, formData.email]);

  const validateAndSubmit = useCallback(() => {
    const errors = validateCustomerForm(formData.fullName, formData.email);

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    try {
      const submissionData = {
        ...formData,
        walletAddress: account.address,
      };

      registerCustomer(submissionData);
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "Unable to complete registration. Please check your connection and try again."
      );
    }
  }, [formData, account, registerCustomer]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  return {
    formData,
    updateFormData,
    isFormValid,
    isLoading,
    validateAndSubmit,
    handleGoBack,
    account,
  };
};
