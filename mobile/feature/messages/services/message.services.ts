import apiClient from "@/utilities/axios";
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
} from "@/interfaces/message.interface";

class MessageApi {
  /**
   * Get paginated list of conversations for the current user
   */
  async getConversations(
    page: number = 1,
    limit: number = 20
  ): Promise<GetConversationsResponse> {
    try {
      return await apiClient.get<GetConversationsResponse>(
        `/messages/conversations?page=${page}&limit=${limit}`
      );
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
      return await apiClient.get<Conversation>(
        `/messages/conversations/${conversationId}`
      );
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
}

export const messageApi = new MessageApi();
