import React, { useCallback } from "react";
import { FlatList, View } from "react-native";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useShopRegister } from "../hooks";
import {
  FirstSlide,
  SecondSlide,
  ThirdSlide,
  SocialMediaSlide,
  FourthSlide,
} from "../components";
import { Slide } from "../types";

export default function ShopRegisterScreen() {
  const {
    formData,
    countryCode,
    slides,
    isPending,
    account,
    flatRef,
    width,
    updateFormData,
    setCountryCode,
    onScroll,
    handleGoBack,
    handleGoNext,
    handleSubmit,
  } = useShopRegister();

  const renderSlide = useCallback(
    ({ item }: { item: Slide }) => {
      const slideProps = {
        handleGoBack,
        handleGoNext,
        formData,
        updateFormData,
      };

      return (
        <View style={{ width }}>
          {item.key === "1" && (
            <FirstSlide
              {...slideProps}
              countryCode={countryCode}
              setCountryCode={setCountryCode}
            />
          )}
          {item.key === "2" && <SecondSlide {...slideProps} />}
          {item.key === "3" && (
            <ThirdSlide {...slideProps} address={account?.address} />
          )}
          {item.key === "4" && <SocialMediaSlide {...slideProps} />}
          {item.key === "5" && (
            <FourthSlide
              handleGoBack={handleGoBack}
              handleSubmit={handleSubmit}
              formData={formData}
              updateFormData={updateFormData}
              isLoading={isPending}
            />
          )}
        </View>
      );
    },
    [
      handleGoBack,
      handleGoNext,
      formData,
      updateFormData,
      countryCode,
      setCountryCode,
      account?.address,
      handleSubmit,
      isPending,
      width,
    ]
  );

  return (
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
  );
}
