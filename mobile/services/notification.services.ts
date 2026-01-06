import apiClient from "@/utilities/axios";
import {
  RegisterPushTokenParams,
  RegisterPushTokenResponse,
  GetActiveDevicesResponse,
  DeactivateTokensResponse,
} from "@/interfaces/notification.interface";

class NotificationApi {
  /**
   * Register or update a push token for the current user
   */
  async registerPushToken(
    params: RegisterPushTokenParams
  ): Promise<RegisterPushTokenResponse> {
    try {
      // apiClient methods already return response.data
      return await apiClient.post<RegisterPushTokenResponse>(
        "/notifications/push-tokens",
        params
      );
    } catch (error) {
      console.error("Failed to register push token:", error);
      throw error;
    }
  }

  /**
   * Deactivate a specific push token (logout from device)
   */
  async deactivatePushToken(token: string): Promise<DeactivateTokensResponse> {
    try {
      return await apiClient.delete<DeactivateTokensResponse>(
        `/notifications/push-tokens/${encodeURIComponent(token)}`
      );
    } catch (error) {
      console.error("Failed to deactivate push token:", error);
      throw error;
    }
  }

  /**
   * Deactivate all push tokens (logout from all devices)
   */
  async deactivateAllPushTokens(): Promise<DeactivateTokensResponse> {
    try {
      return await apiClient.delete<DeactivateTokensResponse>(
        "/notifications/push-tokens"
      );
    } catch (error) {
      console.error("Failed to deactivate all push tokens:", error);
      throw error;
    }
  }

  /**
   * Get all active devices for the current user
   */
  async getActiveDevices(): Promise<GetActiveDevicesResponse> {
    try {
      return await apiClient.get<GetActiveDevicesResponse>(
        "/notifications/push-tokens"
      );
    } catch (error) {
      console.error("Failed to get active devices:", error);
      throw error;
    }
  }
}

export const notificationApi = new NotificationApi();
