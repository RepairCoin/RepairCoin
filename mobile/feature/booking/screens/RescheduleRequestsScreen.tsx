import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { RescheduleRequestCard } from "../components";
import {
  useRescheduleRequestsQuery,
} from "../hooks/queries";
import {
  useApproveRescheduleRequestMutation,
  useRejectRescheduleRequestMutation,
} from "../hooks/mutations";
import { RescheduleRequestStatus } from "@/shared/services/appointment.services";

type FilterStatus = RescheduleRequestStatus | "all";

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

export default function RescheduleRequestsScreen() {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("pending");

  // Fetch requests
  const {
    data: requests,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useRescheduleRequestsQuery(selectedFilter);

  // Mutations
  const approveRequestMutation = useApproveRescheduleRequestMutation();
  const rejectRequestMutation = useRejectRescheduleRequestMutation();

  // Track which request is being processed
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await approveRequestMutation.mutateAsync(requestId);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (requestId: string, reason?: string) => {
    setProcessingRequestId(requestId);
    try {
      await rejectRequestMutation.mutateAsync({ requestId, reason });
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Filter counts
  const filterCounts = useMemo(() => {
    if (!requests) return {};
    // When showing "all", count by status
    const counts: Partial<Record<FilterStatus, number>> = {};
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    counts.all = requests.length;
    return counts;
  }, [requests]);

  return (
    <ThemedView className="flex-1">
      <AppHeader title="Reschedule Requests" />

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-[#333]"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilter === option.value;
          const count = filterCounts[option.value] || 0;
          const showBadge = option.value === "pending" && count > 0;

          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => setSelectedFilter(option.value)}
              className={`mr-2 px-4 py-2 rounded-full flex-row items-center ${
                isSelected ? "bg-[#FFCC00]" : "bg-[#252525]"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isSelected ? "text-black" : "text-gray-400"
                }`}
              >
                {option.label}
              </Text>
              {showBadge && (
                <View className="ml-1.5 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-white text-xs font-bold">
                    {count > 99 ? "99+" : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#FFCC00"
          />
        }
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-gray-400 mt-4">Loading requests...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="text-gray-400 mt-4 text-center">
              Failed to load reschedule requests.{"\n"}Pull down to retry.
            </Text>
          </View>
        ) : !requests || requests.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-20 h-20 rounded-full bg-[#252525] items-center justify-center mb-4">
              <Ionicons name="calendar-outline" size={40} color="#666" />
            </View>
            <Text className="text-white text-lg font-semibold mb-2">
              No Requests
            </Text>
            <Text className="text-gray-400 text-center px-8">
              {selectedFilter === "pending"
                ? "No pending reschedule requests from customers."
                : selectedFilter === "all"
                ? "No reschedule requests yet."
                : `No ${selectedFilter} reschedule requests.`}
            </Text>
          </View>
        ) : (
          <>
            {/* Request Cards */}
            {requests.map((request) => (
              <RescheduleRequestCard
                key={request.requestId}
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
                isApproving={
                  processingRequestId === request.requestId &&
                  approveRequestMutation.isPending
                }
                isRejecting={
                  processingRequestId === request.requestId &&
                  rejectRequestMutation.isPending
                }
              />
            ))}

            {/* Bottom Padding */}
            <View className="h-8" />
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}
