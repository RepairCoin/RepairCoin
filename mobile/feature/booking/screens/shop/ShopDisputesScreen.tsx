import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/shared/hooks";
import { disputeApi, DisputeEntry } from "../services/dispute.services";

type DisputeFilter = "pending" | "approved" | "rejected" | "all";

const FILTERS: { label: string; value: DisputeFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

export default function ShopDisputesScreen() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";
  const [filter, setFilter] = useState<DisputeFilter>("pending");
  const [actionModal, setActionModal] = useState<{
    disputeId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const { showSuccess, showError } = useAppToast();
  const queryClient = useQueryClient();

  const {
    data: disputeData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["shopDisputes", shopId, filter],
    queryFn: () => disputeApi.getShopDisputes(shopId, filter),
    enabled: !!shopId,
    staleTime: 60 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ disputeId, notes }: { disputeId: string; notes?: string }) =>
      disputeApi.approveDispute(shopId, disputeId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopDisputes"] });
      setActionModal(null);
      setResolutionNotes("");
      showSuccess("Dispute approved. No-show penalty reversed.");
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || "Failed to approve dispute");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ disputeId, reason }: { disputeId: string; reason: string }) =>
      disputeApi.rejectDispute(shopId, disputeId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopDisputes"] });
      setActionModal(null);
      setResolutionNotes("");
      showSuccess("Dispute rejected.");
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || "Failed to reject dispute");
    },
  });

  const handleAction = () => {
    if (!actionModal) return;

    if (actionModal.action === "approve") {
      approveMutation.mutate({
        disputeId: actionModal.disputeId,
        notes: resolutionNotes || undefined,
      });
    } else {
      if (resolutionNotes.length < 10) {
        showError("Rejection reason must be at least 10 characters");
        return;
      }
      rejectMutation.mutate({
        disputeId: actionModal.disputeId,
        reason: resolutionNotes,
      });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "pending": return "#eab308";
      case "approved": return "#22c55e";
      case "rejected": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getStatusIcon = (status?: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "pending": return "time-outline";
      case "approved": return "checkmark-circle-outline";
      case "rejected": return "close-circle-outline";
      default: return "help-circle-outline";
    }
  };

  const renderDispute = ({ item }: { item: DisputeEntry }) => {
    const statusColor = getStatusColor(item.disputeStatus);
    const isPending = item.disputeStatus === "pending";

    return (
      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3 mx-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center mr-3">
              <Ionicons name="person" size={20} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold" numberOfLines={1}>
                {item.customerName || "Unknown Customer"}
              </Text>
              {item.customerEmail && (
                <Text className="text-gray-500 text-xs" numberOfLines={1}>
                  {item.customerEmail}
                </Text>
              )}
            </View>
          </View>
          <View
            className="flex-row items-center px-2.5 py-1 rounded-full"
            style={{ backgroundColor: statusColor + "20" }}
          >
            <Ionicons name={getStatusIcon(item.disputeStatus)} size={12} color={statusColor} />
            <Text className="text-xs font-medium ml-1 capitalize" style={{ color: statusColor }}>
              {item.disputeStatus}
            </Text>
          </View>
        </View>

        {/* Dispute Reason */}
        <View className="bg-zinc-800/50 rounded-lg p-3 mb-3">
          <Text className="text-gray-400 text-xs mb-1">Dispute Reason</Text>
          <Text className="text-white text-sm">{item.disputeReason || "No reason provided"}</Text>
        </View>

        {/* Details */}
        <View className="flex-row flex-wrap gap-y-2 mb-3">
          {item.serviceName && (
            <View className="flex-row items-center mr-4">
              <Feather name="briefcase" size={12} color="#6B7280" />
              <Text className="text-gray-400 text-xs ml-1">{item.serviceName}</Text>
            </View>
          )}
          <View className="flex-row items-center mr-4">
            <Feather name="calendar" size={12} color="#6B7280" />
            <Text className="text-gray-400 text-xs ml-1">No-show: {formatDate(item.markedNoShowAt)}</Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="clock" size={12} color="#6B7280" />
            <Text className="text-gray-400 text-xs ml-1">Filed: {formatDate(item.disputeSubmittedAt)}</Text>
          </View>
        </View>

        {/* Resolution notes (if resolved) */}
        {item.disputeResolutionNotes && (
          <View className="bg-zinc-800/50 rounded-lg p-3 mb-3">
            <Text className="text-gray-400 text-xs mb-1">Resolution Notes</Text>
            <Text className="text-gray-300 text-sm">{item.disputeResolutionNotes}</Text>
          </View>
        )}

        {/* Actions for pending disputes */}
        {isPending && (
          <View className="flex-row gap-3 mt-1">
            <TouchableOpacity
              onPress={() => {
                setResolutionNotes("");
                setActionModal({ disputeId: item.id, action: "approve" });
              }}
              className="flex-1 bg-green-500/20 border border-green-500/30 rounded-xl py-3 items-center flex-row justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              <Text className="text-green-400 font-semibold ml-2">Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setResolutionNotes("");
                setActionModal({ disputeId: item.id, action: "reject" });
              }}
              className="flex-1 bg-red-500/20 border border-red-500/30 rounded-xl py-3 items-center flex-row justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#ef4444" />
              <Text className="text-red-400 font-semibold ml-2">Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="shield-checkmark-outline" size={64} color="#333" />
      <Text className="text-gray-400 text-lg mt-4">No {filter !== "all" ? filter : ""} disputes</Text>
      <Text className="text-gray-500 text-sm text-center mt-2 px-8">
        {filter === "pending"
          ? "No customer disputes awaiting your review"
          : "No disputes found for this filter"}
      </Text>
    </View>
  );

  const isActioning = approveMutation.isPending || rejectMutation.isPending;

  return (
    <ThemedView className="h-full w-full">
      <AppHeader title="Dispute Requests" />

      {/* Stats */}
      {disputeData && (
        <View className="flex-row mx-4 mb-3 gap-3">
          <View className="flex-1 bg-[#1a1a1a] rounded-xl p-3 items-center">
            <Text className="text-[#FFCC00] text-xl font-bold">{disputeData.pendingCount}</Text>
            <Text className="text-gray-500 text-xs">Pending</Text>
          </View>
          <View className="flex-1 bg-[#1a1a1a] rounded-xl p-3 items-center">
            <Text className="text-white text-xl font-bold">{disputeData.total}</Text>
            <Text className="text-gray-500 text-xs">Total</Text>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View className="flex-row mx-4 mb-4 bg-[#1a1a1a] rounded-xl p-1">
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setFilter(f.value)}
            className={`flex-1 py-2 rounded-lg ${filter === f.value ? "bg-[#FFCC00]" : ""}`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                filter === f.value ? "text-black" : "text-gray-400"
              }`}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Disputes List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : (
        <FlatList
          data={disputeData?.disputes || []}
          renderItem={renderDispute}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
        />
      )}

      {/* Action Modal */}
      <Modal visible={!!actionModal} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => !isActioning && setActionModal(null)}
        >
          <Pressable
            className="bg-[#1a1a1a] rounded-2xl w-[85%] p-6"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-white text-lg font-bold mb-4">
              {actionModal?.action === "approve" ? "Approve Dispute" : "Reject Dispute"}
            </Text>

            <Text className="text-gray-400 text-sm mb-2">
              {actionModal?.action === "approve"
                ? "Resolution notes (optional)"
                : "Rejection reason (required, min 10 chars)"}
            </Text>

            <TextInput
              value={resolutionNotes}
              onChangeText={setResolutionNotes}
              placeholder={
                actionModal?.action === "approve"
                  ? "Add any notes about the resolution..."
                  : "Explain why this dispute is being rejected..."
              }
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-[#252525] rounded-xl px-4 py-3 text-white mb-4 min-h-[100px]"
            />

            {actionModal?.action === "reject" && resolutionNotes.length > 0 && resolutionNotes.length < 10 && (
              <Text className="text-red-400 text-xs mb-3">
                {10 - resolutionNotes.length} more characters needed
              </Text>
            )}

            {actionModal?.action === "approve" && (
              <View className="bg-green-500/10 rounded-xl p-3 mb-4">
                <View className="flex-row items-start">
                  <Ionicons name="information-circle" size={16} color="#22c55e" />
                  <Text className="text-green-300 text-xs ml-2 flex-1">
                    Approving will reverse the no-show penalty. The customer's no-show count will be decremented and their tier recalculated.
                  </Text>
                </View>
              </View>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setActionModal(null)}
                disabled={isActioning}
                className="flex-1 bg-zinc-700 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAction}
                disabled={isActioning}
                className={`flex-1 rounded-xl py-3 items-center ${
                  actionModal?.action === "approve" ? "bg-green-500" : "bg-red-500"
                } ${isActioning ? "opacity-50" : ""}`}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold">
                    {actionModal?.action === "approve" ? "Approve" : "Reject"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}
