import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useActiveAccount } from "thirdweb/react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { useShop } from "@/feature/shop/hooks/useShop";
import { ShopFormData, Slide } from "../../types";
import { INITIAL_SHOP_FORM_DATA, SHOP_REGISTER_SLIDES } from "../../constants";
import { normalizeUrl } from "../../utils";

const { width } = Dimensions.get("window");

// Generate unique shop ID: SHOP-{timestamp}-{random}
const generateShopId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHOP-${timestamp}-${random}`;
};

export const useShopRegister = () => {
  const storeAccount = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const activeAccount = useActiveAccount();

  // Effective wallet: prefer Zustand, fall back to Thirdweb's live wallet.
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
        "[useShopRegister] Self-healing: Zustand account null but Thirdweb active — syncing",
      );
      setAccount({
        address: activeAccount.address,
        email: storeAccount?.email,
      });
    }
  }, [storeAccount?.address, activeAccount?.address, setAccount, storeAccount?.email]);

  const { useRegisterShop } = useShop();
  const { mutate: registerShop, isPending: isRegistering } = useRegisterShop();
  const { showError } = useAppToast();

  const [index, setIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ShopFormData>({
    ...INITIAL_SHOP_FORM_DATA,
    shopId: generateShopId(),
    email: storeAccount?.email || "",
  });

  const isPending = isRegistering || isSubmitting;

  const flatRef = useRef<FlatList<Slide>>(null);
  const slides = useMemo(() => SHOP_REGISTER_SLIDES, []);

  const updateFormData = useCallback(
    <K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

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

  const handleGoNext = useCallback(() => {
    if (index < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  }, [index, slides.length]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;

    if (!account?.address) {
      showError(
        "Wallet not connected. Please return to the welcome screen and connect your wallet.",
      );
      return;
    }

    setIsSubmitting(true);

    const submissionData = {
      ...formData,
      website: normalizeUrl(formData.website),
      facebook: normalizeUrl(formData.facebook),
      instagram: normalizeUrl(formData.instagram),
      twitter: normalizeUrl(formData.twitter),
      walletAddress: account.address,
    };

    registerShop(submissionData, {
      onSettled: () => setIsSubmitting(false),
    });
  }, [formData, account, registerShop, showError, isSubmitting]);

  return {
    // State
    formData,
    index,
    slides,
    isPending,
    account,
    flatRef,
    width,

    // Actions
    updateFormData,
    onScroll,
    handleGoBack,
    handleGoNext,
    handleSubmit,
  };
};
