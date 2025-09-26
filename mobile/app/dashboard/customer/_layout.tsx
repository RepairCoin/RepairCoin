import CustomFooter from "@/components/CustomFooter";
import { Stack } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function CustomerDashboardLayout() {
  return (
    <React.Fragment>
      <Stack screenOptions={{ headerShown: false }} />
      <View className="mt-auto h-[15%] bg-zinc-950">
        <CustomFooter />
      </View>
    </React.Fragment>
  );
}
