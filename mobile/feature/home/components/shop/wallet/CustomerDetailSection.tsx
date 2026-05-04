import React, { useMemo } from "react";
import { Text, View, Pressable } from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CustomerGrowthData } from "@/shared/interfaces/shop.interface";
import { useShopCustomersQuery } from "@/feature/profile/customer/hooks";
import StatCard from "@/shared/components/ui/StatCard";

function CustomerDetailSection({
  growthData,
}: {
  growthData?: CustomerGrowthData;
}) {
  const router = useRouter();
  const { data: customerData } = useShopCustomersQuery();
  const customers = customerData?.customers || [];

  const fallbackStats = useMemo(() => {
    if (customers.length === 0) {
      return {
        regularCustomers: 0,
        avgEarningsPerCustomer: 0,
        activeThisWeek: 0,
      };
    }

    const regularCustomers = customers.filter(
      (c) => (c.total_transactions || 0) >= 5
    ).length;

    const totalEarnings = customers.reduce(
      (sum, c) => sum + (c.lifetimeEarnings || 0),
      0
    );
    const avgEarningsPerCustomer = Math.round(totalEarnings / customers.length);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeThisWeek = customers.filter((c) => {
      const lastTransaction = new Date(c.last_transaction_date || 0);
      return lastTransaction > weekAgo;
    }).length;

    return {
      regularCustomers,
      avgEarningsPerCustomer,
      activeThisWeek,
    };
  }, [customers]);

  const displayStats = {
    totalCustomers: growthData?.totalCustomers || customers.length,
    regularCustomers: growthData?.regularCustomers || fallbackStats.regularCustomers,
    avgEarningsPerCustomer: growthData?.averageEarningsPerCustomer || fallbackStats.avgEarningsPerCustomer,
    activeThisWeek: growthData?.activeCustomers || fallbackStats.activeThisWeek,
  };

  return (
    <View>
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

      <View className="gap-2">
        <View className="flex-row">
          <StatCard
            icon={<Ionicons name="people" size={18} color="#101010" />}
            value={displayStats.totalCustomers}
            label="Total"
          />
          <StatCard
            icon={<Ionicons name="people" size={18} color="#101010" />}
            value={displayStats.regularCustomers}
            label="Regulars"
          />
        </View>
        <View className="flex-row">
          <StatCard
            icon={<FontAwesome5 name="coins" size={14} color="#101010" />}
            value={displayStats.avgEarningsPerCustomer}
            label="Avg Earnings"
            suffix="RCN"
          />
          <StatCard
            icon={<MaterialIcons name="verified-user" size={18} color="#101010" />}
            value={displayStats.activeThisWeek}
            label="Active (7d)"
          />
        </View>
      </View>
    </View>
  );
}

export default React.memo(CustomerDetailSection);
