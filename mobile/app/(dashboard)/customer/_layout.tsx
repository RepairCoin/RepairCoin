import { Stack } from "expo-router";
import React from "react";
import { useCustomerSuspensionGuard } from "@/feature/auth/hooks/useCustomerSuspensionGuard";

export default function CustomerDashboardLayout() {
  useCustomerSuspensionGuard();

  return (
    <React.Fragment>
      <Stack screenOptions={{ headerShown: false }} />
    </React.Fragment>
  );
}
