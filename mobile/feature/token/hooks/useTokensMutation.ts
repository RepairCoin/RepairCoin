import { Linking } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { usePaymentStore } from "@/feature/booking/store/payment.store";
import { tokenApi } from "../services/token.services";
import { shopApi } from "@/feature/shop/services/shop.services";
import {
  CreatePromoCodeRequest,
  RewardRequest,
} from "@/feature/shop/services/shop.interface";
import {
  GiftTokenRequest,
  GiftTokenResponse,
  ValidateTransferRequest,
  ValidateTransferResponse,
} from "@/feature/token/services/token.interface";
import {
  CreateRedemptionSessionRequest,
  RedemptionSession,
  RedemptionCallbacks,
} from "../types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  sessionId: string;
  signature: string;
  transactionHash?: string;
}

// ─── Mutations ──────────────────────────────────────────────────────────────

// Approve redemption session
export const useApproveRedemptionSession = () => {
  return useMutation({
    mutationFn: async ({
      sessionId,
      signature,
      transactionHash,
    }: ApprovalRequest) => {
      console.log("[useApproveRedemptionSession] Approving session:", {
        sessionId,
        signature: signature.substring(0, 10) + "...",
        hasTransactionHash: !!transactionHash,
      });

      const response = await tokenApi.approvalRedemptionSession(
        sessionId,
        signature,
      );
      console.log("[useApproveRedemptionSession] Response:", response);
      return response;
    },
    onSuccess: (data, variables) => {
      console.log("[useApproveRedemptionSession] Success:", {
        sessionId: variables.sessionId,
        status: data?.data?.status,
      });
    },
    onError: (error: any, variables) => {
      console.error("[useApproveRedemptionSession] Error:", {
        sessionId: variables.sessionId,
        error: error?.message || error,
      });
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};

// Reject redemption session
export const useRejectRedemptionSession = () => {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      console.log("[useRejectRedemptionSession] Rejecting session:", {
        sessionId,
      });

      const response = await tokenApi.rejectRedemptionSession(sessionId);
      console.log("[useRejectRedemptionSession] Response:", response);
      return response;
    },
    onSuccess: (data, sessionId) => {
      console.log("[useRejectRedemptionSession] Success:", {
        sessionId,
        status: data?.data?.status,
      });
    },
    onError: (error: any, sessionId) => {
      console.error("[useRejectRedemptionSession] Error:", {
        sessionId,
        error: error?.message || error,
      });
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};

// Cancel redemption session
export const useCancelRedemptionSession = (
  callbacks?: RedemptionCallbacks
) => {
  const { onError } = callbacks || {};

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await tokenApi.cancelRedemptionSession(sessionId);
    },
    onError: (error: any) => {
      console.error("Failed to cancel session:", error);
      onError?.(
        error instanceof Error ? error : new Error("Failed to cancel session")
      );
    },
  });
};

// Create redemption session
export const useCreateRedemptionSession = (
  callbacks?: RedemptionCallbacks
) => {
  const { onSessionCreated, onError } = callbacks || {};
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (request: CreateRedemptionSessionRequest) => {
      return await tokenApi.createRedemptionSession(request);
    },
    onSuccess: (response, variables) => {
      if (!response.data?.sessionId || !response.data?.expiresAt) {
        console.error(
          "Invalid session response: missing sessionId or expiresAt"
        );
        return;
      }

      const session: RedemptionSession = {
        sessionId: response.data.sessionId,
        customerAddress: variables.customerAddress,
        shopId: variables.shopId,
        amount: variables.amount,
        status: "pending",
        expiresAt: response.data.expiresAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSessionCreated?.(session);
    },
    onError: (error: any) => {
      console.error("Failed to create redemption session:", error);
      onError?.(
        error instanceof Error
          ? error
          : new Error("Failed to create redemption session")
      );
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      request: CreateRedemptionSessionRequest,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(request, options));
    },
  };
};

