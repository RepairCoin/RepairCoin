import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { AppHeader } from "@/components/ui/AppHeader";
import { TransactionData } from "@/interfaces/customer.interface";

export default function RedeemScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress, useGetTransactionsByWalletAddress } = useCustomer();

  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useGetCustomerByWalletAddress(account?.address);

  const {
    data: transactionData,
    isLoading: transactionsLoading,
  } = useGetTransactionsByWalletAddress(account?.address, 50);

  const totalBalance =
    (customerData?.customer?.lifetimeEarnings || 0) -
    (customerData?.customer?.totalRedemptions || 0);

  const totalRedeemed = customerData?.customer?.totalRedemptions || 0;

  // Get recent redemptions
  const recentRedemptions = useMemo(() => {
    if (!transactionData?.transactions) return [];
    return transactionData.transactions
      .filter((t: TransactionData) =>
        ["redeemed", "redemption"].includes(t.type?.toLowerCase())
      )
      .slice(0, 5);
  }, [transactionData]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Redeem RCN" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">Loading...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Redeem RCN" />
        <View className="flex-1 justify-center items-center">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-400 text-lg mt-4">Failed to load data</Text>
          <Pressable
            onPress={() => refetch()}
            className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
          >
            <Text className="text-black font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Redeem RCN" />

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View className="mt-4 bg-zinc-900 rounded-2xl p-5">
          <Text className="text-gray-400 text-sm">Available to Redeem</Text>
          <Text className="text-[#FFCC00] text-4xl font-bold mt-1">
            {totalBalance} RCN
          </Text>
          <Text className="text-gray-500 text-sm mt-2">
            = ${(totalBalance * 0.1).toFixed(2)} USD value
          </Text>

          <View className="flex-row mt-4 pt-4 border-t border-zinc-800">
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Total Redeemed</Text>
              <Text className="text-white font-semibold">{totalRedeemed} RCN</Text>
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Redemption Rate</Text>
              <Text className="text-white font-semibold">$0.10 per RCN</Text>
            </View>
          </View>
        </View>

        {/* How to Redeem Section */}
        <View className="mt-6">
          <Text className="text-white text-lg font-bold mb-3">How to Redeem</Text>
          <View className="bg-zinc-900 rounded-xl p-4">
            {[
              {
                icon: "storefront-outline",
                title: "Visit a Partner Shop",
                desc: "Go to any RepairCoin partner shop near you",
              },
              {
                icon: "qr-code-outline",
                title: "Show Your QR Code",
                desc: "Let the shop scan your wallet QR code",
              },
              {
                icon: "checkmark-circle-outline",
                title: "Approve the Request",
                desc: "You'll receive a notification to approve the redemption",
              },
              {
                icon: "cash-outline",
                title: "Get Your Discount",
                desc: "Your RCN will be converted to store credit instantly",
              },
            ].map((step, index) => (
              <View
                key={index}
                className={`flex-row items-start ${index < 3 ? "mb-4 pb-4 border-b border-zinc-800" : ""}`}
              >
                <View className="bg-[#FFCC00]/20 rounded-full p-2 mr-3">
                  <Ionicons name={step.icon as any} size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold">{step.title}</Text>
                  <Text className="text-gray-400 text-sm mt-0.5">{step.desc}</Text>
                </View>
                <View className="bg-zinc-800 rounded-full w-6 h-6 items-center justify-center">
                  <Text className="text-gray-400 text-xs font-bold">{index + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Redemption Rules */}
        <View className="mt-6">
          <Text className="text-white text-lg font-bold mb-3">Redemption Rules</Text>
          <View className="bg-zinc-900 rounded-xl p-4">
            <View className="flex-row items-start mb-3">
              <MaterialIcons name="check-circle" size={18} color="#22C55E" />
              <Text className="text-gray-300 ml-2 flex-1">
                <Text className="text-green-400 font-semibold">100%</Text> redemption at the shop where you earned RCN
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <MaterialIcons name="check-circle" size={18} color="#22C55E" />
              <Text className="text-gray-300 ml-2 flex-1">
                <Text className="text-[#FFCC00] font-semibold">20%</Text> redemption at any other partner shop
              </Text>
            </View>
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={18} color="#3B82F6" />
              <Text className="text-gray-400 ml-2 flex-1 text-sm">
                Redemption requires shop approval. You'll receive a notification when a shop initiates a redemption.
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mt-6 flex-row">
          <TouchableOpacity
            onPress={() => router.push("/customer/qrcode")}
            className="flex-1 bg-[#FFCC00] rounded-xl py-4 mr-2 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={20} color="#000" />
            <Text className="text-black font-bold ml-2">Show QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/customer/tabs/transaction")}
            className="flex-1 bg-zinc-800 rounded-xl py-4 ml-2 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Feather name="clock" size={20} color="#fff" />
            <Text className="text-white font-bold ml-2">History</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Redemptions */}
        <View className="mt-6 mb-8">
          <Text className="text-white text-lg font-bold mb-3">Recent Redemptions</Text>
          {transactionsLoading ? (
            <View className="bg-zinc-900 rounded-xl p-6 items-center">
              <ActivityIndicator color="#FFCC00" />
            </View>
          ) : recentRedemptions.length > 0 ? (
            <View className="bg-zinc-900 rounded-xl overflow-hidden">
              {recentRedemptions.map((redemption: TransactionData, index: number) => (
                <View
                  key={redemption.id}
                  className={`flex-row items-center justify-between p-4 ${
                    index < recentRedemptions.length - 1 ? "border-b border-zinc-800" : ""
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="bg-red-500/20 rounded-full p-2 mr-3">
                      <MaterialIcons name="remove-circle-outline" size={20} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium" numberOfLines={1}>
                        {redemption.shopName || "Shop Redemption"}
                      </Text>
                      <Text className="text-gray-500 text-xs">
                        {new Date(redemption.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-red-400 font-bold">
                    -{Math.abs(redemption.amount)} RCN
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-zinc-900 rounded-xl p-6 items-center">
              <Feather name="inbox" size={32} color="#666" />
              <Text className="text-gray-400 mt-2">No redemptions yet</Text>
              <Text className="text-gray-500 text-sm text-center mt-1">
                Visit a partner shop to redeem your RCN
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
