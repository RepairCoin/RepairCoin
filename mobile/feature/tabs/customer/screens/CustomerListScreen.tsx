// Libraries
import React from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";

// Components
import { ThemedView } from "@/components/ui/ThemedView";
import { SearchInput } from "@/components/ui/SearchInput";
import CustomerCard from "../components/CustomerCard";

// Hooks
import { useCustomerListUI } from "../hooks";

// Others
import { CustomerData } from "@/shared/interfaces/customer.interface";

export default function CustomerListScreen() {
  const {
    customers,
    isLoading,
    refreshing,
    handleRefresh,
    searchText,
    setSearchText,
    hasSearchQuery,
  } = useCustomerListUI();

  const renderCustomer = ({ item }: { item: CustomerData }) => (
    <CustomerCard
      name={item?.name}
      tier={item?.tier}
      lifetimeEarnings={item?.lifetimeEarnings}
      total_transactions={item?.total_transactions}
      onPress={() => {
        router.push(`/shop/profile/customer-profile/${item?.address}` as any);
      }}
    />
  );

  const renderEmptyComponent = () => (
    <View className="items-center justify-center py-10">
      {isLoading ? (
        <ActivityIndicator size="large" color="#ffcc00" />
      ) : (
        <Text className="text-[#666] text-base">
          {hasSearchQuery ? "No customers found" : "No customers yet"}
        </Text>
      )}
    </View>
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
        data={customers}
        keyExtractor={(item, index) => item?.address || index.toString()}
        renderItem={renderCustomer}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      />
    </ThemedView>
  );
}
