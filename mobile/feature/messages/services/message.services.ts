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
  GetOrCreateConversationResponse,
  QuickReply,
  CreateQuickReplyRequest,
  UpdateQuickReplyRequest,
  GetQuickRepliesResponse,
  QuickReplyResponse,
  AutoMessage,
  CreateAutoMessageRequest,
  UpdateAutoMessageRequest,
  GetAutoMessagesResponse,
  AutoMessageResponse,
  GetAutoMessageHistoryResponse,
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

  /**
   * Upload message attachments (images or PDFs)
   * @param files - Array of file objects with uri, name, type
   * @returns Array of uploaded attachment objects
   */
  async uploadAttachments(
    files: Array<{ uri: string; name: string; type: string }>
  ): Promise<{
    success: boolean;
    data: Array<{
      url: string;
      key: string;
      type: "image" | "file";
      name: string;
      size: number;
      mimetype: string;
    }>;
    warnings?: string;
  }> {
    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });

      return await apiClient.post("/messages/attachments/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    } catch (error) {
      console.error("Failed to upload attachments:", error);
      throw error;
    }
  }

  // ============ Get or Create Conversation ============

  /**
   * Get or create a conversation with a customer (shop only)
   * Returns existing conversation or creates a new one
   * @param customerAddress - The customer's wallet address
   */
  async getOrCreateConversation(
    customerAddress: string
  ): Promise<GetOrCreateConversationResponse> {
    try {
      return await apiClient.post<GetOrCreateConversationResponse>(
        "/messages/conversations/get-or-create",
        { customerAddress }
      );
    } catch (error) {
      console.error("Failed to get or create conversation:", error);
      throw error;
    }
  }

  // ============ Quick Replies ============

  /**
   * Get all quick replies for the authenticated shop
   */
  async getQuickReplies(): Promise<GetQuickRepliesResponse> {
    try {
      return await apiClient.get<GetQuickRepliesResponse>(
        "/messages/quick-replies"
      );
    } catch (error) {
      console.error("Failed to get quick replies:", error);
      throw error;
    }
  }

  /**
   * Create a new quick reply
   */
  async createQuickReply(
    params: CreateQuickReplyRequest
  ): Promise<QuickReplyResponse> {
    try {
      return await apiClient.post<QuickReplyResponse>(
        "/messages/quick-replies",
        params
      );
    } catch (error) {
      console.error("Failed to create quick reply:", error);
      throw error;
    }
  }

  /**
   * Update an existing quick reply
   */
  async updateQuickReply(
    id: string,
    params: UpdateQuickReplyRequest
  ): Promise<QuickReplyResponse> {
    try {
      return await apiClient.put<QuickReplyResponse>(
        `/messages/quick-replies/${id}`,
        params
      );
    } catch (error) {
      console.error("Failed to update quick reply:", error);
      throw error;
    }
  }

  /**
   * Delete a quick reply
   */
  async deleteQuickReply(id: string): Promise<{ success: boolean }> {
    try {
      return await apiClient.delete<{ success: boolean }>(
        `/messages/quick-replies/${id}`
      );
    } catch (error) {
      console.error("Failed to delete quick reply:", error);
      throw error;
    }
  }

  /**
   * Increment usage count for a quick reply
   * Call this when a quick reply is used in a message
   */
  async useQuickReply(id: string): Promise<QuickReplyResponse> {
    try {
      return await apiClient.post<QuickReplyResponse>(
        `/messages/quick-replies/${id}/use`
      );
    } catch (error) {
      console.error("Failed to track quick reply usage:", error);
      throw error;
    }
  }

  // ============ Auto-Messages ============

  /**
   * Get all auto-message rules for the authenticated shop
   */
  async getAutoMessages(): Promise<GetAutoMessagesResponse> {
    try {
      return await apiClient.get<GetAutoMessagesResponse>(
        "/messages/auto-messages"
      );
    } catch (error) {
      console.error("Failed to get auto-messages:", error);
      throw error;
    }
  }

  /**
   * Create a new auto-message rule
   */
  async createAutoMessage(
    params: CreateAutoMessageRequest
  ): Promise<AutoMessageResponse> {
    try {
      return await apiClient.post<AutoMessageResponse>(
        "/messages/auto-messages",
        params
      );
    } catch (error) {
      console.error("Failed to create auto-message:", error);
      throw error;
    }
  }

  /**
   * Update an existing auto-message rule
   */
  async updateAutoMessage(
    id: string,
    params: UpdateAutoMessageRequest
  ): Promise<AutoMessageResponse> {
    try {
      return await apiClient.put<AutoMessageResponse>(
        `/messages/auto-messages/${id}`,
        params
      );
    } catch (error) {
      console.error("Failed to update auto-message:", error);
      throw error;
    }
  }

  /**
   * Delete an auto-message rule and its send history
   */
  async deleteAutoMessage(id: string): Promise<{ success: boolean }> {
    try {
      return await apiClient.delete<{ success: boolean }>(
        `/messages/auto-messages/${id}`
      );
    } catch (error) {
      console.error("Failed to delete auto-message:", error);
      throw error;
    }
  }

  /**
   * Toggle an auto-message rule enabled/disabled
   */
  async toggleAutoMessage(id: string): Promise<AutoMessageResponse> {
    try {
      return await apiClient.patch<AutoMessageResponse>(
        `/messages/auto-messages/${id}/toggle`
      );
    } catch (error) {
      console.error("Failed to toggle auto-message:", error);
      throw error;
    }
  }

  /**
   * Get send history for an auto-message rule
   */
  async getAutoMessageHistory(
    id: string,
    page: number = 1,
    limit: number = 20
  ): Promise<GetAutoMessageHistoryResponse> {
    try {
      return await apiClient.get<GetAutoMessageHistoryResponse>(
        `/messages/auto-messages/${id}/history?page=${page}&limit=${limit}`
      );
    } catch (error) {
      console.error("Failed to get auto-message history:", error);
      throw error;
    }
  }
}

export const messageApi = new MessageApi();
