import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from "react-native";
import { useState } from "react";
import { goBack } from "expo-router/build/global-state/routing";
import { useActiveAccount } from "thirdweb/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { useShop } from "@/feature/role/shop/account/hooks/useShopQuery";
import { ShopRegisterDto, type ShopRegisterData } from "../dto";
import { Slide } from "../types";
import { INITIAL_SHOP_FORM_DATA, SHOP_REGISTER_SLIDES } from "../constants";
import { normalizeUrl } from "../utils";

const { width } = Dimensions.get("window");

const generateShopId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHOP-${timestamp}-${random}`;
};

// Fields to validate per slide
const SLIDE_FIELDS: Record<string, (keyof ShopRegisterData)[]> = {
  "1": ["firstName", "lastName", "email", "phone"],
  "2": ["name", "companySize", "monthlyRevenue"],
  "3": ["address", "city", "country"],
  "4": ["facebook", "twitter", "instagram"],
  "5": ["acceptTerms"],
};

export const useShopRegister = () => {
  const storeAccount = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const activeAccount = useActiveAccount();

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

  const { useRegisterShop } = useShop();
  const { mutate: registerShop, isPending: isRegistering } = useRegisterShop();
  const { guard, reset } = useSubmitGuard();
  const { showError } = useAppToast();

  const [index, setIndex] = useState(0);

  const form = useForm<ShopRegisterData>({
    resolver: zodResolver(ShopRegisterDto),
    defaultValues: {
      ...INITIAL_SHOP_FORM_DATA,
      shopId: generateShopId(),
      walletAddress: account?.address || "",
      email: storeAccount?.email || "",
    },
    mode: "onChange",
  });

  const isPending = isRegistering || form.formState.isSubmitting;

  const flatRef = useRef<FlatList<Slide>>(null);
  const slides = useMemo(() => SHOP_REGISTER_SLIDES, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setIndex(Math.round(x / width));
  }, []);

  const handleGoBack = useCallback(() => {
    if (index > 0) {
      flatRef.current?.scrollToIndex({ index: index - 1, animated: true });
    } else {
      goBack();
    }
  }, [index]);

  const handleGoNext = useCallback(async () => {
    const currentSlide = slides[index]?.key;
    const fieldsToValidate = SLIDE_FIELDS[currentSlide];

    if (fieldsToValidate) {
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) return;
    }

    if (index < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  }, [index, slides, form]);

  const onSubmit = useCallback(
    (data: ShopRegisterData) => {
      if (!account?.address) {
        showError(
          "Wallet not connected. Please return to the welcome screen and connect your wallet.",
        );
        return;
      }

      guard(() => {
        const submissionData = {
          ...data,
          website: normalizeUrl(data.website),
          facebook: normalizeUrl(data.facebook),
          instagram: normalizeUrl(data.instagram),
          twitter: normalizeUrl(data.twitter),
          walletAddress: account.address,
        };

        registerShop(submissionData, {
          onSettled: reset,
        });
      });
    },
    [account, registerShop, showError, guard, reset],
  );

  return {
    form,
    slides,
    isPending,
    account,
    flatRef,
    width,
    currentStep: index,
    totalSteps: slides.length,
    onScroll,
    handleGoBack,
    handleGoNext,
    onSubmit: form.handleSubmit(onSubmit),
  };
};
