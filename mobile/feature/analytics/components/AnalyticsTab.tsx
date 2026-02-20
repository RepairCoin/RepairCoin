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
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { FilterButton } from "@/shared/components/shared/FilterButton";
import { FilterModal, FilterOption } from "@/shared/components/shared/FilterModal";
import { ChartFilter, TimeRange } from "../types";
import { useAnalyticsDataUI } from "../hooks";

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
  {
    key: "Profit Margin Trend",
    label: "Profit Margin",
    icon: "analytics-outline",
  },
];

const TIME_FILTERS: FilterOption[] = [
  { key: "day", label: "Daily" },
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
  const dataLength = chartData.profitLoss.length || 6;
  const spacing = useMemo(
    () => Math.max(40, (chartWidth - 40) / Math.max(dataLength, 1)),
    [chartWidth, dataLength]
  );

  // Get current chart data based on filter
  const getChartData = () => {
    switch (activeFilter) {
      case "Profit & Loss Over Time":
        // Single line with colored dots (matching web version)
        // Gray line, green dots for profit, red dots for loss
        return {
          data1: chartData.profitLoss,
          data2: null,
          color1: "#6B7280", // Gray line color
          color2: null,
          legend1: "Profit",
          legend2: "Loss",
          legendColor1: "#10B981", // Green for profit legend
          legendColor2: "#EF4444", // Red for loss legend
          isPercentage: false,
          isSingleLineWithColoredDots: true,
        };
      case "Revenue vs Cost":
        return {
          data1: chartData.revenue,
          data2: chartData.cost,
          color1: "#3B82F6", // Blue for revenue
          color2: "#F59E0B", // Orange for costs
          legend1: "Revenue",
          legend2: "Cost",
          legendColor1: "#3B82F6",
          legendColor2: "#F59E0B",
          isPercentage: false,
          isSingleLineWithColoredDots: false,
        };
      case "Profit Margin Trend":
        return {
          data1: chartData.profitMargin,
          data2: null,
          color1: "#8B5CF6", // Purple for margin
          color2: null,
          legend1: "Profit Margin",
          legend2: null,
          legendColor1: "#8B5CF6",
          legendColor2: null,
          isPercentage: true,
          isSingleLineWithColoredDots: false,
        };
      default:
        return {
          data1: chartData.profitLoss,
          data2: null,
          color1: "#6B7280",
          color2: null,
          legend1: "Profit",
          legend2: "Loss",
          legendColor1: "#10B981",
          legendColor2: "#EF4444",
          isPercentage: false,
          isSingleLineWithColoredDots: true,
        };
    }
  };

  const currentChartConfig = getChartData();

  // Check if all values are the same (e.g., all 0s) - use straight line instead of curve
  const firstValue = currentChartConfig.data1[0]?.value ?? 0;
  const allValuesSame = currentChartConfig.data1.every(
    (d: { value: number }) => d.value === firstValue
  );

  // Check if we have data (for profitLoss, check if any value is non-zero)
  const hasData =
    currentChartConfig.data1.length > 0 &&
    currentChartConfig.data1.some((d: { value: number }) => d.value !== 0);

  // Get current filter labels
  const currentChartLabel =
    CHART_FILTERS.find((f) => f.key === activeFilter)?.label || "Profit & Loss";
  const currentTimeLabel =
    TIME_FILTERS.find((f) => f.key === timeRange)?.label || "Monthly";

  // Get profit trend icon
  const getProfitTrendIcon = () => {
    if (!metrics) return null;

    switch (metrics.profitTrend) {
      case "up":
        return <Feather name="trending-up" size={20} color="#10B981" />;
      case "down":
        return <Feather name="trending-down" size={20} color="#EF4444" />;
      default:
        return <Feather name="minus" size={20} color="#6B7280" />;
    }
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading analytics...</Text>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
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
    <ThemedView className="flex-1 mt-6">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Metrics Cards */}
        {metrics && (
          <View className="flex-row flex-wrap">
            <View className="w-1/2 pr-2 mb-3">
              <View className="bg-[#1a1a1a] rounded-xl p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs mb-1">Total Profit</Text>
                    <Text
                      className={`text-lg font-bold ${
                        metrics.totalProfit >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      ${metrics.totalProfit.toFixed(2)}
                    </Text>
                  </View>
                  {getProfitTrendIcon()}
                </View>
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
              {currentChartConfig.isSingleLineWithColoredDots ? (
                // Profit & Loss - Single line with colored dots (matching web)
                <LineChart
                  data={currentChartConfig.data1}
                  width={chartWidth}
                  height={200}
                  color={currentChartConfig.color1}
                  thickness={2}
                  dataPointsRadius={6}
                  xAxisColor="#374151"
                  yAxisColor="#374151"
                  xAxisLabelTextStyle={{
                    color: "#9CA3AF",
                    fontSize: 11,
                  }}
                  xAxisLabelsVerticalShift={100}
                  yAxisTextStyle={{
                    color: "#9CA3AF",
                    fontSize: 11,
                  }}
                  noOfSections={4}
                  rulesColor="#374151"
                  rulesType="solid"
                  curved={!allValuesSame}
                  isAnimated
                  animationDuration={800}
                  spacing={spacing}
                  initialSpacing={20}
                  endSpacing={20}
                  hideDataPoints={false}
                  showVerticalLines
                  verticalLinesColor="#374151"
                  yAxisTextNumberOfLines={1}
                  showReferenceLine1
                  referenceLine1Position={0}
                  referenceLine1Config={{
                    color: "#6B7280",
                    dashWidth: 5,
                    dashGap: 5,
                  }}
                  formatYLabel={(val) => `$${parseFloat(val).toFixed(0)}`}
                  pointerConfig={{
                    pointerStripHeight: 160,
                    pointerStripColor: "#6B7280",
                    pointerStripWidth: 2,
                    pointerColor: "#6B7280",
                    radius: 6,
                    pointerLabelWidth: 100,
                    pointerLabelHeight: 50,
                    activatePointersOnLongPress: true,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: { value: number }[]) => {
                      const value = items[0]?.value || 0;
                      const color = value >= 0 ? "#10B981" : "#EF4444";
                      return (
                        <View className="bg-black px-3 py-2 rounded-lg">
                          <Text className="font-bold text-sm" style={{ color }}>
                            ${value.toFixed(2)}
                          </Text>
                        </View>
                      );
                    },
                  }}
                />
              ) : currentChartConfig.data2 ? (
                // Revenue vs Cost - Two lines with area fill
                <LineChart
                  data={currentChartConfig.data1}
                  data2={currentChartConfig.data2}
                  width={chartWidth}
                  height={200}
                  color={currentChartConfig.color1}
                  color2={currentChartConfig.color2!}
                  thickness={2}
                  dataPointsColor={currentChartConfig.color1}
                  dataPointsColor2={currentChartConfig.color2!}
                  dataPointsRadius={5}
                  areaChart
                  startFillColor={`${currentChartConfig.color1}4D`}
                  startFillColor2={`${currentChartConfig.color2}4D`}
                  endFillColor={`${currentChartConfig.color1}03`}
                  endFillColor2={`${currentChartConfig.color2}03`}
                  startOpacity={0.9}
                  endOpacity={0.1}
                  xAxisColor="#374151"
                  yAxisColor="#374151"
                  xAxisLabelTextStyle={{
                    color: "#9CA3AF",
                    fontSize: 11,
                  }}
                  xAxisLabelsVerticalShift={10}
                  yAxisTextStyle={{
                    color: "#9CA3AF",
                    fontSize: 11,
                  }}
                  noOfSections={4}
                  rulesColor="#374151"
                  rulesType="solid"
                  curved={!allValuesSame}
                  isAnimated
                  animationDuration={800}
                  spacing={spacing}
                  initialSpacing={20}
                  endSpacing={20}
                  hideDataPoints={false}
                  showVerticalLines
                  verticalLinesColor="#374151"
                  yAxisTextNumberOfLines={1}
                  formatYLabel={(val) => `$${parseFloat(val).toFixed(0)}`}
                  pointerConfig={{
                    pointerStripHeight: 160,
                    pointerStripColor: currentChartConfig.color1,
                    pointerStripWidth: 2,
                    pointerColor: currentChartConfig.color1,
                    radius: 6,
                    pointerLabelWidth: 100,
                    pointerLabelHeight: 50,
                    activatePointersOnLongPress: true,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: { value: number }[]) => (
                      <View className="bg-black px-3 py-2 rounded-lg">
                        <Text
                          className="font-bold text-sm"
                          style={{ color: currentChartConfig.color1 }}
                        >
                          ${items[0]?.value?.toFixed(2) || "0.00"}
                        </Text>
                      </View>
                    ),
                  }}
                />
              ) : (
                // Profit Margin - Single line with area fill
                <LineChart
                  data={currentChartConfig.data1}
                  width={chartWidth}
                  height={200}
                  color={currentChartConfig.color1}
                  thickness={2}
                  dataPointsColor={currentChartConfig.color1}
                  dataPointsRadius={5}
                  areaChart
                  startFillColor={`${currentChartConfig.color1}4D`}
                  endFillColor={`${currentChartConfig.color1}03`}
                  startOpacity={0.9}
                  endOpacity={0.1}
                  xAxisColor="#374151"
                  yAxisColor="#374151"
                  xAxisLabelTextStyle={{
                    color: "#9CA3AF",
                    fontSize: 11,
                  }}
                  xAxisLabelsVerticalShift={10}
                  yAxisTextStyle={{
                    color: "#9CA3AF",
                    fontSize: 11,
                  }}
                  noOfSections={4}
                  rulesColor="#374151"
                  rulesType="solid"
                  curved={!allValuesSame}
                  isAnimated
                  animationDuration={800}
                  spacing={spacing}
                  initialSpacing={20}
                  endSpacing={20}
                  hideDataPoints={false}
                  showVerticalLines
                  verticalLinesColor="#374151"
                  yAxisTextNumberOfLines={1}
                  formatYLabel={(val) => `${parseFloat(val).toFixed(0)}%`}
                  pointerConfig={{
                    pointerStripHeight: 160,
                    pointerStripColor: currentChartConfig.color1,
                    pointerStripWidth: 2,
                    pointerColor: currentChartConfig.color1,
                    radius: 6,
                    pointerLabelWidth: 100,
                    pointerLabelHeight: 50,
                    activatePointersOnLongPress: true,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: { value: number }[]) => (
                      <View className="bg-black px-3 py-2 rounded-lg">
                        <Text
                          className="font-bold text-sm"
                          style={{ color: currentChartConfig.color1 }}
                        >
                          {items[0]?.value?.toFixed(1) || "0"}%
                        </Text>
                      </View>
                    ),
                  }}
                />
              )}

              {/* Legend */}
              <View className="flex-row items-center mt-4 gap-4">
                <View className="flex-row items-center">
                  <View
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: currentChartConfig.legendColor1 }}
                  />
                  <Text className="text-gray-400 text-sm">
                    {currentChartConfig.legend1}
                  </Text>
                </View>
                {currentChartConfig.legend2 && (
                  <View className="flex-row items-center">
                    <View
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: currentChartConfig.legendColor2 || "#EF4444" }}
                    />
                    <Text className="text-gray-400 text-sm">
                      {currentChartConfig.legend2}
                    </Text>
                  </View>
                )}
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
