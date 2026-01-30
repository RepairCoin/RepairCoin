import React from "react";
import { Text, View, Pressable } from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CustomerGrowthData } from "@/shared/interfaces/shop.interface";
import StatCard from "@/shared/components/ui/StatCard";

function CustomerDetailSection({
  growthData,
}: {
  growthData?: CustomerGrowthData;
}) {
  const router = useRouter();

  return (
    <View>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Ionicons name="people" size={20} color="#FFCC00" />
          <Text className="text-white text-lg font-semibold ml-2">
            Customer Overview
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/shop/tabs/customer")}
          className="flex-row items-center"
        >
          <Text className="text-[#FFCC00] text-sm mr-1">View Recent</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFCC00" />
        </Pressable>
      </View>

      {/* Stats Grid 2x2 */}
      <View className="gap-2">
        <View className="flex-row">
          <StatCard
            icon={<Ionicons name="people" size={18} color="#FFCC00" />}
            value={growthData?.totalCustomers ?? 0}
            label="Total Customers"
          />
          <StatCard
            icon={<Ionicons name="person-add" size={18} color="#FFCC00" />}
            value={growthData?.newCustomers ?? 0}
            label="New Customers"
          />
        </View>
        <View className="flex-row">
          <StatCard
            icon={<MaterialIcons name="verified-user" size={18} color="#FFCC00" />}
            value={growthData?.activeCustomers ?? 0}
            label="Active"
          />
          <StatCard
            icon={<FontAwesome5 name="coins" size={14} color="#FFCC00" />}
            value={growthData?.averageEarningsPerCustomer ?? 0}
            label="Avg Earnings"
          />
        </View>
      </View>
    </View>
  );
}

export default React.memo(CustomerDetailSection);
