import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { ThemedView } from "@/components/ui/ThemedView";

interface ChartDataPoint {
  value: number;
  label?: string;
  dataPointText?: string;
}

type ChartFilter = "Profit & Loss Over Time" | "Revenue vs Cost";

export default function AnalyticsTab() {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 64;
  const [activeFilter, setActiveFilter] = useState<ChartFilter>("Profit & Loss Over Time");

  const filters: ChartFilter[] = ["Profit & Loss Over Time", "Revenue vs Cost"];

  // Sample data - replace with real data from API
  // Profit & Loss Over Time data
  const profitData: ChartDataPoint[] = useMemo(
    () => [
      { value: 1200, label: "Jan" },
      { value: 300, label: "Feb" },
      { value: 1400, label: "Mar" },
      { value: 2200, label: "Apr" },
      { value: 1900, label: "May" },
      { value: 2800, label: "Jun" },
    ],
    []
  );

  const lossData: ChartDataPoint[] = useMemo(
    () => [
      { value: 800, label: "Jan" },
      { value: 200, label: "Feb" },
      { value: 950, label: "Mar" },
      { value: 0, label: "Apr" },
      { value: 0, label: "May" },
      { value: 0, label: "Jun" },
    ],
    []
  );

  // Revenue vs Cost data
  const revenueData: ChartDataPoint[] = useMemo(
    () => [
      { value: 2000, label: "Jan" },
      { value: 500, label: "Feb" },
      { value: 2350, label: "Mar" },
      { value: 2200, label: "Apr" },
      { value: 1900, label: "May" },
      { value: 2800, label: "Jun" },
    ],
    []
  );

  const costData: ChartDataPoint[] = useMemo(
    () => [
      { value: 800, label: "Jan" },
      { value: 200, label: "Feb" },
      { value: 950, label: "Mar" },
      { value: 0, label: "Apr" },
      { value: 0, label: "May" },
      { value: 0, label: "Jun" },
    ],
    []
  );

  // Calculate spacing based on screen width
  const spacing = useMemo(() => Math.max(40, (chartWidth - 40) / 6), [chartWidth]);

  return (
    <ThemedView className="w-full h-full">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View className="h-52 my-4">
          <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
            <View
              className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
              style={{
                right: -80,
                top: -20,
              }}
            />
            <Image
              source={require("@/assets/images/customer_approval_card.png")}
              className="w-98 h-98 bottom-0 right-0 absolute"
              resizeMode="contain"
            />
            <View className="pl-4 mt-10 w-[60%]">
              <Text className="text-black font-bold text-2xl">
                Profit Analytics
              </Text>
              <Text className="text-black/60 text-base">
                Your profit summary
              </Text>
              <Pressable className="bg-black w-40 rounded-xl py-2 mt-4 justify-center items-center">
                <Text className="text-[#FFCC00] font-bold text-sm">
                  View Analytics
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Chart Section */}
        <View className="bg-[#1a1a1a] rounded-2xl p-4 mb-4">
          {/* Filter Tabs */}
          <View className="flex-row bg-[#2a2a2a] rounded-lg p-1 mb-6">
            {filters.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                className={`flex-1 py-2 px-3 rounded-md ${
                  activeFilter === filter ? "bg-[#FFCC00]" : ""
                }`}
              >
                <Text
                  className={`text-center text-xs font-medium ${
                    activeFilter === filter ? "text-black" : "text-gray-400"
                  }`}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-white font-bold text-lg mb-4">
            {activeFilter}
          </Text>

          <LineChart
            data={activeFilter === "Profit & Loss Over Time" ? profitData : revenueData}
            data2={activeFilter === "Profit & Loss Over Time" ? lossData : costData}
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
                    ${items[0]?.value}
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
                {activeFilter === "Profit & Loss Over Time" ? "Profit" : "Revenue"}
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-[#EF4444] rounded-full mr-2" />
              <Text className="text-gray-400 text-sm">
                {activeFilter === "Profit & Loss Over Time" ? "Loss" : "Cost"}
              </Text>
            </View>
          </View>
        </View>

        {/* Redemption Chart */}
        {/* <View className="bg-[#1F2937] rounded-2xl p-4 mb-4">
          <Text className="text-white font-bold text-lg mb-2">
            Token Redemptions
          </Text>
          <Text className="text-gray-400 text-sm mb-4">
            Monthly RCN tokens redeemed
          </Text>

          <LineChart
            data={lossData}
            width={chartWidth}
            height={200}
            color="#10B981"
            thickness={3}
            dataPointsColor="#10B981"
            dataPointsRadius={5}
            areaChart
            startFillColor="rgba(16, 185, 129, 0.3)"
            endFillColor="rgba(16, 185, 129, 0.01)"
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
            pointerConfig={{
              pointerStripHeight: 160,
              pointerStripColor: "#10B981",
              pointerStripWidth: 2,
              pointerColor: "#10B981",
              radius: 6,
              pointerLabelWidth: 100,
              pointerLabelHeight: 50,
              activatePointersOnLongPress: true,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items: { value: number }[]) => (
                <View className="bg-black px-3 py-2 rounded-lg">
                  <Text className="text-[#10B981] font-bold text-sm">
                    {items[0]?.value} RCN
                  </Text>
                </View>
              ),
            }}
          />

          <View className="flex-row items-center mt-4">
            <View className="w-3 h-3 bg-[#10B981] rounded-full mr-2" />
            <Text className="text-gray-400 text-sm">Redemptions (RCN)</Text>
          </View>
        </View> */}
      </ScrollView>
    </ThemedView>
  );
}
