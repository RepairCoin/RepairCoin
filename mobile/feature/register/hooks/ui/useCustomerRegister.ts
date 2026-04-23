import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/shared/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";
import { CustomerFormData } from "../../types";
import { INITIAL_CUSTOMER_FORM_DATA } from "../../constants";
import { validateCustomerForm, isValidEmail, hasMinLength } from "../../utils";

export const useCustomerRegister = () => {
  const { useRegisterCustomer } = useCustomer();
  const { mutate: registerCustomer, isPending } = useRegisterCustomer();
  const account = useAuthStore((state) => state.account);
  const { showError } = useAppToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>({
    ...INITIAL_CUSTOMER_FORM_DATA,
    email: account?.email || "",
  });

  const isLoading = isPending || isSubmitting;

  const updateFormData = useCallback(
    (field: keyof CustomerFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const isFormValid = useMemo(() => {
    return (
      !!account?.address &&
      hasMinLength(formData.fullName, 2) &&
      isValidEmail(formData.email)
    );
  }, [formData.fullName, formData.email, account?.address]);

  const validateAndSubmit = useCallback(() => {
    if (isSubmitting) return;

    if (!account?.address) {
      showError(
        "Wallet not connected. Please return to the welcome screen and connect your wallet.",
      );
      return;
    }

    const errors = validateCustomerForm(formData.fullName, formData.email);

    if (errors.length > 0) {
      showError(errors.join("\n"));
      return;
    }

    setIsSubmitting(true);

    const submissionData = {
      ...formData,
      name: formData.fullName,
      referralCode: formData.referral,
      walletAddress: account.address,
    };

    registerCustomer(submissionData, {
      onSettled: () => setIsSubmitting(false),
    });
  }, [formData, account, registerCustomer, showError, isSubmitting]);

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
