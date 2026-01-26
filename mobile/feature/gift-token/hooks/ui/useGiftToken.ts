import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/shared/customer/useCustomer";
import { useToken } from "../useToken";
import { ValidationResult } from "../../types";
import {
  WALLET_ADDRESS_LENGTH,
  WALLET_ADDRESS_PREFIX,
} from "../../constants";

export function useGiftToken() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { useTransferToken, useValidateTransfer } = useToken();

  const { data: customerData, refetch: refetchCustomer } =
    useGetCustomerByWalletAddress(account?.address || "");

  const transferMutation = useTransferToken();
  const validateMutation = useValidateTransfer();

  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  const totalBalance =
    (customerData?.customer?.lifetimeEarnings || 0) -
    (customerData?.customer?.totalRedemptions || 0);

  const isLoading = transferMutation.isPending || validateMutation.isPending;

  const validateTransfer = async (): Promise<boolean> => {
    setError(null);
    setValidationResult(null);

    if (!recipientAddress.trim()) {
      setError("Please enter recipient wallet address");
      return false;
    }

    if (
      !recipientAddress.startsWith(WALLET_ADDRESS_PREFIX) ||
      recipientAddress.length !== WALLET_ADDRESS_LENGTH
    ) {
      setError("Please enter a valid wallet address");
      return false;
    }

    if (recipientAddress.toLowerCase() === account?.address?.toLowerCase()) {
      setError("You cannot gift tokens to yourself");
      return false;
    }

    const giftAmount = parseFloat(amount);
    if (isNaN(giftAmount) || giftAmount <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (giftAmount > totalBalance) {
      setError("Insufficient balance");
      return false;
    }

    try {
      const result = await validateMutation.mutateAsync({
        fromAddress: account?.address || "",
        toAddress: recipientAddress,
        amount: giftAmount,
      });

      if (!result) {
        setError("Failed to validate transfer");
        return false;
      }

      if (!result.valid) {
        setError(result.message);
        return false;
      }

      setValidationResult({
        valid: result.valid,
        recipientExists: result.recipientExists,
      });
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to validate transfer");
      return false;
    }
  };

  const handleGiftToken = async () => {
    if (!validationResult?.valid) {
      const isValid = await validateTransfer();
      if (!isValid) return;
    }

    const giftAmount = parseFloat(amount);
    const shortAddress = `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`;

    Alert.alert(
      "Confirm Gift",
      `Are you sure you want to send ${giftAmount} RCN to ${shortAddress}?${
        !validationResult?.recipientExists
          ? "\n\nNote: This recipient is new and will be registered automatically."
          : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const transactionHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(
                66,
                "0"
              );

              await transferMutation.mutateAsync({
                fromAddress: account?.address || "",
                toAddress: recipientAddress,
                amount: giftAmount,
                message: message.trim() || undefined,
                transactionHash,
              });

              await refetchCustomer();

              Alert.alert(
                "Success!",
                `You have successfully sent ${giftAmount} RCN to ${shortAddress}`,
                [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (err: any) {
              setError(err.message || "Failed to gift tokens");
            }
          },
        },
      ]
    );
  };

  const handleSetMaxAmount = () => {
    setAmount(totalBalance.toString());
    setValidationResult(null);
  };

  const handleAddressChange = (text: string) => {
    setRecipientAddress(text);
    setValidationResult(null);
    setError(null);
  };

  const handleAmountChange = (text: string) => {
    setAmount(text);
    setValidationResult(null);
    setError(null);
  };

  const handleQRScan = (address: string) => {
    setRecipientAddress(address);
    setShowQRScanner(false);
    setValidationResult(null);
    setError(null);
  };

  return {
    // Form data
    recipientAddress,
    amount,
    message,
    setMessage,

    // Handlers
    handleAddressChange,
    handleAmountChange,
    handleSetMaxAmount,
    handleGiftToken,
    handleQRScan,

    // QR Scanner
    showQRScanner,
    setShowQRScanner,

    // State
    totalBalance,
    isLoading,
    error,
    validationResult,
  };
}
