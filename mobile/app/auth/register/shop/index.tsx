import { goBack } from "expo-router/build/global-state/routing";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from "react-native";
import { CountryCode } from "react-native-country-picker-modal";
import { router } from "expo-router";
import FirstShopRegisterSlide from "@/components/shop/register/FirstSlide";
import SecondShopRegisterSlide from "@/components/shop/register/SecondSlide";
import { CompanySize, MonthlyRevenue } from "@/utilities/GlobalTypes";
import ThirdShopRegisterSlide from "@/components/shop/register/ThirdSlide";
import FourthShopRegisterSlide from "@/components/shop/register/FourthSlide";

const { width } = Dimensions.get("window");

type Slide = {
  key: string;
};

export default function RegisterAsShopPage() {
  const [index, setIndex] = useState(0);
  const flatRef = useRef<FlatList<Slide>>(null);
  const slides: Slide[] = useMemo(
    () => [{ key: "1" }, { key: "2" }, { key: "3" }, { key: "4" }],
    []
  );

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [countryCode, setCountryCode] = useState<CountryCode>("US");
  const [phone, setPhone] = useState<string>("");
  const [shopId, setShopId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [companySize, setCompanySize] = useState<CompanySize>("");
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue>("");
  const [websiteURL, setWebsiteURL] = useState<string>("");
  const [referral, setReferral] = useState<string>("");
  const [street, setStreet] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [reimbursementAddress, setReimbursementAddress] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [zipCode, setZipCode] = useState<string>("");
  const [fixFlowShopId, setFixFlowShopId] = useState<string>("");
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

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
    } else {
      router.push("/auth/register/shop/Success");
    }
  }, [index, slides.length, router]);

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
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                email={email}
                setEmail={setEmail}
                countryCode={countryCode}
                setCountryCode={setCountryCode}
                setPhone={setPhone}
              />
            );
          case "2":
            return (
              <SecondShopRegisterSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                shopId={shopId}
                setShopId={setShopId}
                companyName={companyName}
                setCompanyName={setCompanyName}
                companySize={companySize}
                setCompanySize={setCompanySize}
                monthlyRevenue={monthlyRevenue}
                setMonthlyRevenue={setMonthlyRevenue}
                websiteURL={websiteURL}
                setWebsiteURL={setWebsiteURL}
                referral={referral}
                setReferral={setReferral}
              />
            );
          case "3":
            return (
              <ThirdShopRegisterSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                street={street}
                setStreet={setStreet}
                city={city}
                setCity={setCity}
                country={country}
                setCountry={setCountry}
                walletAddress={walletAddress}
                setWalletAddress={setWalletAddress}
                reimbursementAddress={reimbursementAddress}
                setReimbursementAddress={setReimbursementAddress}
              />
            );
          default:
            return (
              <FourthShopRegisterSlide
                handleGoBack={handleGoBack}
                handleGoNext={handleGoNext}
                state={state}
                setState={setState}
                zipCode={zipCode}
                setZipCode={setZipCode}
                fixFlowShopId={fixFlowShopId}
                setFixFlowShopId={setFixFlowShopId}
                isConfirmed={isConfirmed}
                setIsConfirmed={setIsConfirmed}
              />
            );
        }
      }}
    />
  );
}
