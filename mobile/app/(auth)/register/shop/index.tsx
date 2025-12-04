import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { CountryCode } from "react-native-country-picker-modal";
import { useAuthStore } from "@/store/auth.store";
import { useShop } from "@/hooks/shop/useShop";
import FirstShopRegisterSlide from "@/components/shop/register/FirstSlide";
import SecondShopRegisterSlide from "@/components/shop/register/SecondSlide";
import ThirdShopRegisterSlide from "@/components/shop/register/ThirdSlide";
import SocialMediaSlide from "@/components/shop/register/SocialMediaSlide";
import FourthShopRegisterSlide from "@/components/shop/register/FourthSlide";
import { ShopFormData } from "@/interfaces/shop.interface";

const { width } = Dimensions.get("window");

type Slide = {
  key: string;
};

export default function RegisterAsShopPage() {
  const account = useAuthStore((state) => state.account);
  const { useRegisterShop } = useShop();
  const { mutate: registerShop, isPending } = useRegisterShop();
  const [index, setIndex] = useState(0);
  const flatRef = useRef<FlatList<Slide>>(null);
  const slides: Slide[] = useMemo(
    () => [
      { key: "1" },
      { key: "2" },
      { key: "3" },
      { key: "4" },
      { key: "5" },
    ],
    []
  );

  const [formData, setFormData] = useState<ShopFormData>({
    // Shop Information
    shopId: "",
    name: "",
    walletAddress: "",
    
    // Personal Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    
    // Business Information
    address: "",
    city: "",
    country: "",
    companySize: "",
    monthlyRevenue: "",
    website: "",
    referral: "",
    
    // Social Media
    facebook: "",
    twitter: "",
    instagram: "",
    
    // Wallet Information
    reimbursementAddress: "",
    fixflowShopId: "",
    
    // Location (for mapping)
    location: {
      city: "",
      state: "",
      zipCode: "",
      lat: "",
      lng: "",
    },
    
    // Terms and Conditions
    acceptTerms: false,
  });
  const [countryCode, setCountryCode] = useState<CountryCode>("US");

  const updateFormData = useCallback(
    <K extends keyof ShopFormData>(
      field: K,
      value: ShopFormData[K]
    ) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        console.log(`Updated ${field}:`, value);
        console.log("Current form data:", updated);
        return updated;
      });
    },
    []
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
  }, [index, slides.length, router]);

  const handleGoNext = useCallback(() => {
    if (index < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  }, [index, slides.length, formData]);

  // Form Submission
  const handleSubmit = useCallback(async () => {
    try {
      // Add wallet address to form data
      const submissionData = {
        ...formData,
        walletAddress: account.address,
      };

      // Call the mutation
      registerShop(submissionData);
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "Unable to complete registration. Please check your connection and try again."
      );
    }
  }, [formData, account, registerShop]);

  return (
    <FlatList
      ref={flatRef}
      data={slides}
      keyExtractor={(item) => item.key}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEnabled={false}
      renderItem={({ item }) => {
        switch (item.key) {
          case "1":
            return (
              <FirstShopRegisterSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                formData={formData}
                updateFormData={updateFormData}
                countryCode={countryCode}
                setCountryCode={setCountryCode}
              />
            );
          case "2":
            return (
              <SecondShopRegisterSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                formData={formData}
                updateFormData={updateFormData}
              />
            );
          case "3":
            return (
              <ThirdShopRegisterSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                formData={formData}
                updateFormData={updateFormData}
                address={account?.address}
              />
            );
          case "4":
            return (
              <SocialMediaSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                formData={formData}
                updateFormData={updateFormData}
              />
            );
          case "5":
            return (
              <FourthShopRegisterSlide
                handleGoBack={handleGoBack}
                handleSubmit={handleSubmit}
                formData={formData}
                updateFormData={updateFormData}
                isLoading={isPending}
              />
            );
          default:
            return (
              <FourthShopRegisterSlide
                handleGoBack={handleGoBack}
                handleSubmit={handleSubmit}
                formData={formData}
                updateFormData={updateFormData}
                isLoading={isPending}
              />
            );
        }
      }}
    />
  );
}
