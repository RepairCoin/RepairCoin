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
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
  // Joined data
  customerName?: string;
  customerImageUrl?: string;
  shopName?: string;
  shopImageUrl?: string;
}

// Attachment type for messages
export interface MessageAttachment {
  type: "image" | "file";
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

// Message from backend API
export interface Message {
  messageId: string;
  conversationId: string;
  senderAddress: string;
  senderType: "customer" | "shop";
  messageText: string;
  messageType: MessageType;
  attachments: MessageAttachment[];
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
  attachments?: MessageAttachment[];
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

// Response from start conversation
export interface StartConversationResponse {
  data: Conversation;
}

// Response from get or create conversation
export interface GetOrCreateConversationResponse {
  success: boolean;
  data: Conversation;
  created: boolean;
}

// Quick Reply interfaces
export interface QuickReply {
  id: string;
  shopId: string;
  title: string;
  content: string;
  category?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuickReplyRequest {
  title: string;
  content: string;
  category?: string;
}

export interface UpdateQuickReplyRequest {
  title?: string;
  content?: string;
  category?: string;
}

export interface GetQuickRepliesResponse {
  success: boolean;
  data: QuickReply[];
}

export interface QuickReplyResponse {
  success: boolean;
  data: QuickReply;
}

// Auto-Message interfaces
export type AutoMessageTriggerType = "schedule" | "event";
export type AutoMessageScheduleType = "daily" | "weekly" | "monthly";
export type AutoMessageEventType =
  | "booking_completed"
  | "booking_cancelled"
  | "first_visit"
  | "inactive_30_days";
export type AutoMessageTargetAudience =
  | "all"
  | "active"
  | "inactive_30d"
  | "has_balance"
  | "completed_booking";

export interface AutoMessage {
  id: string;
  shopId: string;
  name: string;
  triggerType: AutoMessageTriggerType;
  scheduleType?: AutoMessageScheduleType;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  scheduleHour?: number;
  eventType?: AutoMessageEventType;
  delayHours?: number;
  targetAudience: AutoMessageTargetAudience;
  messageTemplate: string;
  maxSendsPerCustomer?: number;
  isEnabled: boolean;
  totalSent: number;
  lastSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutoMessageRequest {
  name: string;
  triggerType: AutoMessageTriggerType;
  messageTemplate: string;
  scheduleType?: AutoMessageScheduleType;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  scheduleHour?: number;
  eventType?: AutoMessageEventType;
  delayHours?: number;
  targetAudience?: AutoMessageTargetAudience;
  maxSendsPerCustomer?: number;
}

export interface UpdateAutoMessageRequest {
  name?: string;
  triggerType?: AutoMessageTriggerType;
  messageTemplate?: string;
  scheduleType?: AutoMessageScheduleType;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  scheduleHour?: number;
  eventType?: AutoMessageEventType;
  delayHours?: number;
  targetAudience?: AutoMessageTargetAudience;
  maxSendsPerCustomer?: number;
}

export interface AutoMessageHistory {
  id: string;
  autoMessageId: string;
  customerAddress: string;
  customerName?: string;
  sentAt: string;
  status: "sent" | "delivered" | "failed";
}

export interface GetAutoMessagesResponse {
  success: boolean;
  data: AutoMessage[];
}

export interface AutoMessageResponse {
  success: boolean;
  data: AutoMessage;
}

export interface GetAutoMessageHistoryResponse {
  success: boolean;
  data: AutoMessageHistory[];
  pagination: PaginationInfo;
}
