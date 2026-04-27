import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useActiveAccount } from "thirdweb/react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useCustomer } from "@/feature/profile/customer/hooks/useCustomer";
import { CustomerFormData } from "../../types";
import { INITIAL_CUSTOMER_FORM_DATA } from "../../constants";
import { validateCustomerForm, isValidEmail, hasMinLength } from "../../utils";

export const useCustomerRegister = () => {
  const { useRegisterCustomer } = useCustomer();
  const { mutate: registerCustomer, isPending } = useRegisterCustomer();
  const storeAccount = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const activeAccount = useActiveAccount();

  // Effective wallet: prefer Zustand (has email for Google login),
  // fall back to Thirdweb's live wallet (survives hydration races).
  const account = useMemo(() => {
    if (storeAccount?.address) return storeAccount;
    if (activeAccount?.address) {
      return { address: activeAccount.address, email: storeAccount?.email };
    }
    return null;
  }, [storeAccount, activeAccount?.address]);

  // Self-heal: sync Zustand when Thirdweb has a wallet but Zustand doesn't.
  useEffect(() => {
    if (!storeAccount?.address && activeAccount?.address) {
      console.warn(
        "[useCustomerRegister] Self-healing: Zustand account null but Thirdweb active — syncing",
      );
      setAccount({
        address: activeAccount.address,
        email: storeAccount?.email,
      });
    }
  }, [storeAccount?.address, activeAccount?.address, setAccount, storeAccount?.email]);

  const { showError } = useAppToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>({
    ...INITIAL_CUSTOMER_FORM_DATA,
    email: storeAccount?.email || "",
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
