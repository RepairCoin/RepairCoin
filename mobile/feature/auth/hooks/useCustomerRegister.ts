import { useEffect, useMemo, useCallback } from "react";
import { router } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActiveAccount } from "thirdweb/react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { useCustomer } from "@/feature/profile/customer/profile/hooks/useCustomer";
import { CustomerRegisterDto, type CustomerRegisterData } from "../dto";
import { INITIAL_CUSTOMER_FORM_DATA } from "../constants";

export const useCustomerRegister = () => {
  const { showError } = useAppToast();
  const { useRegisterCustomer } = useCustomer();
  const { mutate: registerCustomer, isPending } = useRegisterCustomer();
  const activeAccount = useActiveAccount();
  const { guard, reset } = useSubmitGuard();
  const storeAccount = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);

  const account = useMemo(() => {
    if (storeAccount?.address) return storeAccount;
    if (activeAccount?.address) {
      return { address: activeAccount.address, email: storeAccount?.email };
    }
    return null;
  }, [storeAccount, activeAccount?.address]);

  useEffect(() => {
    if (!storeAccount?.address && activeAccount?.address) {
      setAccount({
        address: activeAccount.address,
        email: storeAccount?.email,
      });
    }
  }, [storeAccount?.address, activeAccount?.address, setAccount, storeAccount?.email]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<CustomerRegisterData>({
    resolver: zodResolver(CustomerRegisterDto),
    defaultValues: {
      ...INITIAL_CUSTOMER_FORM_DATA,
      email: storeAccount?.email || "",
    },
    mode: "onChange",
  });

  const isLoading = isPending || isSubmitting;

  const onSubmit = useCallback(
    (data: CustomerRegisterData) => {
      if (!account?.address) {
        showError(
          "Wallet not connected. Please return to the welcome screen and connect your wallet.",
        );
        return;
      }

      guard(() => {
        const submissionData = {
          ...data,
          name: data.fullName,
          referralCode: data.referral,
          walletAddress: account.address,
        };

        registerCustomer(submissionData, {
          onSettled: reset,
        });
      });
    },
    [account, registerCustomer, showError, guard, reset],
  );

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  return {
    control,
    errors,
    isFormValid: isValid && !!account?.address,
    isLoading,
    account,
    onSubmit: handleSubmit(onSubmit),
    handleGoBack,
  };
};
