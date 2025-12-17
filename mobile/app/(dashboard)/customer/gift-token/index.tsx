import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useToken } from "@/hooks/token/useToken";
import { AppHeader } from "@/components/ui/AppHeader";
import { QRScanner } from "@/components/shop/QRScanner";

export default function GiftTokenScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { useTransferToken, useValidateTransfer } = useToken();

  const { data: customerData, refetch: refetchCustomer } = useGetCustomerByWalletAddress(
    account?.address || ""
  );

  const transferMutation = useTransferToken();
  const validateMutation = useValidateTransfer();

  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    recipientExists?: boolean;
  } | null>(null);

  const totalBalance =
    (customerData?.customer?.lifetimeEarnings || 0) -
    (customerData?.customer?.totalRedemptions || 0);

  const isLoading = transferMutation.isPending || validateMutation.isPending;

  const handleValidateTransfer = async () => {
    setError(null);
    setValidationResult(null);

    // Basic validation
    if (!recipientAddress.trim()) {
      setError("Please enter recipient wallet address");
      return;
    }

    if (!recipientAddress.startsWith("0x") || recipientAddress.length !== 42) {
      setError("Please enter a valid wallet address");
      return;
    }

    if (recipientAddress.toLowerCase() === account?.address?.toLowerCase()) {
      setError("You cannot gift tokens to yourself");
      return;
    }

    const giftAmount = parseFloat(amount);
    if (isNaN(giftAmount) || giftAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (giftAmount > totalBalance) {
      setError("Insufficient balance");
      return;
    }

    try {
      const result = await validateMutation.mutateAsync({
        fromAddress: account?.address || "",
        toAddress: recipientAddress,
        amount: giftAmount,
      });

      if (!result.valid) {
        setError(result.message);
        return;
      }

      setValidationResult({
        valid: result.valid,
        recipientExists: result.recipientExists,
      });
    } catch (err: any) {
      setError(err.message || "Failed to validate transfer");
    }
  };

  const handleGiftToken = async () => {
    if (!validationResult?.valid) {
      await handleValidateTransfer();
      return;
    }

    const giftAmount = parseFloat(amount);

    // Show confirmation alert
    Alert.alert(
      "Confirm Gift",
      `Are you sure you want to send ${giftAmount} RCN to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}?${
        !validationResult.recipientExists
          ? "\n\nNote: This recipient is new and will be registered automatically."
          : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              // Generate a unique transaction hash (in production, this would come from blockchain)
              const transactionHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(66, "0");

              await transferMutation.mutateAsync({
                fromAddress: account?.address || "",
                toAddress: recipientAddress,
                amount: giftAmount,
                message: message.trim() || undefined,
                transactionHash,
              });

              // Refetch customer data to update balance
              await refetchCustomer();

              Alert.alert(
                "Success!",
                `You have successfully sent ${giftAmount} RCN to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
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

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Gift Token" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Gift Icon */}
          <View className="items-center my-6">
            <View className="bg-[#FFCC00] rounded-full p-4">
              <MaterialIcons name="card-giftcard" size={48} color="#000" />
            </View>
            <Text className="text-white text-lg font-semibold mt-3">
              Send RCN to a friend
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Gift your tokens to another RepairCoin user
            </Text>
          </View>

          {/* Recipient Address Input */}
          <View className="mb-4">
            <Text className="text-white text-sm font-medium mb-2">
              Recipient Wallet Address
            </Text>
            <View className="bg-zinc-900 rounded-xl flex-row items-center px-4">
              <Ionicons name="wallet-outline" size={20} color="#9CA3AF" />
              <TextInput
                className="flex-1 text-white py-4 px-3"
                placeholder="0x..."
                placeholderTextColor="#6B7280"
                value={recipientAddress}
                onChangeText={handleAddressChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowQRScanner(true)}>
                <Ionicons name="qr-code-outline" size={24} color="#FFCC00" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount Input */}
          <View className="mb-4">
            <Text className="text-white text-sm font-medium mb-2">
              Amount (RCN)
            </Text>
            <View className="bg-zinc-900 rounded-xl flex-row items-center px-4">
              <Text className="text-[#FFCC00] text-lg font-bold">RCN</Text>
              <TextInput
                className="flex-1 text-white py-4 px-3"
                placeholder="0"
                placeholderTextColor="#6B7280"
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
              />
              <TouchableOpacity
                onPress={handleSetMaxAmount}
                className="bg-zinc-800 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-[#FFCC00] text-sm font-medium">MAX</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Message Input (Optional) */}
          <View className="mb-4">
            <Text className="text-white text-sm font-medium mb-2">
              Message (Optional)
            </Text>
            <View className="bg-zinc-900 rounded-xl px-4">
              <TextInput
                className="text-white py-4"
                placeholder="Add a message..."
                placeholderTextColor="#6B7280"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={2}
                maxLength={100}
              />
            </View>
            <Text className="text-gray-500 text-xs mt-1 text-right">
              {message.length}/100
            </Text>
          </View>

          {/* Validation Result */}
          {validationResult?.valid && (
            <View className="bg-green-500/20 rounded-xl p-3 mb-4 flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              <Text className="text-green-400 ml-2 flex-1">
                {validationResult.recipientExists
                  ? "Recipient verified"
                  : "New recipient - will be registered automatically"}
              </Text>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View className="bg-red-500/20 rounded-xl p-3 mb-4 flex-row items-center">
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text className="text-red-400 ml-2 flex-1">{error}</Text>
            </View>
          )}

          {/* Gift Button */}
          <TouchableOpacity
            onPress={handleGiftToken}
            disabled={isLoading}
            className={`rounded-xl py-4 mt-4 ${
              isLoading ? "bg-[#FFCC00]/50" : "bg-[#FFCC00]"
            }`}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black text-center text-lg font-bold">
                {validationResult?.valid ? "Gift Tokens" : "Validate & Gift"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Info Note */}
          <View className="flex-row items-start mt-4 mb-8">
            <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm ml-2 flex-1">
              Gifted tokens will be transferred instantly and cannot be reversed.
              Make sure the recipient address is correct.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={(address) => {
          setRecipientAddress(address);
          setShowQRScanner(false);
          setValidationResult(null);
          setError(null);
        }}
      />
    </View>
  );
}
