import { apiClient } from "@/shared/utilities/axios";
import {
  BalanceResponse,
  CreateRedemptionSessionResponse,
  GiftTokenRequest,
  GiftTokenResponse,
  MyRedemptionSessionsResponse,
  RedemptionSessionStatusResponse,
  TransferHistoryResponse,
  ValidateTransferRequest,
  ValidateTransferResponse,
} from "@/interfaces/token.interface";

class TokenApi {
  async createRedemptionSession(request: {
    customerAddress: string;
    shopId: string;
    amount: number;
  }): Promise<CreateRedemptionSessionResponse> {
    try {
      return await apiClient.post("/tokens/redemption-session/create", request);
    } catch (error: any) {
      console.error("Failed to create redemption session:", error.message);
      throw error;
    }
  }

  async checkRedemptionSessionStatus(
    sessionId: string
  ): Promise<RedemptionSessionStatusResponse> {
    try {
      return await apiClient.get(
        `/tokens/redemption-session/status/${sessionId}`
      );
    } catch (error: any) {
      console.error(
        "Failed to check redemption session status:",
        error.message
      );
      throw error;
    }
  }

  async cancelRedemptionSession(
    sessionId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.post("/tokens/redemption-session/cancel", {
        sessionId,
      });
    } catch (error: any) {
      console.error("Failed to cancel redemption session:", error.message);
      throw error;
    }
  }

  async transferToken(payload: GiftTokenRequest): Promise<GiftTokenResponse> {
    try {
      return await apiClient.post<GiftTokenResponse>(
        "/tokens/transfer",
        payload
      );
    } catch (error: any) {
      console.error("Failed to transfer token:", error.message);
      throw error;
    }
  }

  async validateTransfer(
    payload: ValidateTransferRequest
  ): Promise<ValidateTransferResponse> {
    try {
      return await apiClient.post<ValidateTransferResponse>(
        "/tokens/validate-transfer",
        payload
      );
    } catch (error: any) {
      console.error("Failed to validate transfer:", error.message);
      throw error;
    }
  }

  async getTransferHistory(
    address: string,
    options?: { limit?: number; offset?: number }
  ): Promise<TransferHistoryResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.offset) params.append("offset", options.offset.toString());

      const queryString = params.toString() ? `?${params.toString()}` : "";
      return await apiClient.get<TransferHistoryResponse>(
        `/tokens/transfer-history/${address}${queryString}`
      );
    } catch (error: any) {
      console.error("Failed to get transfer history:", error.message);
      throw error;
    }
  }

  async fetchTokenBalance(address: string): Promise<BalanceResponse | null> {
    try {
      return await apiClient.get<BalanceResponse>(`/tokens/balance/${address}`);
    } catch (error) {
      console.error("Failed to get tokens balance:", error);
      throw error;
    }
  }

  async fetchMyRedemptionSessions(): Promise<MyRedemptionSessionsResponse> {
    try {
      return await apiClient.get<MyRedemptionSessionsResponse>(
        "/tokens/redemption-session/my-sessions"
      );
    } catch (error) {
      console.error("Failed to fetch redemption sessions:", error);
      throw error;
    }
  }

  async approvalRedemptionSession(sessionId: string, signature: string): Promise<any> {
    try {
      return await apiClient.post<any>(`/tokens/redemption-session/approve`, {
        sessionId,
        signature,
      });
    } catch (error) {
      console.error("Failed to approve redemption session:", error);
      throw error;
    }
  }

  async rejectRedemptionSession(sessionId: string): Promise<any> {
    try {
      return await apiClient.post(`/tokens/redemption-session/reject`, { sessionId });
    } catch (error) {
      console.error("Failed to reject redemption session:", error);
      throw error;
    }
  }
}

export const tokenApi = new TokenApi();