// Validate promo code
export function useValidatePromoCode() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useMutation({
    mutationFn: async ({
      code,
      customerAddress,
    }: {
      code: string;
      customerAddress: string;
    }) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.validatePromoCode(shopId, {
        code: code.trim(),
        customer_address: customerAddress,
      });
    },
    onError: (error: any) => {
      console.error("Failed to validate promo code:", error);
    },
  });
}

// Update promo code status
export function useUpdatePromoCodeStatus() {
  const rqClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      promoCodeId,
      isActive,
    }: {
      promoCodeId: string;
      isActive: boolean;
    }) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.updatePromoCodeStatus(shopId, promoCodeId, isActive);
    },
    onSuccess: (_, variables) => {
      if (shopId) {
        rqClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });

        showSuccess(
          variables.isActive
            ? "Promo code activated successfully!"
            : "Promo code deactivated successfully!"
        );
      }
    },
    onError: (error: any, variables) => {
      console.error("Failed to update promo code status:", error);
      const statusText = variables.isActive ? "activate" : "deactivate";
      showError(
        error.response?.data?.message ||
          `Failed to ${statusText} promo code`
      );
    },
  });
}

// Create promo code
export function useCreatePromoCode() {
  const rqClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (promoCodeData: CreatePromoCodeRequest) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.createPromoCode(shopId, promoCodeData);
    },
    onSuccess: () => {
      showSuccess("Promo code created successfully!");
      router.back();

      if (shopId) {
        rqClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });
      }
    },
    onError: (error: any) => {
      console.error("Failed to create promo code:", error);
      showError(
        error.response?.data?.error || "Failed to create promo code"
      );
    },
  });
}

// Transfer token (gift)
export const useTransferToken = () => {
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (payload: GiftTokenRequest) => {
      const response: GiftTokenResponse =
        await tokenApi.transferToken(payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerProfile(variables.fromAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customerTransactions(variables.fromAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.transfers(),
      });
    },
    onError: (error: any) => {
      console.error("[useTransferToken] Error:", error);
      throw error;
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutateAsync: (
      payload: GiftTokenRequest,
      options?: Parameters<typeof mutation.mutateAsync>[1]
    ) => {
      return (
        guard(() => mutation.mutateAsync(payload, options)) ??
        Promise.reject(new Error("Already submitting"))
      );
    },
  };
};

// Validate transfer
export const useValidateTransfer = () => {
  return useMutation({
    mutationFn: async (payload: ValidateTransferRequest) => {
      const response: ValidateTransferResponse =
        await tokenApi.validateTransfer(payload);
      return response.data;
    },
    onError: (error: any) => {
      console.error("[useValidateTransfer] Error:", error);
      throw error;
    },
  });
};

// Stripe checkout
export function useCreateStripeCheckoutMutation() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!shopId) {
        throw new Error("Shop not authenticated");
      }
      if (amount < 5) {
        throw new Error("Minimum purchase amount is 5 RCN");
      }
      return shopApi.createStripeCheckout(amount);
    },
    onSuccess: async (data) => {
      usePaymentStore.getState().setActiveSession({
        type: "token_purchase",
        orderId: data.data.purchaseId,
        sessionId: data.data.sessionId,
        tokenAmount: data.data.amount,
        totalCost: data.data.totalCost,
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      const checkoutUrl = data.data.checkoutUrl;
      if (checkoutUrl) {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          usePaymentStore.getState().clearSession();
          showError(
            "Unable to open browser. Please try again or contact support."
          );
        }
      }
    },
    onError: (error: any) => {
      console.error("Failed to create Stripe checkout:", error);

      if (error.response?.status === 401) {
        showError(
          "Please log in again to continue with your purchase."
        );
      } else if (error.response?.status === 400) {
        showError(
          error.response?.data?.error || "Invalid purchase amount"
        );
      } else {
        showError(
          error.message ||
            "Failed to initiate purchase. Please try again."
        );
      }
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      amount: number,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(amount, options));
    },
  };
}
