import { Stack } from "expo-router";
import React from "react";
import { useShopSuspensionGuard } from "@/feature/auth/hooks/useShopSuspensionGuard";

export default function ShopDashboardLayout() {
  useShopSuspensionGuard();

  return (
    <React.Fragment>
      <Stack screenOptions={{ headerShown: false }} />
    </React.Fragment>
  );
}
