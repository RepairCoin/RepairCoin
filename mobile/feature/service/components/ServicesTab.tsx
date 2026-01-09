import React from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";

// Components
import ServiceCard from "@/components/shared/ServiceCard";
import { SearchInput } from "@/components/ui/SearchInput";

// Hooks
import {
  useServicesTabUI,
} from "../hooks";
import { getCategoryLabel } from "@/utilities/getCategoryLabel";

// Others
import { ServiceData } from "@/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { SERVICE_STATUS_OPTIONS } from "../constants";

interface ServicesTabProps {
  setActionModalVisible: (visible: boolean) => void;
  setSelectedService: (service: ServiceData) => void;
}

export default function ServicesTab({
  setActionModalVisible,
  setSelectedService,
}: ServicesTabProps) {
  // Combined UI state and data fetching
  const {
    // Data
    services,
    serviceCount,
    isLoading,
    error,
    refreshing,
    handleRefresh,
    refetch,
    // Search
    searchQuery,
    setSearchQuery,
    // Filter modal
    filterModalVisible,
    openFilterModal,
    closeFilterModal,
    // Status filter
    statusFilter,
    setStatusFilter,
    clearStatusFilter,
    // Category filter
    selectedCategories,
    toggleCategory,
    // Combined
    hasActiveFilters,
    hasSearchOrFilters,
    clearFilters,
  } = useServicesTabUI();

  const handleMenuPress = (item: ServiceData) => {
    setSelectedService(item);
    setActionModalVisible(true);
  };

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <ServiceCard
      imageUrl={item.imageUrl}
      category={getCategoryLabel(item.category)}
      title={item.serviceName}
      description={item.description}
      price={item.priceUsd}
      badgeStatus={{
        label: item.active ? "Active" : "Inactive",
        active: item.active,
      }}
      onPress={() => router.push(`/shop/service/${item.serviceId}`)}
      showMenu
      menuPosition="footer"
      onMenuPress={() => handleMenuPress(item)}
    />
  );

  return (
    <React.Fragment>
      {/* Search Input with Filter Button */}
      <View className="flex-row items-center gap-2 mb-4">
        <View className="flex-1">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search services..."
          />
        </View>

        {/* Filter Button */}
        <Pressable
          onPress={openFilterModal}
          className={`p-3 rounded-full ${
            hasActiveFilters ? "bg-[#FFCC00]" : ""
          }`}
        >
          <Ionicons
            name="filter"
            size={20}
            color={hasActiveFilters ? "#000" : "#9CA3AF"}
          />
        </Pressable>
      </View>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {statusFilter !== "all" && (
            <View className="flex-row items-center bg-[#FFCC00]/20 px-3 py-1 rounded-full">
              <Text className="text-[#FFCC00] text-xs mr-1 capitalize">
                {statusFilter}
              </Text>
              <Pressable onPress={clearStatusFilter}>
                <Feather name="x" size={14} color="#FFCC00" />
              </Pressable>
            </View>
          )}
          {selectedCategories.map((cat) => (
            <View
              key={cat}
              className="flex-row items-center bg-[#FFCC00]/20 px-3 py-1 rounded-full"
            >
              <Text className="text-[#FFCC00] text-xs mr-1">
                {getCategoryLabel(cat)}
              </Text>
              <Pressable onPress={() => toggleCategory(cat)}>
                <Feather name="x" size={14} color="#FFCC00" />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={clearFilters}>
            <Text className="text-gray-400 text-xs underline py-1">
              Clear all
            </Text>
          </Pressable>
        </View>
      )}

      {/* Results count when searching or filtering */}
      {hasSearchOrFilters && (
        <Text className="text-gray-400 text-sm mb-2">
          {serviceCount} result{serviceCount !== 1 ? "s" : ""} found
        </Text>
      )}

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500">Failed to load services</Text>
          <TouchableOpacity onPress={() => refetch()} className="mt-2">
            <Text className="text-[#FFCC00]">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item, index) => `${item.serviceId}-${index}`}
          renderItem={renderServiceItem}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pt-20">
              <Ionicons name="briefcase-outline" size={64} color="#666" />
              <Text className="text-gray-400 text-center mt-4">
                {hasSearchOrFilters
                  ? "No services match your filters"
                  : "No services yet"}
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                {hasSearchOrFilters
                  ? "Try adjusting your search or filters"
                  : "Tap the + button to add your first service"}
              </Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={closeFilterModal}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-zinc-900 rounded-t-3xl max-h-[80%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-zinc-800">
              <Text className="text-white text-lg font-semibold">Filters</Text>
              <Pressable onPress={closeFilterModal}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </Pressable>
            </View>

            <ScrollView className="p-4">
              {/* Status Filter */}
              <View className="mb-6">
                <Text className="text-white text-base font-semibold mb-3">
                  Status
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {SERVICE_STATUS_OPTIONS.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => setStatusFilter(status)}
                      className={`px-4 py-2 rounded-full ${
                        statusFilter === status
                          ? "bg-[#FFCC00]"
                          : "bg-zinc-800"
                      }`}
                    >
                      <Text
                        className={`capitalize ${
                          statusFilter === status
                            ? "text-black font-semibold"
                            : "text-gray-400"
                        }`}
                      >
                        {status}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Categories Filter */}
              <View className="mb-6">
                <Text className="text-white text-base font-semibold mb-3">
                  Categories
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.value}
                      onPress={() => toggleCategory(cat.value)}
                      className={`px-4 py-2 rounded-full ${
                        selectedCategories.includes(cat.value)
                          ? "bg-[#FFCC00]"
                          : "bg-zinc-800"
                      }`}
                    >
                      <Text
                        className={`${
                          selectedCategories.includes(cat.value)
                            ? "text-black font-semibold"
                            : "text-gray-400"
                        }`}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 pb-8">
                <Pressable
                  onPress={clearFilters}
                  className="flex-1 py-3 rounded-full border border-zinc-700"
                >
                  <Text className="text-white text-center font-semibold">
                    Clear All
                  </Text>
                </Pressable>
                <Pressable
                  onPress={closeFilterModal}
                  className="flex-1 py-3 rounded-full bg-[#FFCC00]"
                >
                  <Text className="text-black text-center font-semibold">
                    Apply Filters
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </React.Fragment>
  );
}
