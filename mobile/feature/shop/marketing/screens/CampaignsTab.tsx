import { useMemo, useState } from "react";
import { View, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { FilterButton } from "@/shared/components/shared/FilterButton";
import { FilterModal } from "@/shared/components/shared/FilterModal";
import { SkeletonList } from "@/shared/components/ui/Skeleton";
import StatsRow from "@/shared/components/ui/StatsRow";
import { CampaignCard, MarketingEmptyState } from "../components";
import { useCampaignsInfiniteQuery, useCampaignStatsQuery } from "../hooks";
import { CampaignStatus, MarketingCampaign } from "../services/marketing.interface";

const STATUS_FILTER_OPTIONS = [
  { key: "all", label: "All statuses", icon: "albums-outline" as const },
  { key: "draft", label: "Draft", icon: "document-outline" as const },
  { key: "scheduled", label: "Scheduled", icon: "time-outline" as const },
  { key: "sent", label: "Sent", icon: "checkmark-circle-outline" as const },
  { key: "cancelled", label: "Cancelled", icon: "close-circle-outline" as const },
];

export function CampaignsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const status = statusFilter === "all" ? undefined : (statusFilter as CampaignStatus);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useCampaignsInfiniteQuery(status);
  const { data: stats, isLoading: isStatsLoading } = useCampaignStatsQuery();

  const campaigns = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = ({ item }: { item: MarketingCampaign }) => (
    <CampaignCard campaign={item} onPress={() => router.push(`/shop/marketing/campaign/${item.id}` as never)} />
  );

  return (
    <View className="flex-1 px-4">
      {!isStatsLoading && stats && (
        <StatsRow
          items={[
            { value: stats.totalCampaigns, label: "Total" },
            { value: stats.draftCampaigns, label: "Drafts" },
            { value: stats.sentCampaigns, label: "Sent" },
            { value: `${Math.round(stats.avgOpenRate || 0)}%`, label: "Open rate" },
          ]}
          className="flex-row bg-zinc-900 rounded-2xl p-4 mb-4"
        />
      )}

      <View className="flex-row mb-4">
        <FilterButton
          icon="filter-outline"
          label={STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "All statuses"}
          onPress={() => setShowStatusModal(true)}
        />
      </View>

      <FilterModal
        title="Status"
        icon="filter-outline"
        options={STATUS_FILTER_OPTIONS}
        selectedKey={statusFilter}
        onSelect={setStatusFilter}
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
      />

      {isLoading ? (
        <SkeletonList variant="list" count={4} />
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: campaigns.length === 0 ? 1 : undefined }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" colors={["#FFCC00"]} />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#FFCC00" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <MarketingEmptyState
              icon="megaphone-outline"
              title="No campaigns yet"
              description="Create your first campaign to reach your customers by email or in-app notification."
              actionLabel="Create campaign"
              onAction={() => router.push("/shop/marketing/campaign-composer" as never)}
            />
          }
        />
      )}
    </View>
  );
}
