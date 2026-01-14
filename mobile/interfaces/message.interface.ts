// Conversation participant info
export interface ConversationParticipant {
  address: string;
  name: string;
  type: "customer" | "shop";
  avatar?: string;
}

// Conversation summary for list view
export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

// Individual message
export interface Message {
  id: string;
  conversationId: string;
  senderAddress: string;
  senderType: "customer" | "shop";
  content: string;
  messageType: MessageType;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

// Message types
export type MessageType =
  | "text"
  | "image"
  | "booking_inquiry"
  | "booking_update"
  | "system";

// Request to send a message
export interface SendMessageRequest {
  conversationId?: string;
  recipientAddress?: string;
  content: string;
  messageType?: MessageType;
  metadata?: Record<string, any>;
}

// Response from get conversations
export interface GetConversationsResponse {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Response from get messages
export interface GetMessagesResponse {
  messages: Message[];
  conversation: Conversation;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Response from send message
export interface SendMessageResponse {
  message: Message;
  conversation: Conversation;
}

// Response from get unread count
export interface GetUnreadCountResponse {
  count: number;
}

// Response from mark as read
export interface MarkAsReadResponse {
  message: string;
  readCount: number;
}

// Response for starting a new conversation
export interface StartConversationResponse {
  conversation: Conversation;
}
