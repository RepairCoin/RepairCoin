import React, { useCallback } from "react";
import { FlatList, View } from "react-native";
import { FormProvider } from "react-hook-form";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useShopRegister } from "../../hooks/useShopRegister";
import {
  FirstSlide,
  SecondSlide,
  ThirdSlide,
  SocialMediaSlide,
  FourthSlide,
} from "../../components/form-register";
import { Slide } from "../../types";

export default function ShopRegisterScreen() {
  const {
    form,
    slides,
    isPending,
    account,
    flatRef,
    width,
    onScroll,
    handleGoBack,
    handleGoNext,
    onSubmit,
  } = useShopRegister();

  const renderSlide = useCallback(
    ({ item }: { item: Slide }) => {
      return (
        <View style={{ width }}>
          {item.key === "1" && (
            <FirstSlide handleGoBack={handleGoBack} handleGoNext={handleGoNext} />
          )}
          {item.key === "2" && (
            <SecondSlide handleGoBack={handleGoBack} handleGoNext={handleGoNext} />
          )}
          {item.key === "3" && (
            <ThirdSlide
              handleGoBack={handleGoBack}
              handleGoNext={handleGoNext}
              address={account?.address}
            />
          )}
          {item.key === "4" && (
            <SocialMediaSlide handleGoBack={handleGoBack} handleGoNext={handleGoNext} />
          )}
          {item.key === "5" && (
            <FourthSlide
              handleGoBack={handleGoBack}
              handleSubmit={onSubmit}
              isLoading={isPending}
            />
          )}
        </View>
      );
    },
    [handleGoBack, handleGoNext, account?.address, onSubmit, isPending, width]
  );

  return (
    <FormProvider {...form}>
      <ThemedView className="flex-1">
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
