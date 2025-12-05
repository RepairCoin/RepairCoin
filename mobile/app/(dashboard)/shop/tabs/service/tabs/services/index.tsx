import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import React, { useState, useMemo } from "react";
import { useService } from "@/hooks/service/useService";
import { ServiceData } from "@/interfaces/service.interface";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import ServiceCard from "@/components/shared/ServiceCard";

type StatusFilter = "all" | "active" | "inactive";

export default function ServicesTab({
  setActionModalVisible,
  setSelectedService,
}: {
  setActionModalVisible: (visible: boolean) => void;
  setSelectedService: (service: ServiceData) => void;
}) {
  const { useShopServicesQuery } = useService();
  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
  } = useShopServicesQuery();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSelectedCategories([]);
  };

  const hasActiveFilters =
    statusFilter !== "all" || selectedCategories.length > 0;

  const filteredServices = useMemo(() => {
    let services = servicesData || [];

    // Apply status filter
    if (statusFilter === "active") {
      services = services.filter((service: ServiceData) => service.active);
    } else if (statusFilter === "inactive") {
      services = services.filter((service: ServiceData) => !service.active);
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      services = services.filter((service: ServiceData) =>
        selectedCategories.includes(service.category)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      services = services.filter((service: ServiceData) =>
        service.serviceName.toLowerCase().includes(query)
      );
    }

    return services;
  }, [servicesData, statusFilter, selectedCategories, searchQuery]);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
        <View className="flex-1 flex-row items-center bg-zinc-800 rounded-full px-4 py-3">
          <Feather name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white ml-3"
            placeholder="Search services..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Filter Button */}
        <Pressable
          onPress={() => setFilterModalVisible(true)}
          className={`p-3 rounded-full ${
            hasActiveFilters ? "bg-[#FFCC00]" : "bg-zinc-800"
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
              <Pressable onPress={() => setStatusFilter("all")}>
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
      {(searchQuery.length > 0 || hasActiveFilters) && (
        <Text className="text-gray-400 text-sm mb-2">
          {filteredServices.length} result
          {filteredServices.length !== 1 ? "s" : ""} found
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
          data={filteredServices}
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
                {searchQuery.length > 0 || hasActiveFilters
                  ? "No services match your filters"
                  : "No services yet"}
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                {searchQuery.length > 0 || hasActiveFilters
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
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-zinc-900 rounded-t-3xl max-h-[80%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-zinc-800">
              <Text className="text-white text-lg font-semibold">Filters</Text>
              <Pressable onPress={() => setFilterModalVisible(false)}>
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
                  {(["all", "active", "inactive"] as StatusFilter[]).map(
                    (status) => (
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
                    )
                  )}
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
                  onPress={() => setFilterModalVisible(false)}
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
