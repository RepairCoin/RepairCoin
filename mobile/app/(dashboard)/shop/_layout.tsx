import { Stack, useRouter } from "expo-router";
import React from "react";
import { useShopSuspensionGuard } from "@/feature/auth/hooks/useShopSuspensionGuard";
import { useModalStore } from "@/shared/store/common.store";
import StripeConnectModal from "@/shared/components/shop/StripeConnectModal";

export default function ShopDashboardLayout() {
  useShopSuspensionGuard();

  const router = useRouter();
  const showStripeConnectModal = useModalStore((s) => s.showStripeConnectModal);
  const setShowStripeConnectModal = useModalStore((s) => s.setShowStripeConnectModal);

  return (
    <React.Fragment>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Mounted once here so any mutation hook (service create/update, booking
          approve/complete) can open this gate on a 403 STRIPE_NOT_CONNECTED via
          useModalStore.getState().setShowStripeConnectModal(true), with zero prop
          drilling regardless of which screen triggered it. */}
      <StripeConnectModal
        visible={showStripeConnectModal}
        onClose={() => setShowStripeConnectModal(false)}
        onSetUp={() => {
          setShowStripeConnectModal(false);
          router.push("/(dashboard)/shop/payouts");
        }}
      />
    </React.Fragment>
  );
}
