// Libraries
import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Components
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import CustomerCard from "../components/CustomerCard";

// Hooks
import { useCustomerListUI } from "../hooks";
import type { TierFilter, SortBy } from "../hooks/ui/useCustomerListUI";

// Others
import { CustomerData } from "@/shared/interfaces/customer.interface";

// Filter Options
const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All Tiers" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "earnings", label: "Highest Earnings" },
  { value: "active", label: "Most Active" },
];

// Tab Button Component
function TabButton({
  label,
  icon,
  isActive,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl ${
        isActive ? "bg-[#FFCC00]" : "bg-transparent"
      }`}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isActive ? "#101010" : "#fff"}
      />
      <Text
        className={`ml-2 font-semibold text-sm ${
          isActive ? "text-[#101010]" : "text-white"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Filter Dropdown Component
function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
        className="flex-1 flex-row items-center justify-between bg-zinc-800 rounded-xl px-3 py-2.5"
      >
        <View className="flex-row items-center flex-1">
          <Ionicons name={icon} size={16} color="#9CA3AF" />
          <Text className="text-white text-sm ml-2" numberOfLines={1}>
            {selectedOption?.label || label}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setIsOpen(false)}
        >
          <View className="bg-zinc-900 rounded-t-3xl pb-8">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <Text className="text-white text-lg font-semibold">{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="px-4 pt-2">
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  activeOpacity={0.7}
                  className={`flex-row items-center justify-between py-4 px-4 rounded-xl mb-1 ${
                    value === option.value ? "bg-[#FFCC00]/10" : ""
                  }`}
                >
                  <Text
                    className={`text-base ${
                      value === option.value
                        ? "text-[#FFCC00] font-semibold"
                        : "text-white"
                    }`}
                  >
                    {option.label}
                  </Text>
                  {value === option.value && (
                    <Ionicons name="checkmark" size={20} color="#FFCC00" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function CustomerListScreen() {
  const {
    // View mode
    viewMode,
    setViewMode,
    // My Customers
    myCustomers,
    myCustomerCount,
    totalMyCustomerCount,
    isLoadingMyCustomers,
    searchText,
    setSearchText,
    hasSearchQuery,
    // Filters
    tierFilter,
    setTierFilter,
    sortBy,
    setSortBy,
    // Search All
    searchAllQuery,
    setSearchAllQuery,
    searchAllResults,
    searchAllResultCount,
    searchAllTotalCount,
    isSearchingAll,
    hasSearchedAll,
    handleSearchAll,
    // Refresh
    refreshing,
    handleRefresh,
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

  const renderEmptyMyCustomers = () => (
    <View className="items-center justify-center py-10">
      {isLoadingMyCustomers ? (
        <ActivityIndicator size="large" color="#ffcc00" />
      ) : (
        <>
          <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mb-4">
            <Ionicons name="people-outline" size={32} color="#4B5563" />
          </View>
          <Text className="text-white text-lg font-semibold mb-2">
            {hasSearchQuery || tierFilter !== "all"
              ? "No customers found"
              : "No customers yet"}
          </Text>
          <Text className="text-[#666] text-sm text-center px-8">
            {hasSearchQuery || tierFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Your customers will appear here once they start transacting"}
          </Text>
        </>
      )}
    </View>
  );

  const renderEmptySearchAll = () => (
    <View className="items-center justify-center py-10">
      {isSearchingAll ? (
        <ActivityIndicator size="large" color="#ffcc00" />
      ) : !hasSearchedAll ? (
        <>
          <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mb-4">
            <Ionicons name="search-outline" size={32} color="#4B5563" />
          </View>
          <Text className="text-white text-lg font-semibold mb-2">
            Search for Customers
          </Text>
          <Text className="text-[#666] text-sm text-center px-8">
            Enter a customer name or wallet address to find their profile
          </Text>
        </>
      ) : (
        <>
          <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mb-4">
            <Ionicons name="person-outline" size={32} color="#4B5563" />
          </View>
          <Text className="text-white text-lg font-semibold mb-2">
            No Customers Found
          </Text>
          <Text className="text-[#666] text-sm text-center px-8">
            No customers match your search. Try a different name or wallet address.
          </Text>
        </>
      )}
    </View>
  );

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 mb-4">
        {/* Header */}
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xl font-semibold">
            Customers
          </Text>
          <View className="w-[25px]" />
        </View>

        {/* Tab Buttons */}
        <View className="bg-[#1a1a1a] rounded-2xl p-1 flex-row">
          <TabButton
            label="My Customers"
            icon="people"
            isActive={viewMode === "my-customers"}
            onPress={() => setViewMode("my-customers")}
          />
          <TabButton
            label="Search All"
            icon="search"
            isActive={viewMode === "search-all"}
            onPress={() => setViewMode("search-all")}
          />
        </View>

        {/* Search Input - Different for each tab */}
        {viewMode === "my-customers" ? (
          <>
            <SearchInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search your customers..."
            />

            {/* Filter Dropdowns */}
            <View className="flex-row gap-3">
              <FilterDropdown
                label="Tier"
                value={tierFilter}
                options={TIER_OPTIONS}
                onChange={setTierFilter}
                icon="medal-outline"
              />
              <FilterDropdown
                label="Sort By"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={setSortBy}
                icon="swap-vertical"
              />
            </View>

            {/* Results Count */}
            {!isLoadingMyCustomers && (
              <View className="flex-row items-center">
                <Text className="text-gray-400 text-sm">
                  {myCustomerCount === totalMyCustomerCount
                    ? `${totalMyCustomerCount} customer${totalMyCustomerCount !== 1 ? "s" : ""}`
                    : `${myCustomerCount} of ${totalMyCustomerCount} customers`}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <SearchInput
                value={searchAllQuery}
                onChangeText={setSearchAllQuery}
                placeholder="Enter name or wallet address..."
                onSubmitEditing={handleSearchAll}
              />
            </View>
            <TouchableOpacity
              onPress={handleSearchAll}
              disabled={!searchAllQuery.trim() || isSearchingAll}
              className={`px-4 rounded-xl items-center justify-center ${
                !searchAllQuery.trim() || isSearchingAll
                  ? "bg-zinc-700"
                  : "bg-[#FFCC00]"
              }`}
              activeOpacity={0.7}
            >
              {isSearchingAll ? (
                <ActivityIndicator size="small" color="#101010" />
              ) : (
                <Ionicons
                  name="search"
                  size={20}
                  color={!searchAllQuery.trim() ? "#666" : "#101010"}
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Results Count for Search All */}
        {viewMode === "search-all" && hasSearchedAll && !isSearchingAll && (
          <View className="flex-row items-center">
            <Text className="text-gray-400 text-sm">
              {searchAllResultCount > 0
                ? `${searchAllTotalCount} result${searchAllTotalCount !== 1 ? "s" : ""} found`
                : "No results"}
            </Text>
          </View>
        )}
      </View>

      {/* Customer List */}
      {viewMode === "my-customers" ? (
        <FlatList
          data={myCustomers}
          keyExtractor={(item, index) => item?.address || index.toString()}
          renderItem={renderCustomer}
          contentContainerStyle={{ paddingBottom: 160, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyMyCustomers}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
        />
      ) : (
        <FlatList
          data={searchAllResults}
          keyExtractor={(item, index) => item?.address || index.toString()}
          renderItem={renderCustomer}
          contentContainerStyle={{ paddingBottom: 160, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptySearchAll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
        />
      )}
    </ThemedView>
  );
}
