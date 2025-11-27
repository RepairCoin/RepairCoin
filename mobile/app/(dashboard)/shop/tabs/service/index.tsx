import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useShopServices } from "@/hooks/useShopService";
import { useState } from "react";
import { ServiceData } from "@/services/ShopServices";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";

const datajson = [
  {
    active: true,
    category: "Automotive",
    createdAt: "2023-01-01T00:00:00Z",
    description:
      "Complete oil change service with filter replacement and fluid top-up",
    durationMinutes: 30,
    imageUrl:
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400&h=300&fit=crop",
    priceUsd: 45,
    serviceId: "1",
    serviceName: "Oil Change",
    shopId: "1",
    tags: ["Automotive", "Maintenance"],
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    active: true,
    category: "education_classes",
    createdAt: "2023-01-01T00:00:00Z",
    description: "Professional brake pad replacement for all vehicle types",
    durationMinutes: 90,
    imageUrl:
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=300&fit=crop",
    priceUsd: 150,
    serviceId: "2",
    serviceName: "Brake Service",
    shopId: "1",
    tags: ["Automotive", "Safety"],
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    active: false,
    category: "Automotive",
    createdAt: "2023-01-01T00:00:00Z",
    description: "Complete tire rotation and wheel alignment service",
    durationMinutes: 60,
    imageUrl:
      "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=400&h=300&fit=crop",
    priceUsd: 80,
    serviceId: "3",
    serviceName: "Tire Rotation",
    shopId: "1",
    tags: ["Automotive", "Tires"],
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    active: true,
    category: "Automotive",
    createdAt: "2023-01-01T00:00:00Z",
    description: "Full diagnostic scan and engine performance check",
    durationMinutes: 45,
    imageUrl:
      "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=400&h=300&fit=crop",
    priceUsd: 95,
    serviceId: "4",
    serviceName: "Engine Diagnostic",
    shopId: "1",
    tags: ["Automotive", "Diagnostic"],
    updatedAt: "2023-01-01T00:00:00Z",
  },
];

export default function Service() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: servicesData, isLoading, error, refetch } = useShopServices();

  console.log("servicesDataservicesData: ", servicesData);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleAddPress = () => {
    console.log("Add button pressed");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <View className="flex-1 mx-2 my-2">
      <TouchableOpacity activeOpacity={0.8}>
        <View className="bg-gray-900 rounded-xl overflow-hidden">
          <View className="relative">
            <Image
              source={{
                uri:
                  item.imageUrl ||
                  "https://via.placeholder.com/200x120/2D3748/FFCC00?text=Service",
              }}
              className="w-full h-28"
              resizeMode="cover"
            />
            <View
              className={`absolute top-2 right-2 px-2 py-1 rounded-full ${item.active ? "bg-green-500" : "bg-gray-600"}`}
            >
              <Text className="text-white text-xs font-medium">
                {item.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>

          <View className="p-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-gray-500 uppercase tracking-wide">
                {getCategoryLabel(item.category)}
              </Text>
            </View>

            <Text
              className="text-white text-base font-semibold mb-1"
              numberOfLines={1}
            >
              {item.serviceName}
            </Text>

            <Text
              className="text-gray-400 text-xs leading-4 mb-3"
              numberOfLines={2}
            >
              {item.description}
            </Text>

            <View className="border-t border-gray-800 pt-3">
              <Text className="text-[#FFCC00] font-bold text-lg">
                ${item.priceUsd}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 flex-1">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-semibold">Services</Text>
          <View className="w-[25px]" />
        </View>

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
            data={datajson}
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
                  No services yet
                </Text>
                <Text className="text-gray-500 text-sm text-center mt-2">
                  Tap the + button to add your first service
                </Text>
              </View>
            }
          />
        )}
      </View>

      <TouchableOpacity
        onPress={handleAddPress}
        className="absolute bottom-6 right-6 bg-[#FFCC00] w-14 h-14 rounded-full items-center justify-center"
        style={{
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={28} color="black" />
      </TouchableOpacity>
    </ThemedView>
  );
}
