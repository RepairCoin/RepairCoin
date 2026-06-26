import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useShopReports } from "../hooks/useSubmitIssueReport";
import {
  ShopReport,
  IssueReportStatus,
  IssueReportCategory,
} from "@/feature/shop/services/shop.interface";

const STATUS_STYLE: Record<
  IssueReportStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: "Pending", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  investigating: {
    label: "Investigating",
    bg: "bg-blue-500/20",
    text: "text-blue-400",
  },
  resolved: { label: "Resolved", bg: "bg-green-500/20", text: "text-green-400" },
  dismissed: { label: "Dismissed", bg: "bg-gray-500/20", text: "text-gray-400" },
};

const CATEGORY_LABEL: Record<IssueReportCategory, string> = {
  spam: "Spam",
  fraud: "Fraud",
  harassment: "Harassment",
  inappropriate_review: "Inappropriate Review",
  other: "Other",
};

function formatDate(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ShopReportsScreen() {
  const { data, isLoading, refetch, isRefetching } = useShopReports();
  const reports = (data ?? []) as ShopReport[];

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="My Reports" />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center mt-24">
              <Ionicons name="document-text-outline" size={44} color="#333" />
              <Text className="text-gray-500 mt-3">No reports submitted</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
            return (
              <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-white font-semibold">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </Text>
                  <View className={`px-2 py-0.5 rounded ${status.bg}`}>
                    <Text className={`text-xs font-semibold ${status.text}`}>
                      {status.label}
                    </Text>
                  </View>
                </View>
                {item.description ? (
                  <Text className="text-gray-400 text-sm" numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-gray-600 text-xs capitalize">
                    Severity: {item.severity}
                    {item.relatedEntityType ? ` · ${item.relatedEntityType}` : ""}
                  </Text>
                  {formatDate(item.createdAt) ? (
                    <Text className="text-gray-600 text-xs">
                      {formatDate(item.createdAt)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
