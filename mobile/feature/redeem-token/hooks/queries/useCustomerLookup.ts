import { useState, useEffect, useCallback } from "react";
import { balanceApi } from "@/services/balance.services";
import { customerApi } from "@/services/customer.services";
import { useAuthStore } from "@/store/auth.store";
import { CustomerRedemptionData, CustomerTier } from "../../types";

// Cross-shop redemption limit (20% of lifetime earnings)
const CROSS_SHOP_LIMIT_PERCENTAGE = 0.20;

/**
 * Hook for looking up customer data by wallet address
 * Includes cross-shop redemption limit validation
 */
export const useCustomerLookup = () => {
  const shopData = useAuthStore((state) => state.userProfile);
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerData, setCustomerData] = useState<CustomerRedemptionData | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      lookupCustomer(customerAddress);
    } else {
      setCustomerData(null);
      setCustomerError(null);
    }
  }, [customerAddress, shopData?.id]);

  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);

    try {
      // Fetch customer data, balance, and cross-shop info in parallel
      const [customerResponse, balanceResponse, crossShopResponse, isHomeShop] = await Promise.all([
        customerApi.getCustomerByWalletAddress(address),
        balanceApi.getCustomerBalance(address),
        customerApi.getCrossShopBalance(address).catch(() => null),
        shopData?.id ? customerApi.hasEarnedAtShop(address, shopData.id) : Promise.resolve(false),
      ]);

      if (customerResponse && balanceResponse) {
        const balance = balanceResponse.data?.totalBalance || 0;
        const lifetimeEarnings = customerResponse.data?.customer?.lifetimeEarnings || 0;

        // Calculate cross-shop limit (20% of lifetime earnings)
        const crossShopLimit = crossShopResponse?.data?.crossShopLimit
          ?? lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;

        // Calculate max redeemable amount:
        // - Home shop: 100% of current balance
        // - Cross-shop: minimum of balance and 20% limit
        const maxRedeemable = isHomeShop
          ? balance
          : Math.min(balance, crossShopLimit);

        setCustomerData({
          address,
          tier: (customerResponse.data?.customer?.tier as CustomerTier) || "BRONZE",
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
