import { useState, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";
import { useToast } from "react-native-toast-notifications";
import { useCustomerRedeemData } from "./useCustomerRedeemData";
import { RedemptionSession } from "../../services/token.interface";
import { useRedemptionSignature } from "./useRedemptionSignature";
import { 
  useRedemptionSessions,
  useApproveRedemptionSession,
  useRejectRedemptionSession,
} from "./useRedeemQuery";

const POLLING_INTERVAL = 5000;

export const useCustomerRedeem = () => {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showHowToRedeem, setShowHowToRedeem] = useState(false);

  const {
    customerData,
    isLoadingCustomer,
    customerError,
    refetchCustomer,
    refetchTransactions,
    totalBalance,
    totalRedeemed,
    recentRedemptions,
  } = useCustomerRedeemData();

  const {
    sessions,
    pendingSessions,
    isLoadingSessions,
    refetchSessions,
  } = useRedemptionSessions();

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      const startPolling = () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        pollingIntervalRef.current = setInterval(() => {
          if (appStateRef.current === "active") {
            refetchSessions();
          }
        }, POLLING_INTERVAL);
      };

      const stopPolling = () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        appStateRef.current = nextAppState;
        if (nextAppState === "active") {
          refetchSessions();
          startPolling();
        } else {
          stopPolling();
        }
      };

      refetchSessions();
      startPolling();

      const subscription = AppState.addEventListener("change", handleAppStateChange);

      return () => {
        stopPolling();
        subscription.remove();
      };
    }, [refetchSessions])
  );

  const { generateSignature } = useRedemptionSignature();
  const approveSession = useApproveRedemptionSession();
  const rejectSession = useRejectRedemptionSession();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCustomer(), refetchTransactions(), refetchSessions()]);
    setRefreshing(false);
  }, [refetchCustomer, refetchTransactions, refetchSessions]);

  const handleAccept = useCallback(async (sessionId: string) => {
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

      // Signature is optional and only verified by the backend in blockchain mode
      // (ENABLE_BLOCKCHAIN_MINTING). In the default database mode the approval is
      // authorized via the JWT session, matching the web flow. Generate it
      // opportunistically, but don't block approval if it can't be produced
      // (e.g. external wallet, lapsed session, signMessage unsupported).
      const signature = await generateSignature({
        sessionId,
        customerAddress: session.customerAddress,
        shopId: session.shopId,
        amount: sessionAmount,
        expiresAt: session.expiresAt,
      });

      const result = await approveSession.mutateAsync({
        sessionId,
        ...(signature ? { signature } : {}),
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
  }, [sessions, generateSignature, approveSession, refetchSessions, refetchCustomer, refetchTransactions, toast]);

  const handleReject = useCallback(async (sessionId: string) => {
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
  }, [rejectSession, refetchSessions, toast]);

  return {
    refreshing,
    actionLoading,
    showHowToRedeem,
    setShowHowToRedeem,
    customerData,
    isLoadingCustomer,
    customerError,
    totalBalance,
    totalRedeemed,
    recentRedemptions,
    pendingSessions,
    isLoadingSessions,
    onRefresh,
    handleAccept,
    handleReject,
    refetchCustomer,
  };
};
