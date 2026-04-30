import React, { useCallback } from "react";
import { FlatList, View } from "react-native";
import { FormProvider } from "react-hook-form";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useShopRegister } from "../../hooks/useShopRegister";
import {
  FirstSlide,
  SecondSlide,
  ThirdSlide,
  SocialMediaSlide,
  FourthSlide,
  ProgressBar,
} from "../../components/form-register";
import { Slide } from "../../types";

const SLIDE_TITLES = [
  "Register Shop",
  "Business Info",
  "Location & Wallet",
  "Social Media",
  "Review & Submit",
];

export default function ShopRegisterScreen() {
  const {
    form,
    slides,
    isPending,
    account,
    flatRef,
    width,
    currentStep,
    onScroll,
    handleGoBack,
    handleGoNext,
    onSubmit,
  } = useShopRegister();

  const renderSlide = useCallback(
    ({ item }: { item: Slide }) => {
      const idx = parseInt(item.key) - 1;
      return (
        <View style={{ width }}>
          {idx === 0 && <FirstSlide handleGoNext={handleGoNext} />}
          {idx === 1 && <SecondSlide handleGoNext={handleGoNext} />}
          {idx === 2 && (
            <ThirdSlide
              handleGoNext={handleGoNext}
              address={account?.address}
            />
          )}
          {idx === 3 && <SocialMediaSlide handleGoNext={handleGoNext} />}
          {idx === 4 && (
            <FourthSlide handleSubmit={onSubmit} isLoading={isPending} />
          )}
        </View>
      );
    },
    [handleGoBack, handleGoNext, account?.address, onSubmit, isPending, width],
  );

  return (
    <FormProvider {...form}>
      <ThemedView className="flex-1">
        <AppHeader
          title={SLIDE_TITLES[currentStep]}
          onBackPress={handleGoBack}
        />
        <ProgressBar currentStep={currentStep} />
        <FlatList
          ref={flatRef}
          data={slides}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEnabled={false}
          renderItem={renderSlide}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
        />
      </ThemedView>
    </FormProvider>
  );
}
