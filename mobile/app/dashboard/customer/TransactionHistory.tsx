import TransactionHistoryCard from "@/components/customer/TransactionHistoryCard";
import TransactionHistoryFilterModal from "@/components/customer/TransactionHistoryFilterModal";
import { AntDesign, Feather, FontAwesome } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useCustomerStore } from "@/store/customerStore";

export default function TransactionHistory() {
  const { userProfile } = useAuthStore((state) => state);
  const { fetchEarningHistory, earningHistory } = useCustomerStore((state) => state);
  const [searchString, setSearchString] = useState<string>("");
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (!userProfile) return;
    
    const loadData = async () => {
      try {
        await fetchEarningHistory(userProfile.address);
      } catch (error) {
        console.error("Failed to fetch customer data:", error);
      }
    };

    loadData();
  }, []);
  
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
        <TransactionHistoryCard success={true} />
        <TransactionHistoryCard success={false} />
        <TransactionHistoryCard success={true} />
        <TransactionHistoryCard success={false} />
        <TransactionHistoryCard success={false} />
        <TransactionHistoryCard success={true} />
        <TransactionHistoryCard success={false} />
        <TransactionHistoryCard success={true} />
        <TransactionHistoryCard success={true} />
      </ScrollView>
      <TransactionHistoryFilterModal
        visible={filterModalVisible}
        requestClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
}
