import { useAuthStore } from "@/feature/auth/store/auth.store";
import { customerApi } from "@/feature/customer/profile/services/customer.services";
import { balanceApi, tokenApi } from "@/feature/token/services";
import { useCallback, useEffect, useState } from "react";
import { CustomerRedemptionData } from "../../services/shop.interface";
import { CROSS_SHOP_LIMIT_PERCENTAGE } from "@/shared/utilities/calculateMaxRedeemable";
import { CustomerTier } from "@/feature/customer/profile/types";

export const useCustomerLookup = () => {
  const shopData = useAuthStore((state) => state.userProfile);
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerData, setCustomerData] =
    useState<CustomerRedemptionData | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // The shop's business identifier — same value the redemption session uses.
  const shopId = shopData?.id ?? shopData?.shopId;

  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      lookupCustomer(customerAddress);
    } else {
      setCustomerData(null);
      setCustomerError(null);
    }
  }, [customerAddress, shopId]);

  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);

    try {
      // Ask the backend for the authoritative home/cross-shop relationship
      // (validateOnly) instead of inferring it from a client-side transaction
      // scan, so the badge matches the web app. `amount: 1` is a placeholder
      // just to satisfy the endpoint's validation; only the relationship data
      // is consumed here.
      const [customerResponse, balanceResponse, verification] =
        await Promise.all([
          customerApi.getCustomerByWalletAddress(address),
          balanceApi.getCustomerBalance(address),
          shopId
            ? tokenApi
                .verifyRedemption({ customerAddress: address, shopId, amount: 1 })
                .catch(() => null)
            : Promise.resolve(null),
        ]);

      if (customerResponse && balanceResponse) {
        const lifetimeEarnings =
          customerResponse.data?.customer?.lifetimeEarnings || 0;

        // Prefer the backend's available balance; fall back to the balance API.
        const balance =
          verification?.availableBalance ??
          balanceResponse.data?.totalBalance ??
          0;

        // Home-shop status, cross-shop limit and max redeemable come straight
        // from the verification endpoint (with local fallbacks if it fails).
        const isHomeShop = verification?.isHomeShop ?? false;
        const crossShopLimit =
          verification?.crossShopLimit ??
          lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;
        const maxRedeemable =
          verification?.maxRedeemable ??
          (isHomeShop ? balance : Math.min(balance, crossShopLimit));

        setCustomerData({
          address,
          tier:
            (customerResponse.data?.customer?.tier as CustomerTier) || "BRONZE",
          balance,
          lifetimeEarnings,
          isHomeShop,
          maxRedeemable,
          crossShopLimit,
        });
      } else {
        setCustomerError("Customer not found");
        setCustomerData(null);
      }
    } catch (error) {
      console.error("Error looking up customer:", error);
      setCustomerError("Failed to lookup customer");
      setCustomerData(null);
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const resetCustomer = useCallback(() => {
    setCustomerAddress("");
    setCustomerData(null);
    setCustomerError(null);
  }, []);

  return {
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,
    lookupCustomer,
    resetCustomer,
  };
};