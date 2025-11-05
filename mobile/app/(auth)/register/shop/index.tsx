import { goBack } from "expo-router/build/global-state/routing";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Alert,
} from "react-native";
import { CountryCode } from "react-native-country-picker-modal";
import { router } from "expo-router";
import FirstShopRegisterSlide from "@/components/shop/register/FirstSlide";
import SecondShopRegisterSlide from "@/components/shop/register/SecondSlide";
import { CompanySize, MonthlyRevenue } from "@/utilities/GlobalTypes";
import ThirdShopRegisterSlide from "@/components/shop/register/ThirdSlide";
import SocialMediaSlide from "@/components/shop/register/SocialMediaSlide";
import FourthShopRegisterSlide from "@/components/shop/register/FourthSlide";
import { useAuthStore } from "@/store/authStore";

const { width } = Dimensions.get("window");

type Slide = {
  key: string;
};

export interface ShopRegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shopId: string;
  companyName: string;
  websiteURL: string;
  referral: string;
  street: string;
  city: string;
  country: string;
  walletAddress: string;
  reimbursementAddress: string;
  state: string;
  zipCode: string;
  fixFlowShopId: string;
  countryCode: CountryCode;
  companySize: CompanySize;
  monthlyRevenue: MonthlyRevenue;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  isConfirmed: boolean;
}

export default function RegisterAsShopPage() {
  const account = useAuthStore((state) => state.account);
  const login = useAuthStore((state) => state.login);
  const [index, setIndex] = useState(0);
  const flatRef = useRef<FlatList<Slide>>(null);
  const slides: Slide[] = useMemo(
    () => [{ key: "1" }, { key: "2" }, { key: "3" }, { key: "4" }, { key: "5" }],
    []
  );

  const [formData, setFormData] = useState<ShopRegistrationFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    shopId: "",
    companyName: "",
    websiteURL: "",
    referral: "",
    street: "",
    city: "",
    country: "",
    walletAddress: "",
    reimbursementAddress: "",
    state: "",
    zipCode: "",
    fixFlowShopId: "",
    countryCode: "US",
    companySize: "",
    monthlyRevenue: "",
    facebookUrl: "",
    instagramUrl: "",
    linkedinUrl: "",
    isConfirmed: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const updateFormData = useCallback(
    <K extends keyof ShopRegistrationFormData>(
      field: K,
      value: ShopRegistrationFormData[K]
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
      console.log("Moving to slide", index + 1);
      console.log("Current form data:", formData);
    }
  }, [index, slides.length, formData]);

  // Form Submission
  const handleSubmit = useCallback(async () => {
    console.log("=== FORM SUBMISSION STARTED ===");
    console.log(
      "Current formData at submission:",
      JSON.stringify(formData, null, 2)
    );

    if (!account?.address) {
      Alert.alert(
        "Error",
        "Wallet not connected. Please connect your wallet first."
      );
      router.push("/wallet");
      return;
    }

    setIsLoading(true);

    try {
      const response = {
        success: true,
      };

      if (response.success) {
        // Login the user after successful registration
        // await login();
        // router.push("/register/shop/Success");
        console.log("Form submission successful!");
        console.log(
          "Final form data submitted:",
          JSON.stringify(formData, null, 2)
        );
      } else {
        Alert.alert(
          "Registration Failed",
          "An error occurred during registration. Please try again."
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "Unable to complete registration. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [formData, account, login]);

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    return (
      formData.firstName.trim().length >= 2 &&
      formData.lastName.trim().length >= 2
    );
  }, [formData]);

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
              />
            );
          default:
            return (
              <FourthShopRegisterSlide
                handleGoBack={handleGoBack}
                handleSubmit={handleSubmit}
                formData={formData}
                updateFormData={updateFormData}
              />
            );
        }
      }}
    />
  );
}
