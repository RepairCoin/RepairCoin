import CustomFooter from "@/shared/components/ui/CustomFooter";
import { Stack } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function ShopDashboardLayout() {
  return (
    <React.Fragment>
      <Stack screenOptions={{ headerShown: false }} />
    </React.Fragment>
  );
}
