import CustomFooter from "@/components/ui/CustomFooter";
import { Stack } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function CustomerDashboardLayout() {
  return (
    <React.Fragment>
      <Stack screenOptions={{ headerShown: false }} />
      <View className="mt-auto h-[10%] bg-zinc-950 -z-10">
        <CustomFooter />
      </View>
    </React.Fragment>
  );
}
