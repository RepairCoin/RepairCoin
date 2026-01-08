// frontend/src/services/api/messaging.ts
import apiClient from './client';

export interface Conversation {
  conversationId: string;
  customerAddress: string;
  shopId: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCountCustomer: number;
  unreadCountShop: number;
  isArchivedCustomer: boolean;
  isArchivedShop: boolean;
  isBlocked: boolean;
  blockedBy?: string;
  blockedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  customerName?: string;
  shopName?: string;
  shopImageUrl?: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  senderAddress: string;
  senderType: 'customer' | 'shop';
  messageText: string;
  messageType: 'text' | 'booking_link' | 'service_link' | 'system';
  attachments: any[];
  metadata: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  senderName?: string;
}

export interface SendMessageRequest {
  conversationId?: string;
  customerAddress?: string;
  shopId?: string;
  messageText: string;
  messageType?: 'text' | 'booking_link' | 'service_link' | 'system';
  metadata?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Send a message in a conversation
 */
export const sendMessage = async (request: SendMessageRequest): Promise<Message> => {
  const response = await apiClient.post('/messages/send', request);
  return response.data;
};

/**
 * Get all conversations for the authenticated user
 */
export const getConversations = async (options?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Conversation>> => {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await apiClient.get(`/messages/conversations?${params.toString()}`);
  return {
    data: response.data,
    pagination: response.pagination
  };
};

/**
 * Get messages in a conversation
 */
export const getMessages = async (
  conversationId: string,
  options?: { page?: number; limit?: number }
): Promise<PaginatedResponse<Message>> => {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await apiClient.get(
    `/messages/conversations/${conversationId}/messages?${params.toString()}`
  );
  return {
    data: response.data,
    pagination: response.pagination
  };
};

/**
 * Mark all messages in a conversation as read
 */
export const markConversationAsRead = async (conversationId: string): Promise<void> => {
  await apiClient.post(`/messages/conversations/${conversationId}/read`);
};

/**
 * Set typing indicator
 */
export const setTypingIndicator = async (conversationId: string): Promise<void> => {
  await apiClient.post(`/messages/conversations/${conversationId}/typing`);
};

/**
 * Get typing indicators for a conversation
 */
export const getTypingIndicators = async (conversationId: string): Promise<any[]> => {
  const response = await apiClient.get(`/messages/conversations/${conversationId}/typing`);
  return response.data;
};
