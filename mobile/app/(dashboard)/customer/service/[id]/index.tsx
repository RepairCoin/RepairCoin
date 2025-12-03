import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams, router } from "expo-router";
import { useService } from "@/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetService } = useService();
  const { data: serviceData, isLoading, error } = useGetService(id!);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCall = () => {
    if (serviceData?.shopPhone) {
      Linking.openURL(`tel:${serviceData.shopPhone}`);
    }
  };

  const handleEmail = () => {
    if (serviceData?.shopEmail) {
      Linking.openURL(`mailto:${serviceData.shopEmail}`);
    }
  };

  const handleBookNow = () => {
    console.log("Book Now")
    // router.push({
    //   pathname: "/customer/checkout",
    //   params: { serviceId: id },
    // });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (error || !serviceData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={goBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Service not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          {serviceData.imageUrl ? (
            <Image
              source={{ uri: serviceData.imageUrl }}
              className="w-full h-64"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-64 bg-gray-800 items-center justify-center">
              <Ionicons name="image-outline" size={64} color="#6B7280" />
            </View>
          )}

          {/* Back Button Overlay */}
          <TouchableOpacity
            onPress={goBack}
            className="absolute top-14 left-4 bg-black/50 rounded-full p-2"
          >
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>

          {/* Status Badge */}
          <View
            className={`absolute top-14 right-4 px-3 py-1 rounded-full ${
              serviceData.active ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <Text className="text-white text-sm font-medium">
              {serviceData.active ? "Available" : "Unavailable"}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Category & Duration */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="bg-gray-800 px-3 py-1 rounded-full">
              <Text className="text-gray-400 text-xs uppercase">
                {getCategoryLabel(serviceData.category)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={16} color="#9CA3AF" />
              <Text className="text-gray-400 text-sm ml-1">
                {serviceData.durationMinutes} min
              </Text>
            </View>
          </View>

          {/* Service Name */}
          <Text className="text-white text-2xl font-bold mb-2">
            {serviceData.serviceName}
          </Text>

          {/* Price */}
          <Text className="text-[#FFCC00] text-3xl font-bold mb-4">
            ${serviceData.priceUsd}
          </Text>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-gray-400 text-base leading-6">
              {serviceData.description || "No description available."}
            </Text>
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Shop Information */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Shop Information
            </Text>

            {/* Shop Name */}
            {serviceData.shopName && (
              <View className="flex-row items-center mb-3">
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="storefront-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Shop Name</Text>
                  <Text className="text-white text-base">
                    {serviceData.shopName}
                  </Text>
                </View>
              </View>
            )}

            {/* Shop Address */}
            {serviceData.shopAddress && (
              <View className="flex-row items-center mb-3">
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="location-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Address</Text>
                  <Text className="text-white text-base">
                    {serviceData.shopAddress}
                  </Text>
                </View>
              </View>
            )}

            {/* Shop Phone */}
            {serviceData.shopPhone && (
              <TouchableOpacity
                onPress={handleCall}
                className="flex-row items-center mb-3"
              >
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="call-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Phone</Text>
                  <Text className="text-[#FFCC00] text-base">
                    {serviceData.shopPhone}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            {/* Shop Email */}
            {serviceData.shopEmail && (
              <TouchableOpacity
                onPress={handleEmail}
                className="flex-row items-center mb-3"
              >
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="mail-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Email</Text>
                  <Text className="text-[#FFCC00] text-base">
                    {serviceData.shopEmail}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Additional Info */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Additional Information
            </Text>

            <View className="flex-row items-center">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Listed On</Text>
                <Text className="text-white text-base">
                  {formatDate(serviceData.createdAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      {serviceData.active && (
        <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-gray-800">
          <TouchableOpacity
            onPress={handleBookNow}
            className="bg-[#FFCC00] rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-black text-lg font-bold">Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
