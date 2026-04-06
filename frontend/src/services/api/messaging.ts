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

export interface MessageAttachment {
  url: string;
  key: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  mimetype: string;
}

export interface SendMessageRequest {
  conversationId?: string;
  customerAddress?: string;
  shopId?: string;
  messageText: string;
  messageType?: 'text' | 'booking_link' | 'service_link' | 'system';
  metadata?: Record<string, any>;
  attachments?: MessageAttachment[];
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
 * Upload message attachments (images or PDF, up to 5 files, 5MB each)
 */
export const uploadAttachments = async (files: File[]): Promise<MessageAttachment[]> => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const response = await apiClient.post('/messages/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Get or create a conversation with a customer (shop only)
 */
export const getOrCreateConversation = async (customerAddress: string): Promise<Conversation> => {
  const response = await apiClient.post('/messages/conversations/get-or-create', { customerAddress });
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
 * Get total unread message count for the authenticated user
 * Uses lightweight endpoint instead of fetching all conversations
 */
export const getUnreadCount = async (): Promise<number> => {
  const response = await apiClient.get<{success: boolean; count: number}>('/messages/unread/count');
  return response.count;
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
 * Archive (resolve) or reopen a conversation
 */
export const archiveConversation = async (conversationId: string, archived: boolean): Promise<void> => {
  await apiClient.patch(`/messages/conversations/${conversationId}/archive`, { archived });
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

// ============ Quick Replies ============

export interface QuickReply {
  id: string;
  shopId: string;
  title: string;
  content: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all quick replies for the authenticated shop
 */
export const getQuickReplies = async (): Promise<QuickReply[]> => {
  const response = await apiClient.get('/messages/quick-replies');
  return response.data;
};

/**
 * Create a new quick reply
 */
export const createQuickReply = async (data: {
  title: string;
  content: string;
  category?: string;
}): Promise<QuickReply> => {
  const response = await apiClient.post('/messages/quick-replies', data);
  return response.data;
};

/**
 * Update an existing quick reply
 */
export const updateQuickReply = async (
  id: string,
  data: { title?: string; content?: string; category?: string }
): Promise<QuickReply> => {
  const response = await apiClient.put(`/messages/quick-replies/${id}`, data);
  return response.data;
};

/**
 * Delete a quick reply
 */
export const deleteQuickReply = async (id: string): Promise<void> => {
  await apiClient.delete(`/messages/quick-replies/${id}`);
};

/**
 * Increment usage count when a quick reply is sent
 */
export const useQuickReply = async (id: string): Promise<void> => {
  await apiClient.post(`/messages/quick-replies/${id}/use`);
};

// ============ Auto-Messages ============

export interface AutoMessage {
  id: string;
  shopId: string;
  name: string;
  messageTemplate: string;
  triggerType: 'schedule' | 'event';
  scheduleType: string | null;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  scheduleHour: number;
  eventType: string | null;
  delayHours: number;
  targetAudience: string;
  isActive: boolean;
  maxSendsPerCustomer: number;
  createdAt: string;
  updatedAt: string;
  totalSends?: number;
  lastSentAt?: string;
}

export interface AutoMessageSend {
  id: string;
  autoMessageId: string;
  shopId: string;
  customerAddress: string;
  conversationId: string | null;
  messageId: string | null;
  triggerReference: string | null;
  status: 'pending' | 'sent' | 'failed';
  scheduledSendAt: string | null;
  sentAt: string;
}

export interface CreateAutoMessageRequest {
  name: string;
  messageTemplate: string;
  triggerType: 'schedule' | 'event';
  scheduleType?: string;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  scheduleHour?: number;
  eventType?: string;
  delayHours?: number;
  targetAudience?: string;
  maxSendsPerCustomer?: number;
}

export interface UpdateAutoMessageRequest {
  name?: string;
  messageTemplate?: string;
  triggerType?: 'schedule' | 'event';
  scheduleType?: string;
  scheduleDayOfWeek?: number | null;
  scheduleDayOfMonth?: number | null;
  scheduleHour?: number;
  eventType?: string | null;
  delayHours?: number;
  targetAudience?: string;
  maxSendsPerCustomer?: number;
}

/**
 * Get all auto-message rules for the authenticated shop
 */
export const getAutoMessages = async (): Promise<AutoMessage[]> => {
  const response = await apiClient.get('/messages/auto-messages');
  return response.data;
};

/**
 * Create a new auto-message rule
 */
export const createAutoMessage = async (data: CreateAutoMessageRequest): Promise<AutoMessage> => {
  const response = await apiClient.post('/messages/auto-messages', data);
  return response.data;
};

/**
 * Update an existing auto-message rule
 */
export const updateAutoMessage = async (id: string, data: UpdateAutoMessageRequest): Promise<AutoMessage> => {
  const response = await apiClient.put(`/messages/auto-messages/${id}`, data);
  return response.data;
};

/**
 * Delete an auto-message rule
 */
export const deleteAutoMessage = async (id: string): Promise<void> => {
  await apiClient.delete(`/messages/auto-messages/${id}`);
};

/**
 * Toggle active/inactive status of an auto-message rule
 */
export const toggleAutoMessage = async (id: string): Promise<AutoMessage> => {
  const response = await apiClient.patch(`/messages/auto-messages/${id}/toggle`);
  return response.data;
};

/**
 * Get send history for an auto-message rule
 */
export const getAutoMessageHistory = async (
  id: string,
  options?: { page?: number; limit?: number }
): Promise<PaginatedResponse<AutoMessageSend>> => {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await apiClient.get(`/messages/auto-messages/${id}/history?${params.toString()}`);
  return {
    data: response.data,
    pagination: response.pagination,
  };
};
