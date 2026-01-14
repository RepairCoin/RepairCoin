// Conversation from backend API
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

// Message from backend API
export interface Message {
  messageId: string;
  conversationId: string;
  senderAddress: string;
  senderType: "customer" | "shop";
  messageText: string;
  messageType: MessageType;
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

// Message types
export type MessageType =
  | "text"
  | "booking_link"
  | "service_link"
  | "system";

// Request to send a message
export interface SendMessageRequest {
  conversationId?: string;
  customerAddress?: string;
  shopId?: string;
  messageText: string;
  messageType?: MessageType;
  metadata?: Record<string, any>;
}

// Pagination info
export interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

// Response from get conversations
export interface GetConversationsResponse {
  data: Conversation[];
  pagination: PaginationInfo;
}

// Response from get messages
export interface GetMessagesResponse {
  data: Message[];
  pagination: PaginationInfo;
}

// Response from send message
export interface SendMessageResponse {
  data: Message;
}

// Response from get unread count
export interface GetUnreadCountResponse {
  count: number;
}

// Response from mark as read
export interface MarkAsReadResponse {
  message: string;
}
