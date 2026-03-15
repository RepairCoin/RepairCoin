import apiClient from "@/shared/utilities/axios";
import {
  Conversation,
  Message,
  GetConversationsResponse,
  GetMessagesResponse,
  GetUnreadCountResponse,
  MarkAsReadResponse,
  SendMessageRequest,
  SendMessageResponse,
  StartConversationResponse,
} from "@/shared/interfaces/message.interface";

class MessageApi {
  /**
   * Get paginated list of conversations for the current user
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @param archived - Filter by archived status (default: false)
   * @param status - Filter by status ('open' | 'resolved')
   * @param search - Search query for filtering by name/message
   */
  async getConversations(
    page: number = 1,
    limit: number = 20,
    archived: boolean = false,
    status?: 'open' | 'resolved',
    search?: string
  ): Promise<GetConversationsResponse> {
    try {
      let url = `/messages/conversations?page=${page}&limit=${limit}&archived=${archived}`;
      if (status) {
        url += `&status=${status}`;
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      return await apiClient.get<GetConversationsResponse>(url);
    } catch (error) {
      console.error("Failed to get conversations:", error);
      throw error;
    }
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    try {
      const response = await apiClient.get<{ success: boolean; data: Conversation }>(
        `/messages/conversations/${conversationId}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get conversation:", error);
      throw error;
    }
  }

  /**
   * Get paginated messages for a conversation
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<GetMessagesResponse> {
    try {
      return await apiClient.get<GetMessagesResponse>(
        `/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
      );
    } catch (error) {
      console.error("Failed to get messages:", error);
      throw error;
    }
  }

  /**
   * Send a message in an existing conversation or start a new one
   */
  async sendMessage(params: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      return await apiClient.post<SendMessageResponse>(
        "/messages/send",
        params
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  }

  /**
   * Start a new conversation with a recipient
   */
  async startConversation(
    recipientAddress: string,
    initialMessage?: string
  ): Promise<StartConversationResponse> {
    try {
      return await apiClient.post<StartConversationResponse>(
        "/messages/conversations",
        {
          recipientAddress,
          initialMessage,
        }
      );
    } catch (error) {
      console.error("Failed to start conversation:", error);
      throw error;
    }
  }

  /**
   * Get total unread message count across all conversations
   */
  async getUnreadCount(): Promise<GetUnreadCountResponse> {
    try {
      return await apiClient.get<GetUnreadCountResponse>(
        "/messages/unread/count"
      );
    } catch (error) {
      console.error("Failed to get unread count:", error);
      throw error;
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(
    conversationId: string
  ): Promise<MarkAsReadResponse> {
    try {
      return await apiClient.post<MarkAsReadResponse>(
        `/messages/conversations/${conversationId}/read`
      );
    } catch (error) {
      console.error("Failed to mark conversation as read:", error);
      throw error;
    }
  }

  /**
   * Mark a specific message as read
   */
  async markMessageAsRead(messageId: string): Promise<MarkAsReadResponse> {
    try {
      return await apiClient.patch<MarkAsReadResponse>(
        `/messages/${messageId}/read`
      );
    } catch (error) {
      console.error("Failed to mark message as read:", error);
      throw error;
    }
  }

  /**
   * Delete a conversation (soft delete)
   */
  async deleteConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    try {
      return await apiClient.delete<{ message: string }>(
        `/messages/conversations/${conversationId}`
      );
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      throw error;
    }
  }

  /**
   * Set conversation archived status
   * @param conversationId - The conversation ID
   * @param archived - true to archive, false to unarchive
   */
  async setConversationArchived(
    conversationId: string,
    archived: boolean
  ): Promise<{ message: string }> {
    try {
      return await apiClient.patch<{ message: string }>(
        `/messages/conversations/${conversationId}/archive`,
        { archived }
      );
    } catch (error) {
      console.error("Failed to update conversation archive status:", error);
      throw error;
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    return this.setConversationArchived(conversationId, true);
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    return this.setConversationArchived(conversationId, false);
  }

  /**
   * Block a conversation
   */
  async blockConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>(
        `/messages/conversations/${conversationId}/block`
      );
    } catch (error) {
      console.error("Failed to block conversation:", error);
      throw error;
    }
  }

  /**
   * Unblock a conversation
   */
  async unblockConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>(
        `/messages/conversations/${conversationId}/unblock`
      );
    } catch (error) {
      console.error("Failed to unblock conversation:", error);
      throw error;
    }
  }

  /**
   * Resolve a conversation
   */
  async resolveConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>(
        `/messages/conversations/${conversationId}/resolve`
      );
    } catch (error) {
      console.error("Failed to resolve conversation:", error);
      throw error;
    }
  }

  /**
   * Reopen a resolved conversation
   */
  async reopenConversation(
    conversationId: string
  ): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>(
        `/messages/conversations/${conversationId}/reopen`
      );
    } catch (error) {
      console.error("Failed to reopen conversation:", error);
      throw error;
    }
  }

  /**
   * Set typing indicator for a conversation
   * Call this when user starts typing (debounced)
   */
  async setTyping(conversationId: string): Promise<{ message: string }> {
    try {
      return await apiClient.post<{ message: string }>(
        `/messages/conversations/${conversationId}/typing`
      );
    } catch (error) {
      console.error("Failed to set typing indicator:", error);
      throw error;
    }
  }

  /**
   * Get active typing indicators for a conversation
   * Returns list of users currently typing
   */
  async getTyping(conversationId: string): Promise<{
    success: boolean;
    data: Array<{
      conversationId: string;
      userAddress: string;
      userType: "customer" | "shop";
      startedAt: string;
      expiresAt: string;
    }>;
  }> {
    try {
      return await apiClient.get(
        `/messages/conversations/${conversationId}/typing`
      );
    } catch (error) {
      console.error("Failed to get typing indicators:", error);
      throw error;
    }
  }
}

export const messageApi = new MessageApi();
