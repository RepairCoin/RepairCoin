import { useState, useEffect } from "react";
import { goBack } from "expo-router/build/global-state/routing";
import { customerApi } from "@/services/customer.services";
import { CustomerData } from "../../types";

/**
 * Hook for customer profile screen (viewing a customer)
 */
export const useCustomerProfileScreen = (walletAddress: string) => {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerProfile = async () => {
      if (!walletAddress) {
        setError("No customer ID provided");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await customerApi.getCustomerByWalletAddress(walletAddress);
        if (response?.data?.customer) {
          setCustomerData(response.data.customer);
        } else {
          setError("Customer not found");
        }
      } catch (err) {
        console.log("Customer not found:", err);
        setError("Customer not found");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerProfile();
  }, [walletAddress]);

  return {
    customerData,
    isLoading,
    error,
    goBack,
  };
};
