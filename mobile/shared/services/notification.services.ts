import apiClient from "@/shared/utilities/axios";
import {
  RegisterPushTokenParams,
  RegisterPushTokenResponse,
  GetActiveDevicesResponse,
  DeactivateTokensResponse,
  GetNotificationsResponse,
  GetUnreadCountResponse,
  MarkAsReadResponse,
  Notification,
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

  /**
   * Get paginated notifications for the current user
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20
  ): Promise<GetNotificationsResponse> {
    try {
      return await apiClient.get<GetNotificationsResponse>(
        `/notifications?page=${page}&limit=${limit}`
      );
    } catch (error) {
      console.error("Failed to get notifications:", error);
      throw error;
    }
  }

  /**
   * Get all unread notifications
   */
  async getUnreadNotifications(): Promise<{ notifications: Notification[] }> {
    try {
      return await apiClient.get<{ notifications: Notification[] }>(
        "/notifications/unread"
      );
    } catch (error) {
      console.error("Failed to get unread notifications:", error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<GetUnreadCountResponse> {
    try {
      return await apiClient.get<GetUnreadCountResponse>(
        "/notifications/unread/count"
      );
    } catch (error) {
      console.error("Failed to get unread count:", error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<MarkAsReadResponse> {
    try {
      return await apiClient.patch<MarkAsReadResponse>(
        `/notifications/${notificationId}/read`
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<MarkAsReadResponse> {
    try {
      return await apiClient.patch<MarkAsReadResponse>(
        "/notifications/read-all"
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  }
}

export const notificationApi = new NotificationApi();
