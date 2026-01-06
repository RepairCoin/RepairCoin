import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Feather } from "@expo/vector-icons";
import { ThemedView } from "@/components/ui/ThemedView";
import { FilterButton } from "@/components/shared/FilterButton";
import { FilterModal, FilterOption } from "@/components/shared/FilterModal";
import { ChartDataPoint, ChartFilter, TimeRange } from "../../../types";
import { useAnalyticsDataUI } from "../../../hooks";

// Filter options
const CHART_FILTERS: FilterOption[] = [
  {
    key: "Profit & Loss Over Time",
    label: "Profit & Loss",
    icon: "trending-up",
  },
  {
    key: "Revenue vs Cost",
    label: "Revenue vs Cost",
    icon: "bar-chart-outline",
  },
];

const TIME_FILTERS: FilterOption[] = [
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

export default function AnalyticsTab() {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 64;
  const [activeFilter, setActiveFilter] = useState<ChartFilter>(
    "Profit & Loss Over Time"
  );
  const [showChartFilter, setShowChartFilter] = useState(false);
  const [showTimeFilter, setShowTimeFilter] = useState(false);

  // Analytics data with time range
  const { chartData, metrics, isLoading, error, refetch, timeRange, setTimeRange } =
    useAnalyticsDataUI();
  // Calculate spacing based on screen width and data points
  const dataLength = chartData.profit.length || 6;
  const spacing = useMemo(
    () => Math.max(40, (chartWidth - 40) / Math.max(dataLength, 1)),
    [chartWidth, dataLength]
  );

  // Get current chart data based on filter
  const currentData1 =
    activeFilter === "Profit & Loss Over Time"
      ? chartData.profit
      : chartData.revenue;
  const currentData2 =
    activeFilter === "Profit & Loss Over Time"
      ? chartData.loss
      : chartData.cost;

  // Check if we have data
  const hasData =
    currentData1.length > 0 && currentData1.some((d: ChartDataPoint) => d.value > 0);

  // Get current filter labels
  const currentChartLabel =
    CHART_FILTERS.find((f) => f.key === activeFilter)?.label || "Profit & Loss";
  const currentTimeLabel =
    TIME_FILTERS.find((f) => f.key === timeRange)?.label || "Monthly";

  if (isLoading) {
    return (
      <ThemedView className="w-full h-full items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading analytics...</Text>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView className="w-full h-full items-center justify-center px-6">
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-white text-lg font-semibold mt-4">
          Failed to load analytics
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          {error instanceof Error ? error.message : "An error occurred"}
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

  return (
    <ThemedView className="w-full h-full">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Metrics Cards */}
        {metrics && (
          <View className="flex-row flex-wrap my-6">
            <View className="w-1/2 pr-2 mb-3">
              <View className="bg-[#1a1a1a] rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">Total Profit</Text>
                <Text
                  className={`text-lg font-bold ${
                    metrics.totalProfit >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  ${metrics.totalProfit.toFixed(2)}
                </Text>
              </View>
            </View>
            <View className="w-1/2 pl-2 mb-3">
              <View className="bg-[#1a1a1a] rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">Revenue</Text>
                <Text className="text-lg font-bold text-blue-400">
                  ${metrics.totalRevenue.toFixed(2)}
                </Text>
              </View>
            </View>
            <View className="w-1/2 pr-2">
              <View className="bg-[#1a1a1a] rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">Costs</Text>
                <Text className="text-lg font-bold text-orange-400">
                  ${metrics.totalCosts.toFixed(2)}
                </Text>
              </View>
            </View>
            <View className="w-1/2 pl-2">
              <View className="bg-[#1a1a1a] rounded-xl p-4">
                <Text className="text-gray-400 text-xs mb-1">
                  Profit Margin
                </Text>
                <Text
                  className={`text-lg font-bold ${
                    metrics.averageProfitMargin >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {metrics.averageProfitMargin.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Filter Buttons */}
        <View className="flex-row gap-3 my-4">
          <FilterButton
            icon="analytics-outline"
            label={currentChartLabel}
            onPress={() => setShowChartFilter(true)}
          />
          <FilterButton
            icon="calendar-outline"
            label={currentTimeLabel}
            onPress={() => setShowTimeFilter(true)}
          />
        </View>

        {/* Chart Section */}
        <View className="bg-[#1a1a1a] rounded-2xl p-4 mb-4">
          {/* Chart Title */}
          <Text className="text-white font-bold text-base mb-4">
            {activeFilter}
          </Text>

          {hasData ? (
            <>
              <LineChart
                data={currentData1}
                data2={currentData2}
                width={chartWidth}
                height={200}
                color="#FFCC00"
                color2="#EF4444"
                thickness={3}
                dataPointsColor="#FFCC00"
                dataPointsColor2="#EF4444"
                dataPointsRadius={5}
                areaChart
                startFillColor="rgba(255, 204, 0, 0.3)"
                startFillColor2="rgba(239, 68, 68, 0.3)"
                endFillColor="rgba(255, 204, 0, 0.01)"
                endFillColor2="rgba(239, 68, 68, 0.01)"
                startOpacity={0.9}
                endOpacity={0.1}
                xAxisColor="#374151"
                yAxisColor="#374151"
                xAxisLabelTextStyle={{
                  color: "#9CA3AF",
                  fontSize: 11,
                }}
                yAxisTextStyle={{
                  color: "#9CA3AF",
                  fontSize: 11,
                }}
                noOfSections={4}
                rulesColor="#374151"
                rulesType="solid"
                curved
                isAnimated
                animationDuration={800}
                spacing={spacing}
                initialSpacing={20}
                endSpacing={20}
                hideDataPoints={false}
                showVerticalLines
                verticalLinesColor="#374151"
                pointerConfig={{
                  pointerStripHeight: 160,
                  pointerStripColor: "#FFCC00",
                  pointerStripWidth: 2,
                  pointerColor: "#FFCC00",
                  radius: 6,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 50,
                  activatePointersOnLongPress: true,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: { value: number }[]) => (
                    <View className="bg-black px-3 py-2 rounded-lg">
                      <Text className="text-[#FFCC00] font-bold text-sm">
                        ${items[0]?.value?.toFixed(2) || "0.00"}
                      </Text>
                    </View>
                  ),
                }}
              />

              {/* Legend */}
              <View className="flex-row items-center mt-4 gap-4">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-[#FFCC00] rounded-full mr-2" />
                  <Text className="text-gray-400 text-sm">
                    {activeFilter === "Profit & Loss Over Time"
                      ? "Profit"
                      : "Revenue"}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-[#EF4444] rounded-full mr-2" />
                  <Text className="text-gray-400 text-sm">
                    {activeFilter === "Profit & Loss Over Time"
                      ? "Loss"
                      : "Cost"}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View className="h-[200px] items-center justify-center">
              <Feather name="bar-chart-2" size={48} color="#374151" />
              <Text className="text-gray-400 text-lg mt-4">
                No data available
              </Text>
              <Text className="text-gray-500 text-sm mt-1 text-center">
                Start issuing rewards to see your profit analysis
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      {/* Filter Modals */}
      <FilterModal
        title="Chart Type"
        icon="analytics-outline"
        options={CHART_FILTERS}
        selectedKey={activeFilter}
        onSelect={(key) => setActiveFilter(key as ChartFilter)}
        visible={showChartFilter}
        onClose={() => setShowChartFilter(false)}
      />

      <FilterModal
        title="Time Period"
        icon="calendar-outline"
        options={TIME_FILTERS}
        selectedKey={timeRange}
        onSelect={(key) => setTimeRange(key as TimeRange)}
        visible={showTimeFilter}
        onClose={() => setShowTimeFilter(false)}
      />
    </ThemedView>
  );
}
