import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import CalloutCard from "@/shared/components/ui/CalloutCard";
import { formatDate } from "@/shared/utilities/format";
import { CampaignStatusBadge, CampaignStatsGrid, ScheduleSheet } from "../components";
import {
  useCampaignQuery,
  useSendCampaignMutation,
  useScheduleCampaignMutation,
  useCancelCampaignMutation,
  useDeleteCampaignMutation,
  useAudienceCountQuery,
  useMarketingTemplatesQuery,
} from "../hooks";
import { toEditableFields, DesignContent } from "../utils/designContent";
import {
  AUDIENCE_OPTIONS,
  DELIVERY_METHOD_OPTIONS,
  CAMPAIGN_TYPE_LABELS,
  SEND_NOW_MAX_RECIPIENTS,
} from "../constants/marketingConstants";

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row justify-between py-2.5 ${last ? "" : "border-b border-[#222]"}`}>
      <Text className="text-gray-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium flex-1 text-right ml-4" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function CampaignDetailScreen() {
  const { campaignId, poll } = useLocalSearchParams<{ campaignId: string; poll?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  // Set by handleSend/ScheduleSheet below so polling also engages when the shop triggers a
  // send from this screen directly, not just when arriving here via ?poll=1 from the composer.
  const [activePoll, setActivePoll] = useState(false);

  const {
    data: campaign,
    isLoading,
    isError,
    refetch,
  } = useCampaignQuery(campaignId, { pollWhileSending: poll === "1" || activePoll });
  const { data: templates } = useMarketingTemplatesQuery();
  const sendMutation = useSendCampaignMutation();
  const scheduleMutation = useScheduleCampaignMutation();
  const cancelMutation = useCancelCampaignMutation();
  const deleteMutation = useDeleteCampaignMutation();

  const isSelectCustomers = campaign?.audienceType === "select_customers";
  const selectedCount = Array.isArray(campaign?.audienceFilters?.selectedAddresses)
    ? campaign!.audienceFilters.selectedAddresses.length
    : 0;
  const audienceCountQuery = useAudienceCountQuery(
    campaign?.audienceType ?? "all_customers",
    campaign?.audienceFilters,
    campaign?.deliveryMethod,
    !!campaign && campaign.status === "draft" && !isSelectCustomers
  );
  const recipientCount = isSelectCustomers ? selectedCount : audienceCountQuery.data ?? 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Campaign" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFCC00" />
        </View>
      </View>
    );
  }

  if (isError || !campaign) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Campaign" />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text className="text-white text-base mt-3 text-center">{"Couldn't load this campaign."}</Text>
          <TouchableOpacity onPress={() => refetch()} className="mt-4 bg-[#FFCC00] rounded-xl px-6 py-3">
            <Text className="text-black font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const status = campaign.displayStatus ?? campaign.status;
  const hasReward = campaign.rewardType !== "none";
  const templateName = campaign.templateId
    ? templates?.find((t) => t.id === campaign.templateId)?.name ?? "Template"
    : "Blank";

  function goToEdit() {
    if (campaign!.status === "scheduled") {
      Alert.alert(
        "Cancel schedule to edit",
        "You need to cancel the scheduled send before editing this campaign.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Cancel schedule & edit",
            onPress: () =>
              cancelMutation.mutate(campaign!.id, {
                onSuccess: () =>
                  router.push(`/shop/marketing/campaign-composer?campaignId=${campaign!.id}` as never),
              }),
          },
        ]
      );
      return;
    }
    router.push(`/shop/marketing/campaign-composer?campaignId=${campaign!.id}` as never);
  }

  function handleDelete() {
    Alert.alert("Delete campaign", `Delete "${campaign!.name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(campaign!.id, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleSend() {
    setActivePoll(true);
    if (recipientCount > SEND_NOW_MAX_RECIPIENTS) {
      scheduleMutation.mutate({
        campaignId: campaign!.id,
        scheduledAt: new Date(Date.now() + 60 * 1000).toISOString(),
      });
    } else {
      sendMutation.mutate(campaign!.id);
    }
  }

  function handleCancelSchedule() {
    Alert.alert("Cancel schedule", "Cancel the scheduled send? The campaign goes back to draft.", [
      { text: "Not now", style: "cancel" },
      { text: "Cancel schedule", style: "destructive", onPress: () => cancelMutation.mutate(campaign!.id) },
    ]);
  }

  const detailRows = [
    { label: "Audience", value: AUDIENCE_OPTIONS.find((o) => o.value === campaign.audienceType)?.label ?? campaign.audienceType },
    {
      label: "Delivery",
      value: DELIVERY_METHOD_OPTIONS.find((o) => o.value === campaign.deliveryMethod)?.label ?? campaign.deliveryMethod,
    },
    ...(campaign.subject ? [{ label: "Subject", value: campaign.subject }] : []),
    { label: "Template", value: templateName },
    { label: "Created", value: formatDate(campaign.createdAt) },
  ];

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title={campaign.name} />
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" colors={["#FFCC00"]} />
        }
      >
        <View className="flex-row items-center justify-between mb-4">
          <CampaignStatusBadge status={status} />
          <Text className="text-gray-400 text-xs">{CAMPAIGN_TYPE_LABELS[campaign.campaignType]}</Text>
        </View>

        {status === "sent" && (
          <View className="mb-4">
            <CampaignStatsGrid campaign={campaign} />
          </View>
        )}

        {status === "scheduled" && campaign.scheduledAt && (
          <CalloutCard
            tone="info"
            icon="time-outline"
            title="Scheduled to send"
            description={`This campaign will send on ${new Date(campaign.scheduledAt).toLocaleString()}.`}
            className="mb-4"
          />
        )}

        <View className="bg-[#1A1A1A] rounded-2xl border border-[#222] p-4 mb-4">
          {detailRows.map((row, index) => (
            <DetailRow key={row.label} label={row.label} value={row.value} last={index === detailRows.length - 1} />
          ))}
        </View>

        {hasReward && (
          <CalloutCard
            tone="warning"
            icon="gift-outline"
            title="Reward configured"
            description="This campaign issues a reward and can only be sent or scheduled from the web dashboard."
            className="mb-4"
          />
        )}

        <Text className="text-white text-base font-semibold mb-2">Content preview</Text>
        <View className="bg-[#1A1A1A] rounded-2xl border border-[#222] p-4 mb-6">
          {toEditableFields(campaign.designContent as DesignContent).map((field) => (
            <View key={field.index} className="mb-3 last:mb-0">
              <Text className="text-gray-500 text-xs mb-1 uppercase">{field.type}</Text>
              <Text className="text-gray-200 text-sm">{field.value}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3">
          {status === "draft" && !hasReward && (
            <>
              <PrimaryButton
                title={recipientCount > SEND_NOW_MAX_RECIPIENTS ? "Send (starts within a minute)" : "Send now"}
                onPress={handleSend}
                loading={sendMutation.isPending || scheduleMutation.isPending}
              />
              <TouchableOpacity
                onPress={() => setShowScheduleSheet(true)}
                className="border border-[#FFCC00] rounded-2xl py-4 items-center"
              >
                <Text className="text-[#FFCC00] font-bold">Schedule for later</Text>
              </TouchableOpacity>
            </>
          )}

          {status === "scheduled" && (
            <TouchableOpacity
              onPress={handleCancelSchedule}
              className="border border-red-500 rounded-2xl py-4 items-center"
            >
              <Text className="text-red-400 font-bold">Cancel schedule</Text>
            </TouchableOpacity>
          )}

          {status !== "sent" && (
            <TouchableOpacity onPress={goToEdit} className="bg-zinc-800 rounded-2xl py-4 items-center">
              <Text className="text-white font-semibold">Edit campaign</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleDelete} className="items-center py-3">
            <Text className="text-red-400 font-semibold">Delete campaign</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ScheduleSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
        value={null}
        onChange={(date) => {
          if (date) scheduleMutation.mutate({ campaignId: campaign.id, scheduledAt: date.toISOString() });
        }}
      />
    </View>
  );
}
