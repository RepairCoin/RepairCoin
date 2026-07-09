import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NoShowTier } from "@/feature/services/services/service.interface";

const TIER_LABELS: Record<NoShowTier, string> = {
  normal: "Good Standing",
  warning: "Warning",
  caution: "Caution",
  deposit_required: "Deposit Required",
  suspended: "Suspended",
};

const TIER_COLORS: Record<NoShowTier, string> = {
  normal: "#22C55E",
  warning: "#FFCC00",
  caution: "#F97316",
  deposit_required: "#F97316",
  suspended: "#EF4444",
};

type CustomerNoShowRecordProps = {
  noShowCount: number;
  tier: NoShowTier;
  lastNoShowAt?: string;
};

function formatLastNoShow(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CustomerNoShowRecord({
  noShowCount,
  tier,
  lastNoShowAt,
}: CustomerNoShowRecordProps) {
  const tierColor = TIER_COLORS[tier] ?? "#9CA3AF";
  const lastNoShow = formatLastNoShow(lastNoShowAt);

  return (
    <View className="px-4 mb-6">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-bold">No-Show Record</Text>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: tierColor + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: tierColor }}
            >
              {TIER_LABELS[tier] ?? tier}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <View
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: tierColor + "20" }}
          >
            <Ionicons
              name={noShowCount > 0 ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={24}
              color={tierColor}
            />
          </View>

          <View className="flex-1">
            <Text className="text-white text-2xl font-bold">
              {noShowCount}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">
              {noShowCount === 1 ? "missed appointment" : "missed appointments"}
            </Text>
          </View>
        </View>

        {lastNoShow ? (
          <Text className="text-gray-500 text-xs mt-4">
            Last no-show on {lastNoShow}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
