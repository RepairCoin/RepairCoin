import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useServiceAnalyticsQuery } from "../hooks";
import { TrendDays } from "@/feature/services/services/service.interface";
import { ThemedView } from "@/shared/components/ui/ThemedView";

const TREND_OPTIONS: { label: string; value: TrendDays }[] = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ServiceAnalyticsTab() {
  const [trendDays, setTrendDays] = useState<TrendDays>(30);
  const { data, isLoading, error, refetch } = useServiceAnalyticsQuery(trendDays);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading analytics...</Text>
      </ThemedView>
    );
  }

  if (error || !data) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-white text-lg font-semibold mt-4">
          Failed to load analytics
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-6 bg-[#FFCC00] px-6 py-3 rounded-xl"
        >
          <Text className="text-black font-semibold">Try Again</Text>
        </Pressable>
      </ThemedView>
    );
  }

  const { overview, topServices, orderTrends, categoryBreakdown } = data;

  return (
    <ThemedView className="flex-1 mt-4">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
        {/* Period Filter */}
        <View className="flex-row gap-2 mb-4">
          {TREND_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setTrendDays(opt.value)}
              className={`flex-1 py-2 rounded-lg items-center ${
                trendDays === opt.value ? "bg-[#FFCC00]" : "bg-[#1a1a1a]"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  trendDays === opt.value ? "text-black" : "text-gray-400"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary Cards */}
        <View className="flex-row flex-wrap gap-3 mb-4">
          <View className="flex-1 min-w-[45%] bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-400 text-xs mb-1">Total Services</Text>
            <Text className="text-white text-xl font-bold">{overview.totalServices}</Text>
            <Text className="text-gray-500 text-xs mt-1">
              {overview.activeServices} active, {overview.inactiveServices} inactive
            </Text>
          </View>

          <View className="flex-1 min-w-[45%] bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-400 text-xs mb-1">Total Revenue</Text>
            <Text className="text-green-400 text-xl font-bold">
              ${overview.totalRevenue.toFixed(2)}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              From {overview.totalOrders} total orders
            </Text>
          </View>

          <View className="flex-1 min-w-[45%] bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-400 text-xs mb-1">Avg Order Value</Text>
            <Text className="text-white text-xl font-bold">
              ${overview.averageOrderValue.toFixed(2)}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              {overview.totalOrders > 0
                ? `${((overview.completedOrders / overview.totalOrders) * 100).toFixed(1)}% completion rate`
                : "No orders yet"}
            </Text>
          </View>

          <View className="flex-1 min-w-[45%] bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-400 text-xs mb-1">Customer Rating</Text>
            <Text className="text-[#FFCC00] text-xl font-bold">
              {overview.averageRating.toFixed(1)} / 5.0
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              From {overview.totalReviews} reviews
            </Text>
          </View>

          <View className="flex-1 min-w-[45%] bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-400 text-xs mb-1">RCN Redeemed</Text>
            <Text className="text-purple-400 text-xl font-bold">
              {overview.totalRcnRedeemed.toLocaleString()} RCN
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              ${overview.totalRcnDiscountUsd.toFixed(2)} in discounts
            </Text>
          </View>

          <View className="flex-1 min-w-[45%] bg-[#1a1a1a] rounded-xl p-4">
            <Text className="text-gray-400 text-xs mb-1">Total Favorites</Text>
            <Text className="text-blue-400 text-xl font-bold">{overview.totalFavorites}</Text>
            <Text className="text-gray-500 text-xs mt-1">Customer saved services</Text>
          </View>
        </View>

        {/* Top Performing Services */}
        {topServices.length > 0 && (
          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
            <Text className="text-white font-bold text-base mb-1">
              Top Performing Services
            </Text>
            <Text className="text-gray-500 text-xs mb-4">
              Your best services by revenue (last {trendDays} days)
            </Text>

            {topServices.map((service, index) => (
              <View
                key={service.serviceId}
                className="flex-row items-center py-3 border-b border-gray-800 last:border-b-0"
              >
                <View className="w-8 h-8 bg-[#FFCC00] rounded-full items-center justify-center mr-3">
                  <Text className="text-black font-bold text-sm">#{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                    {service.serviceName}
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    {service.category} · ${service.priceUsd.toFixed(2)}
                  </Text>
                </View>
                <View className="items-end ml-2">
                  <Text className="text-green-400 font-bold text-sm">
                    ${service.totalRevenue.toFixed(2)}
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    {service.totalOrders} orders
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
            <Text className="text-white font-bold text-base mb-1">
              Category Breakdown
            </Text>
            <Text className="text-gray-500 text-xs mb-4">Revenue by service category</Text>

            {categoryBreakdown.map((cat) => {
              const totalRevenue = categoryBreakdown.reduce((sum, c) => sum + c.totalRevenue, 0);
              const pct = totalRevenue > 0 ? (cat.totalRevenue / totalRevenue) * 100 : 0;

              return (
                <View key={cat.category} className="mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-300 text-sm">{cat.category}</Text>
                    <Text className="text-gray-400 text-sm">
                      ${cat.totalRevenue.toFixed(2)} · {pct.toFixed(1)}%
                    </Text>
                  </View>
                  <View className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <View
                      className="h-2 bg-[#FFCC00] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </View>
                  <Text className="text-gray-500 text-xs mt-1">
                    {cat.serviceCount} services · {cat.totalOrders} orders
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Order Trends */}
        {orderTrends.length > 0 && (
          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
            <Text className="text-white font-bold text-base mb-1">Order Trends</Text>
            <Text className="text-gray-500 text-xs mb-4">
              Daily orders over the last {trendDays} days
            </Text>

            {orderTrends.slice(-10).map((trend) => (
              <View
                key={trend.date}
                className="flex-row items-center justify-between py-2 border-b border-gray-800 last:border-b-0"
              >
                <Text className="text-gray-400 text-sm w-24">
                  {new Date(trend.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text className="text-white text-sm flex-1 text-center">
                  {trend.orderCount} orders
                </Text>
                <Text className="text-green-400 text-sm font-semibold">
                  ${trend.revenue.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {topServices.length === 0 && categoryBreakdown.length === 0 && (
          <View className="items-center py-12">
            <Feather name="bar-chart-2" size={48} color="#374151" />
            <Text className="text-gray-400 text-lg mt-4">No data available</Text>
            <Text className="text-gray-500 text-sm mt-1 text-center px-6">
              Start adding services and completing orders to see analytics
            </Text>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
