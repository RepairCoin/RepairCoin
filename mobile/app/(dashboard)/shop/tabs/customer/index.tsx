import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { SearchInput } from "@/components/ui/SearchInput";
import CustomerCard from "@/components/shop/CustomerCard";
import { useAuthStore } from "@/store/auth.store";
import { useShop } from "@/hooks/shop/useShop";

export default function CustomerList() {
  const { userProfile } = useAuthStore();
  const { useGetShopCustomers, useShopCustomerGrowth } = useShop();
  const { data: shopCustomerData, isLoading } = useGetShopCustomers(
    userProfile?.shopId || ""
  );

  const [searchText, setSearchText] = useState("");

  const filteredCustomers = shopCustomerData?.customers?.filter(
    (customer: any) =>
      customer?.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 mb-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">
            Customers List
          </Text>
          <View className="w-[25px]" />
        </View>
        <SearchInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search customers..."
        />
      </View>

      <FlatList
        data={filteredCustomers || []}
        keyExtractor={(item, index) => item?.name || index.toString()}
        renderItem={({ item }) => {
          return (
            <CustomerCard
              name={item?.name}
              tier={item?.tier}
              lifetimeEarnings={item?.lifetimeEarnings}
              lastTransactionDate={item?.lastEarnedDate}
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
