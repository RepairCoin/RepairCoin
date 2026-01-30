import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, NativeSyntheticEvent, NativeScrollEvent, Dimensions, Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/shared/store/auth.store";
import { useShop } from "@/shared/hooks/shop/useShop";
import { ShopFormData, Slide } from "../../types";
import { INITIAL_SHOP_FORM_DATA, SHOP_REGISTER_SLIDES } from "../../constants";

const { width } = Dimensions.get("window");

// Generate unique shop ID: SHOP-{timestamp}-{random}
const generateShopId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHOP-${timestamp}-${random}`;
};

export const useShopRegister = () => {
  const account = useAuthStore((state) => state.account);
  const { useRegisterShop } = useShop();
  const { mutate: registerShop, isPending } = useRegisterShop();

  const [index, setIndex] = useState(0);
  const [formData, setFormData] = useState<ShopFormData>({
    ...INITIAL_SHOP_FORM_DATA,
    shopId: generateShopId(),
    email: account?.email || "",
  });

  const flatRef = useRef<FlatList<Slide>>(null);
  const slides = useMemo(() => SHOP_REGISTER_SLIDES, []);

  const updateFormData = useCallback(
    <K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      setIndex(Math.round(x / width));
    },
    []
  );

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

  const handleSubmit = useCallback(async () => {
    try {
      const submissionData = {
        ...formData,
        walletAddress: account.address,
      };

      registerShop(submissionData);
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "Unable to complete registration. Please check your connection and try again."
      );
    }
  }, [formData, account, registerShop]);

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
