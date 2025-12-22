import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useCallback, useState } from "react";
import { router } from "expo-router";
import { useToast } from "react-native-toast-notifications";
import { RedemptionSession } from "@/services/tokenServices";
import { useRedemptionSignature } from "@/hooks/useSignature";
import {
  useRedemptionSessions,
  useApproveRedemptionSession,
  useRejectRedemptionSession,
} from "@/hooks/useTokenQueries";

interface RequestCardProps {
  session: RedemptionSession;
  onAccept: (sessionId: string) => void;
  onReject: (sessionId: string) => void;
}

const RequestCard = ({ session, onAccept, onReject }: RequestCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const dateStr = date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
    return `${time} • ${dateStr}`;
  };

  return (
    <View className="bg-[#2F2F2F] m-4 p-4 rounded-xl">
      <View className="flex-row justify-between">
        <Text className="text-xl text-white font-extrabold">
          {session.shopId || "Shop"}
        </Text>
        <Text className="text-xl text-white font-extrabold">
          {session.amount} RCN
        </Text>
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="text-white/50 text-sm">{session.shopId}</Text>
        <Text className="text-white/50 text-sm">
          {formatDate(session.createdAt)}
        </Text>
      </View>
      <View className="flex flex-row justify-between mt-4 mb-2">
        <Pressable
          className="bg-[#DDF6E2] py-1 w-[45%] items-center rounded-lg"
          onPress={() => onAccept(session.sessionId)}
        >
          <Text className="text-[#1A9D5B]">Accept</Text>
        </Pressable>
        <Pressable
          className="bg-[#F6C8C8] py-1 w-[45%] items-center rounded-lg"
          onPress={() => onReject(session.sessionId)}
        >
          <Text className="text-[#E34C4C]">Reject</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function ApprovalTab() {
  const { data, isLoading, error, refetch } = useRedemptionSessions();
  const { generateSignature } = useRedemptionSignature();
  const approveSession = useApproveRedemptionSession();
  const rejectSession = useRejectRedemptionSession();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const sessions = data?.sessions || [];
  const pendingSessions = sessions.filter(
    (session: RedemptionSession) => session.status === "pending"
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAccept = async (sessionId: string) => {
    setActionLoading(true);
    try {
      // Find the session to get details
      const session = sessions.find(
        (s: RedemptionSession) => s.sessionId === sessionId
      );
      if (!session) {
        console.error("Session not found:", sessionId);
        return;
      }

      // Generate signature for this redemption using the hook
      const signature = await generateSignature(
        sessionId,
        session.amount,
        session.shopId
      );

      if (!signature) {
        console.error("Failed to generate signature");
        toast.show("Failed to generate signature", {
          type: "danger",
          placement: "top",
          duration: 3000,
          animationType: "slide-in",
          style: { marginTop: 24 },
        });
        return;
      }

      // Call API to approve redemption with signature
      const result = await approveSession.mutateAsync({
        sessionId,
        signature,
      });

      console.log("Approval successful:", result);

      // Show success toast
      if (result?.data?.status === "approved") {
        toast.show(
          `Redemption approved successfully!`,
          {
            type: "success",
            placement: "top",
            duration: 4000,
            animationType: "slide-in",
            style: { marginTop: 28 },
          }
        );
      } else {
        toast.show("Redemption request processed", {
          type: "success",
          placement: "top",
          duration: 3000,
          animationType: "slide-in",
          style: { marginTop: 28 },
        });
      }

      // Refresh the sessions list to show updated status
      await refetch();
    } catch (approvalError: any) {
      console.error("Approval failed:", approvalError);

      // Show error toast
      const errorMessage =
        approvalError?.response?.data?.error ||
        approvalError?.message ||
        "Failed to approve redemption";
      toast.show(`${errorMessage}`, {
        type: "danger",
        placement: "top",
        duration: 5000,
        animationType: "slide-in",
        style: { marginTop: 28 },
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (sessionId: string) => {
    setActionLoading(true);
    try {
      // Find the session to get details for the toast
      const session = sessions.find(
        (s: RedemptionSession) => s.sessionId === sessionId
      );

      await rejectSession.mutateAsync(sessionId);

      // Show success toast
      toast.show(
        `Redemption request rejected`,
        {
          type: "danger",
          placement: "top",
          duration: 4000,
          animationType: "slide-in",
          style: { marginTop: 28 },
        }
      );

      // Refresh the sessions list to show updated status
      await refetch();
    } catch (rejectError: any) {
      console.error("[ApprovalTab] Rejection failed:", rejectError);

      // Show error toast
      const errorMessage =
        rejectError?.response?.data?.error ||
        rejectError?.message ||
        "Failed to reject redemption";
      toast.show(`${errorMessage}`, {
        type: "danger",
        placement: "top",
        duration: 5000,
        animationType: "slide-in",
        style: { marginTop: 28 },
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <ScrollView
        className="h-full w-full mt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
        pointerEvents={actionLoading ? "none" : "auto"}
      >
        <View className="h-52">
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
            <View className="pl-4 mt-6 w-[60%]">
              <Text className="text-black font-bold text-2xl">Create QR Code</Text>
              <Text className="text-black/60 text-base">Share your referral link via QR code.</Text>
              <Pressable
                onPress={() => router.push("/customer/qrcode")}
                className="bg-black w-36 rounded-xl py-2 mt-4 justify-center items-center"
              >
                <Text className="text-[#FFCC00] font-bold text-sm">
                  QR Code
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View className="bg-[#212121] mt-4 rounded-xl">
          <View className="bg-[#FFCC00] p-4 rounded-t-xl flex-row justify-between items-center">
            <Text className="text-black text-lg font-extrabold">
              Redemption Requests
            </Text>
            {/* <Pressable
            onPress={() => router.push("/customer/RedemptionHistory")}
          >
            <Text className="text-black font-semibold">See All</Text>
          </Pressable> */}
          </View>

          {isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#FFCC00" />
              <Text className="text-white mt-2">Loading requests...</Text>
            </View>
          ) : error ? (
            <View className="py-8 items-center">
              <Text className="text-red-400">
                Failed to load redemption requests
              </Text>
              <Pressable onPress={() => refetch()} className="mt-4">
                <Text className="text-[#FFCC00]">Retry</Text>
              </Pressable>
            </View>
          ) : pendingSessions.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-white/50">
                No pending redemption requests
              </Text>
            </View>
          ) : (
            <>
              {pendingSessions.map(
                (session: RedemptionSession, index: number) => (
                  <RequestCard
                    key={`${session.sessionId}-${index}`}
                    session={session}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                )
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {actionLoading && (
        <View className="absolute inset-0 bg-black/50 flex-1 justify-center items-center z-50">
          <View className="bg-[#2F2F2F] p-8 rounded-2xl items-center">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-white mt-4 text-lg font-semibold">
              Processing...
            </Text>
            <Text className="text-white/70 mt-2 text-center">
              Please wait while we process your request
            </Text>
          </View>
        </View>
      )}
    </>
  );
}
