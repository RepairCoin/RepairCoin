import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBox } from "@/shared/components/ui/Skeleton";
import { useGroupAnalytics } from "../../hooks";

interface AnalyticsTabProps {
  groupId: string;
}

export function AnalyticsTab({ groupId }: AnalyticsTabProps) {
  const { data: analytics, isLoading } = useGroupAnalytics(groupId);

  if (isLoading) {
    return (
      <View className="p-4">
        <SkeletonBox width="40%" height={16} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <SkeletonBox width="100%" height={100} borderRadius={12} />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <SkeletonBox width="100%" height={100} borderRadius={12} />
          </View>
        </View>
        <View style={{ flexDirection: "row", marginBottom: 24 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <SkeletonBox width="100%" height={100} borderRadius={12} />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <SkeletonBox width="100%" height={100} borderRadius={12} />
          </View>
        </View>
        <SkeletonBox width="40%" height={16} borderRadius={4} style={{ marginBottom: 12 }} />
        <SkeletonBox width="100%" height={120} borderRadius={12} />
      </View>
    );
  }

  if (!analytics) {
    return (
      <View className="items-center py-10">
        <Ionicons name="analytics-outline" size={48} color="#333" />
        <Text className="text-gray-500 mt-4 text-center">
          Analytics not available
        </Text>
      </View>
    );
  }

  return (
    <View className="p-4">
      {/* Token Stats */}
      <Text className="text-gray-400 text-sm mb-3">Token Statistics</Text>
      <View className="flex-row mb-4">
        <StatCard
          label="Circulating"
          value={analytics.totalTokensCirculating}
          color="purple"
          icon="sync-circle"
        />
        <View className="w-3" />
        <StatCard
          label="Total Issued"
          value={analytics.totalTokensIssued}
          color="green"
          icon="arrow-up-circle"
        />
      </View>
      <View className="flex-row mb-6">
        <StatCard
          label="Total Redeemed"
          value={analytics.totalTokensRedeemed}
          color="orange"
          icon="arrow-down-circle"
        />
        <View className="w-3" />
        <StatCard
          label="Avg Transaction"
          value={analytics.averageTransactionSize.toFixed(1)}
          color="blue"
          icon="calculator"
        />
      </View>

      {/* Activity Stats */}
      <Text className="text-gray-400 text-sm mb-3">Activity</Text>
      <View className="flex-row mb-4">
        <StatCard
          label="Active Members"
          value={analytics.activeMembers}
          color="yellow"
          icon="people"
        />
        <View className="w-3" />
        <StatCard
          label="Unique Customers"
          value={analytics.uniqueCustomers}
          color="cyan"
          icon="person"
        />
      </View>
      <View className="flex-row mb-6">
        <StatCard
          label="Total Transactions"
          value={analytics.totalTransactions}
          color="gray"
          icon="receipt"
        />
        <View className="w-3" />
        <View className="flex-1" />
      </View>

      {/* 30-Day Stats */}
      <Text className="text-gray-400 text-sm mb-3">Last 30 Days</Text>
      <View className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-green-500/20 items-center justify-center mr-3">
              <Ionicons name="trending-up" size={16} color="#22c55e" />
            </View>
            <Text className="text-gray-400">Tokens Issued</Text>
          </View>
          <Text className="text-green-500 font-bold text-lg">
            +{analytics.tokensIssuedLast30Days}
          </Text>
        </View>
        <View className="flex-row items-center justify-between pt-3">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-orange-500/20 items-center justify-center mr-3">
              <Ionicons name="trending-down" size={16} color="#f97316" />
            </View>
            <Text className="text-gray-400">Tokens Redeemed</Text>
          </View>
          <Text className="text-orange-500 font-bold text-lg">
            -{analytics.tokensRedeemedLast30Days}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  color: "purple" | "green" | "orange" | "blue" | "yellow" | "cyan" | "gray";
  icon: keyof typeof Ionicons.glyphMap;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  const colorMap = {
    purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
    green: { bg: "bg-green-500/20", text: "text-green-400" },
    orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
    blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
    yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
    cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
    gray: { bg: "bg-gray-500/20", text: "text-gray-400" },
  };

  const iconColorMap = {
    purple: "#a855f7",
    green: "#22c55e",
    orange: "#f97316",
    blue: "#3b82f6",
    yellow: "#eab308",
    cyan: "#06b6d4",
    gray: "#6b7280",
  };

  return (
    <View className="flex-1 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <View
        className={`w-10 h-10 rounded-full ${colorMap[color].bg} items-center justify-center mb-3`}
      >
        <Ionicons name={icon} size={20} color={iconColorMap[color]} />
      </View>
      <Text className={`text-2xl font-bold ${colorMap[color].text}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
      <Text className="text-gray-500 text-sm mt-1">{label}</Text>
    </View>
  );
}
