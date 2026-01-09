import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useToast } from "react-native-toast-notifications";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { AppHeader } from "@/components/ui/AppHeader";
import { TransactionData } from "@/interfaces/customer.interface";
import { RedemptionSession } from "@/interfaces/token.interface";
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
  disabled?: boolean;
}

const RequestCard = ({ session, onAccept, onReject, disabled }: RequestCardProps) => {
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

  const amount = session.maxAmount || session.amount || 0;

  return (
    <View className="bg-zinc-800 p-4 rounded-xl mb-3">
      <View className="flex-row justify-between">
        <Text className="text-lg text-white font-bold">
          {session.shopId || "Shop"}
        </Text>
        <Text className="text-lg text-[#FFCC00] font-bold">
          {amount} RCN
        </Text>
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-gray-500 text-sm">{session.shopId}</Text>
        <Text className="text-gray-500 text-sm">
          {formatDate(session.createdAt)}
        </Text>
      </View>
      <View className="flex-row justify-between mt-4">
        <Pressable
          className={`bg-green-500/20 py-2 flex-1 mr-2 items-center rounded-lg ${disabled ? "opacity-50" : ""}`}
          onPress={() => onAccept(session.sessionId)}
          disabled={disabled}
        >
          <Text className="text-green-400 font-semibold">Accept</Text>
        </Pressable>
        <Pressable
          className={`bg-red-500/20 py-2 flex-1 ml-2 items-center rounded-lg ${disabled ? "opacity-50" : ""}`}
          onPress={() => onReject(session.sessionId)}
          disabled={disabled}
        >
          <Text className="text-red-400 font-semibold">Reject</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function RedeemScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress, useGetTransactionsByWalletAddress } = useCustomer();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showHowToRedeem, setShowHowToRedeem] = useState(false);

  // Customer data
  const {
    data: customerData,
    isLoading,
    error,
    refetch: refetchCustomer,
  } = useGetCustomerByWalletAddress(account?.address);

  const {
    data: transactionData,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useGetTransactionsByWalletAddress(account?.address, 50);

  // Redemption sessions
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useRedemptionSessions();
  const { generateSignature } = useRedemptionSignature();
  const approveSession = useApproveRedemptionSession();
  const rejectSession = useRejectRedemptionSession();

  const sessions = sessionsData?.sessions || [];
  const pendingSessions = sessions.filter(
    (session: RedemptionSession) => session.status === "pending"
  );

  const totalBalance =
    (customerData?.customer?.lifetimeEarnings || 0) -
    (customerData?.customer?.totalRedemptions || 0);

  const totalRedeemed = customerData?.customer?.totalRedemptions || 0;

  // Get recent redemptions
  const recentRedemptions = useMemo(() => {
    if (!transactionData?.transactions) return [];
    return transactionData.transactions
      .filter((t: TransactionData) =>
        ["redeemed", "redemption"].includes(t.type?.toLowerCase())
      )
      .slice(0, 5);
  }, [transactionData]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCustomer(), refetchTransactions(), refetchSessions()]);
    setRefreshing(false);
  }, [refetchCustomer, refetchTransactions, refetchSessions]);

  const handleAccept = async (sessionId: string) => {
    setActionLoading(true);
    try {
      const session = sessions.find(
        (s: RedemptionSession) => s.sessionId === sessionId
      );
      if (!session) {
        console.error("Session not found:", sessionId);
        return;
      }

      const sessionAmount = session.maxAmount || session.amount || 0;
      const signature = await generateSignature({
        sessionId,
        customerAddress: session.customerAddress,
        shopId: session.shopId,
        amount: sessionAmount,
        expiresAt: session.expiresAt,
      });

      if (!signature) {
        toast.show("Failed to generate signature", {
          type: "danger",
          placement: "top",
          duration: 3000,
          animationType: "slide-in",
          style: { marginTop: 24 },
        });
        return;
      }

      const result = await approveSession.mutateAsync({
        sessionId,
        signature,
      });

      if (result?.data?.status === "approved") {
        toast.show("Redemption approved successfully!", {
          type: "success",
          placement: "top",
          duration: 4000,
          animationType: "slide-in",
          style: { marginTop: 28 },
        });
      } else {
        toast.show("Redemption request processed", {
          type: "success",
          placement: "top",
          duration: 3000,
          animationType: "slide-in",
          style: { marginTop: 28 },
        });
      }

      await Promise.all([refetchSessions(), refetchCustomer(), refetchTransactions()]);
    } catch (approvalError: any) {
      console.error("Approval failed:", approvalError);
      const errorMessage =
        approvalError?.response?.data?.error ||
        approvalError?.message ||
        "Failed to approve redemption";
      toast.show(errorMessage, {
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
      await rejectSession.mutateAsync(sessionId);

      toast.show("Redemption request rejected", {
        type: "danger",
        placement: "top",
        duration: 4000,
        animationType: "slide-in",
        style: { marginTop: 28 },
      });

      await refetchSessions();
    } catch (rejectError: any) {
      console.error("Rejection failed:", rejectError);
      const errorMessage =
        rejectError?.response?.data?.error ||
        rejectError?.message ||
        "Failed to reject redemption";
      toast.show(errorMessage, {
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

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Redeem RCN" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">Loading...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Redeem RCN" />
        <View className="flex-1 justify-center items-center">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-400 text-lg mt-4">Failed to load data</Text>
          <Pressable
            onPress={() => refetchCustomer()}
            className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
          >
            <Text className="text-black font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader
        title="Redeem RCN"
        rightElement={
          <TouchableOpacity
            onPress={() => setShowHowToRedeem(true)}
            className="p-2"
          >
            <Ionicons name="help-circle-outline" size={24} color="white" />
          </TouchableOpacity>
        }
      />

      {/* How to Redeem Modal */}
      <Modal
        visible={showHowToRedeem}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHowToRedeem(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center items-center px-4"
          onPress={() => setShowHowToRedeem(false)}
        >
          <Pressable
            className="bg-zinc-900 rounded-2xl w-full max-w-md"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between p-4 border-b border-zinc-800">
              <Text className="text-white text-lg font-bold">How to Redeem</Text>
              <TouchableOpacity onPress={() => setShowHowToRedeem(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
              <View className="p-4">
                {/* How to Redeem Steps */}
                {[
                  {
                    icon: "storefront-outline",
                    title: "Visit a Partner Shop",
                    desc: "Go to any RepairCoin partner shop near you",
                  },
                  {
                    icon: "qr-code-outline",
                    title: "Show Your QR Code",
                    desc: "Let the shop scan your wallet QR code",
                  },
                  {
                    icon: "checkmark-circle-outline",
                    title: "Approve the Request",
                    desc: "You'll receive a notification to approve the redemption",
                  },
                  {
                    icon: "cash-outline",
                    title: "Get Your Discount",
                    desc: "Your RCN will be converted to store credit instantly",
                  },
                ].map((step, index) => (
                  <View
                    key={index}
                    className={`flex-row items-start ${index < 3 ? "mb-4 pb-4 border-b border-zinc-800" : ""}`}
                  >
                    <View className="bg-[#FFCC00]/20 rounded-full p-2 mr-3">
                      <Ionicons name={step.icon as any} size={20} color="#FFCC00" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{step.title}</Text>
                      <Text className="text-gray-400 text-sm mt-0.5">{step.desc}</Text>
                    </View>
                    <View className="bg-zinc-800 rounded-full w-6 h-6 items-center justify-center">
                      <Text className="text-gray-400 text-xs font-bold">{index + 1}</Text>
                    </View>
                  </View>
                ))}

                {/* Redemption Rules */}
                <View className="mt-4 pt-4 border-t border-zinc-700">
                  <Text className="text-white font-bold mb-3">Redemption Rules</Text>
                  <View className="flex-row items-start mb-3">
                    <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                    <Text className="text-gray-300 ml-2 flex-1">
                      <Text className="text-green-400 font-semibold">100%</Text> redemption at the shop where you earned RCN
                    </Text>
                  </View>
                  <View className="flex-row items-start mb-3">
                    <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                    <Text className="text-gray-300 ml-2 flex-1">
                      <Text className="text-[#FFCC00] font-semibold">20%</Text> redemption at any other partner shop
                    </Text>
                  </View>
                  <View className="flex-row items-start">
                    <Ionicons name="information-circle" size={18} color="#3B82F6" />
                    <Text className="text-gray-400 ml-2 flex-1 text-sm">
                      Redemption requires shop approval. You'll receive a notification when a shop initiates a redemption.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
        {/* Balance Card */}
        <View className="mt-4 bg-zinc-900 rounded-2xl p-5">
          <Text className="text-gray-400 text-sm">Available to Redeem</Text>
          <Text className="text-[#FFCC00] text-4xl font-bold mt-1">
            {totalBalance} RCN
          </Text>
          <Text className="text-gray-500 text-sm mt-2">
            = ${(totalBalance * 0.1).toFixed(2)} USD value
          </Text>

          <View className="flex-row mt-4 pt-4 border-t border-zinc-800">
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Total Redeemed</Text>
              <Text className="text-white font-semibold">{totalRedeemed} RCN</Text>
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Redemption Rate</Text>
              <Text className="text-white font-semibold">$0.10 per RCN</Text>
            </View>
          </View>
        </View>

        {/* Pending Redemption Requests */}
        <View className="mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-bold">Pending Requests</Text>
            {pendingSessions.length > 0 && (
              <View className="bg-[#FFCC00] px-2 py-1 rounded-full">
                <Text className="text-black text-xs font-bold">{pendingSessions.length}</Text>
              </View>
            )}
          </View>
          <View className="bg-zinc-900 rounded-xl p-4">
            {sessionsLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#FFCC00" />
              </View>
            ) : pendingSessions.length > 0 ? (
              pendingSessions.map((session: RedemptionSession) => (
                <RequestCard
                  key={session.sessionId}
                  session={session}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  disabled={actionLoading}
                />
              ))
            ) : (
              <View className="py-6 items-center">
                <Ionicons name="receipt-outline" size={40} color="#666" />
                <Text className="text-gray-400 mt-3 text-center">No pending requests</Text>
                <Text className="text-gray-500 text-sm text-center mt-1">
                  Visit a shop to request a redemption
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mt-6 flex-row">
          <TouchableOpacity
            onPress={() => router.push("/customer/qrcode")}
            className="flex-1 bg-[#FFCC00] rounded-xl py-4 mr-2 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={20} color="#000" />
            <Text className="text-black font-bold ml-2">Show QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/customer/tabs/history")}
            className="flex-1 bg-zinc-800 rounded-xl py-4 ml-2 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Feather name="clock" size={20} color="#fff" />
            <Text className="text-white font-bold ml-2">History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {actionLoading && (
        <View
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 justify-center items-center z-50"
          style={{ position: 'absolute' }}
        >
          <View className="bg-zinc-800 p-8 rounded-2xl items-center mx-4">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-white mt-4 text-lg font-semibold">
              Processing...
            </Text>
            <Text className="text-gray-400 mt-2 text-center">
              Please wait while we process your request
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
