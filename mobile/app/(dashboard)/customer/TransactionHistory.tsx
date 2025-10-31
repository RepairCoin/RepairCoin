import TransactionHistoryCard from "@/components/customer/TransactionHistoryCard";
import TransactionHistoryFilterModal from "@/components/customer/TransactionHistoryFilterModal";
import { AntDesign, Feather, FontAwesome } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useCustomerStore } from "@/store/customerStore";
import { useEarningHistory } from "@/hooks";
import { EarningHistory } from "@/services/customerServices";

export default function TransactionHistory() {
  const { userProfile, account } = useAuthStore((state) => state);
  const [searchString, setSearchString] = useState<string>("");
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

  // Use the token balance hook
  const {
    data: earningHistoryData,
    isLoading,
    error,
    refetch,
  } = useEarningHistory(account?.address);

  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-xl font-semibold">
            Transaction History
          </Text>
          <View className="w-8 h-8 bg-white rounded-full items-center justify-center">
            <Feather name="download" color="#000" size={16} />
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-row px-4 border-2 border-[#666] rounded-full items-center">
            <Feather name="search" color="#666" size={20} />
            <TextInput
              placeholder="Search Here"
              placeholderTextColor="#666"
              value={searchString}
              onChangeText={setSearchString}
              keyboardType="email-address"
              className="color-[#666] ml-2 w-[70%]"
            />
          </View>
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            className="flex-row px-6 border-2 border-[#666] rounded-full items-center"
          >
            <FontAwesome name="sliders" color="#666" size={20} />
          </Pressable>
        </View>
      </View>
      <ScrollView className="px-4 mt-4">
        {isLoading ? (
          <View className="items-center justify-center py-8">
            <Text className="text-white text-lg">Loading transactions...</Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-8">
            <Text className="text-red-500 text-lg">Failed to load transactions</Text>
            <Pressable
              onPress={() => refetch()}
              className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-lg"
            >
              <Text className="text-black font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : earningHistoryData?.transactions && earningHistoryData.transactions.length > 0 ? (
          earningHistoryData.transactions
            .filter((transaction: EarningHistory) => 
              !searchString || 
              transaction.description?.toLowerCase().includes(searchString.toLowerCase()) ||
              transaction.shopName?.toLowerCase().includes(searchString.toLowerCase())
            )
            .map((transaction: EarningHistory) => (
              <TransactionHistoryCard
                key={transaction.id}
                type={transaction.type}
                amount={transaction.amount}
                shopName={transaction.shopName}
                description={transaction.description}
                createdAt={transaction.createdAt}
              />
            ))
        ) : (
          <View className="items-center justify-center py-8">
            <Text className="text-gray-400 text-lg">No transactions found</Text>
          </View>
        )}
      </ScrollView>
      <TransactionHistoryFilterModal
        visible={filterModalVisible}
        requestClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
}
