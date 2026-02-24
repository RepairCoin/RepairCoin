import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { groupsApi } from "../../services";
import { groupsKeys } from "../../hooks";
import { AffiliateShopGroup } from "../../types";

interface TokenOperationsTabProps {
  groupId: string;
  group: AffiliateShopGroup;
}

type OperationMode = "earn" | "redeem";

export function TokenOperationsTab({ groupId, group }: TokenOperationsTabProps) {
  const [mode, setMode] = useState<OperationMode>("earn");
  const [customerAddress, setCustomerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const queryClient = useQueryClient();

  const earnMutation = useMutation({
    mutationFn: (data: { customerAddress: string; amount: number; reason?: string }) =>
      groupsApi.earnGroupTokens(groupId, data),
    onSuccess: (result) => {
      Alert.alert(
        "Success",
        `Issued ${amount} ${group.customTokenSymbol || "tokens"} to customer. New balance: ${result?.newBalance || 0}`
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: groupsKeys.transactions(groupId) });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to issue tokens"
      );
    },
  });

  const redeemMutation = useMutation({
    mutationFn: (data: { customerAddress: string; amount: number; reason?: string }) =>
      groupsApi.redeemGroupTokens(groupId, data),
    onSuccess: (result) => {
      Alert.alert(
        "Success",
        `Redeemed ${amount} ${group.customTokenSymbol || "tokens"} from customer. New balance: ${result?.newBalance || 0}`
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: groupsKeys.transactions(groupId) });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to redeem tokens"
      );
    },
  });

  const resetForm = () => {
    setCustomerAddress("");
    setAmount("");
    setReason("");
    setCustomerBalance(null);
  };

  const handleLookupBalance = async () => {
    if (!customerAddress.trim()) return;

    setIsLoadingBalance(true);
    try {
      const balance = await groupsApi.getCustomerBalance(
        groupId,
        customerAddress.trim().toLowerCase()
      );
      setCustomerBalance(balance?.balance || 0);
    } catch (error) {
      setCustomerBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleSubmit = () => {
    const trimmedAddress = customerAddress.trim().toLowerCase();
    const amountNum = parseFloat(amount);

    if (!trimmedAddress) {
      Alert.alert("Error", "Please enter a customer wallet address");
      return;
    }

    if (!trimmedAddress.startsWith("0x") || trimmedAddress.length !== 42) {
      Alert.alert("Error", "Please enter a valid Ethereum address");
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (mode === "redeem" && customerBalance !== null && amountNum > customerBalance) {
      Alert.alert("Error", "Customer doesn't have enough tokens to redeem");
      return;
    }

    const data = {
      customerAddress: trimmedAddress,
      amount: amountNum,
      reason: reason.trim() || undefined,
    };

    if (mode === "earn") {
      earnMutation.mutate(data);
    } else {
      redeemMutation.mutate(data);
    }
  };

  const isSubmitting = earnMutation.isPending || redeemMutation.isPending;
  const isValid = customerAddress.trim() && amount && parseFloat(amount) > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="p-4">
        {/* Mode Toggle */}
        <View className="flex-row mb-4">
          <Pressable
            onPress={() => setMode("earn")}
            className={`flex-1 py-3 rounded-lg mr-2 ${
              mode === "earn" ? "bg-green-500" : "bg-zinc-800"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                mode === "earn" ? "text-white" : "text-gray-400"
              }`}
            >
              Issue Tokens
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("redeem")}
            className={`flex-1 py-3 rounded-lg ${
              mode === "redeem" ? "bg-orange-500" : "bg-zinc-800"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                mode === "redeem" ? "text-white" : "text-gray-400"
              }`}
            >
              Redeem Tokens
            </Text>
          </Pressable>
        </View>

        {/* Info Box */}
        <View
          className={`rounded-lg p-3 mb-4 ${
            mode === "earn" ? "bg-green-500/10" : "bg-orange-500/10"
          }`}
        >
          <Text
            className={`text-sm ${
              mode === "earn" ? "text-green-400" : "text-orange-400"
            }`}
          >
            {mode === "earn"
              ? `Issue ${group.customTokenSymbol || "tokens"} to customers as rewards for their purchases or loyalty.`
              : `Redeem ${group.customTokenSymbol || "tokens"} when customers want to use their balance for discounts.`}
          </Text>
        </View>

        {/* Customer Address */}
        <View className="mb-4">
          <Text className="text-gray-400 text-sm mb-2">Customer Wallet Address</Text>
          <View className="flex-row">
            <TextInput
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="0x..."
              placeholderTextColor="#666"
              className="flex-1 bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800 font-mono text-sm"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleLookupBalance}
              disabled={!customerAddress.trim() || isLoadingBalance}
              className="bg-zinc-800 rounded-lg px-4 ml-2 items-center justify-center"
            >
              {isLoadingBalance ? (
                <ActivityIndicator size="small" color="#FFCC00" />
              ) : (
                <Ionicons name="search" size={20} color="#FFCC00" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Customer Balance */}
        {customerBalance !== null && (
          <View className="bg-zinc-900 rounded-lg p-4 mb-4 border border-zinc-800">
            <Text className="text-gray-400 text-sm">Customer Balance</Text>
            <Text className="text-white text-2xl font-bold mt-1">
              {customerBalance}{" "}
              <Text className="text-purple-400 text-lg">
                {group.customTokenSymbol || "tokens"}
              </Text>
            </Text>
          </View>
        )}

        {/* Amount */}
        <View className="mb-4">
          <Text className="text-gray-400 text-sm mb-2">Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#666"
            className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800 text-lg"
            keyboardType="numeric"
          />
        </View>

        {/* Reason */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-2">Reason (Optional)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={mode === "earn" ? "e.g., Purchase reward" : "e.g., Discount redemption"}
            placeholderTextColor="#666"
            className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800"
            maxLength={100}
          />
        </View>

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
          className={`rounded-lg p-4 items-center ${
            isValid && !isSubmitting
              ? mode === "earn"
                ? "bg-green-500"
                : "bg-orange-500"
              : "bg-zinc-700"
          }`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`font-semibold text-base ${
                isValid ? "text-white" : "text-gray-500"
              }`}
            >
              {mode === "earn" ? "Issue Tokens" : "Redeem Tokens"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
