import { useState, useEffect, useCallback } from "react";
import { balanceApi } from "@/services/balance.services";
import { customerApi } from "@/services/customer.services";
import { CustomerRedemptionData, CustomerTier } from "../../types";

/**
 * Hook for looking up customer data by wallet address
 */
export const useCustomerLookup = () => {
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
  }, [customerAddress]);

  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);

    try {
      const [customerResponse, balanceResponse] = await Promise.all([
        customerApi.getCustomerByWalletAddress(address),
        balanceApi.getCustomerBalance(address),
      ]);

      if (customerResponse && balanceResponse) {
        setCustomerData({
          address,
          tier: (customerResponse.data?.customer?.tier as CustomerTier) || "BRONZE",
          balance: balanceResponse.data?.totalBalance || 0,
          lifetimeEarnings: customerResponse.data?.customer?.lifetimeEarnings || 0,
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
