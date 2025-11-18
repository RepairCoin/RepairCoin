import React, { useState } from "react";
import { View, ScrollView, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import {
  Feather,
  Fontisto,
  MaterialCommunityIcons,
  Octicons,
} from "@expo/vector-icons";
import HorizontalCard from "@/components/ui/HorizontalCard";
import { ThemedView } from "@/components/ui/ThemedView";
import CustomerCard from "@/components/shop/CustomerCard";
import {
  useGetShopCustomers,
  useShopCustomerGrowth,
} from "@/hooks/useShopQueries";
import { useAuthStore } from "@/store/authStore";

export default function CustomerList() {
  const { userProfile } = useAuthStore();
  const [searchText, setSearchText] = useState("");
  const { data: growthData } = useShopCustomerGrowth(userProfile?.shopId || "");
  const { data: shopCustomerData, isLoading } = useGetShopCustomers(
    userProfile?.shopId || ""
  );

  console.log("shopCustomerData:", shopCustomerData);
  
  const filteredCustomers = shopCustomerData?.customers?.filter((customer: any) =>
    customer?.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  const horizontalCardList: {
    label: string;
    Icon: any;
    number: number;
  }[] = [
    {
      label: "Total Customers",
      Icon: <Octicons name="people" color="#ffcc00" size={22} />,
      number: growthData?.totalCustomers || 0,
    },
    {
      label: "Avg. RCN per Customer",
      Icon: (
        <MaterialCommunityIcons
          name="hand-coin-outline"
          color="#ffcc00"
          size={22}
        />
      ),
      number: growthData?.averageEarningsPerCustomer || 0,
    },
    {
      label: "New Customers",
      Icon: <Fontisto name="clock" color="#ffcc00" size={22} />,
      number: growthData?.newCustomers || 0,
    },
    {
      label: "Active Customers",
      Icon: <Feather name="user-check" color="#ffcc00" size={22} />,
      number: growthData?.activeCustomers || 0,
    },
  ];

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">
            Customers List
          </Text>
          <View className="w-[25px]" />
        </View>
        <View className="flex-row justify-between">
          <View className="flex-row px-4 border-2 border-[#666] rounded-full items-center w-full">
            <Feather name="search" color="#666" size={20} />
            <TextInput
              placeholder="Search customer by name"
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={setSearchText}
              className="text-white ml-2 w-full py-2"
            />
          </View>
        </View>
      </View>
      
      <View className="flex-row flex-wrap my-4">
        {horizontalCardList.map((props, i) => (
          <View key={i} style={{ width: "50%" }}>
            <HorizontalCard {...props} />
          </View>
        ))}
      </View>

      <View className="mx-4 mb-4 pl-2 py-4 rounded-t-xl p-2 gap-4 bg-[#FFCC00]">
        <Text className="text-black text-lg font-semibold">Recent Customers</Text>
      </View>

      <FlatList
        data={filteredCustomers || []}
        keyExtractor={(item, index) => item?.name || index.toString()}
        renderItem={({ item }) => {
          console.log("Rendering customer:", item);
          return (
            <CustomerCard
              name={item?.name}
              tier={item?.tier}
              lifetimeEarnings={item?.lifetime_earnings}
              lastTransactionDate={item?.last_transaction_date}
              onPress={() => console.log("Customer pressed:", item?.name)}
            />
          );
        }}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-10">
            {isLoading ? (
              <ActivityIndicator size="large" color="#ffcc00" />
            ) : (
              <Text className="text-[#666] text-base">
                {searchText ? "No customers found" : "No customers yet"}
              </Text>
            )}
          </View>
        }
      />
    </ThemedView>
  );
}
