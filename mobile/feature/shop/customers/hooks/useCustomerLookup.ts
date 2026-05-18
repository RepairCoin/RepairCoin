import { useAuthStore } from "@/feature/auth/store/auth.store";
import { customerApi } from "@/feature/customer/profile/services/customer.services";
import { balanceApi } from "@/feature/token/services";
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

  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      lookupCustomer(customerAddress);
    } else {
      setCustomerData(null);
      setCustomerError(null);
    }
  }, [customerAddress, shopData?.shopId]);

  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);

    try {
      const [customerResponse, balanceResponse, crossShopResponse, isHomeShop] =
        await Promise.all([
          customerApi.getCustomerByWalletAddress(address),
          balanceApi.getCustomerBalance(address),
          customerApi.getCrossShopBalance(address).catch(() => null),
          shopData?.shopId
            ? customerApi.hasEarnedAtShop(address, shopData.shopId)
            : Promise.resolve(false),
        ]);

      if (customerResponse && balanceResponse) {
        const balance = balanceResponse.data?.totalBalance || 0;
        const lifetimeEarnings =
          customerResponse.data?.customer?.lifetimeEarnings || 0;

        const crossShopLimit =
          crossShopResponse?.data?.crossShopLimit ??
          lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;

        const maxRedeemable = isHomeShop
          ? balance
          : Math.min(balance, crossShopLimit);

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