// Re-export all message interfaces from their canonical location
export type {
  Conversation,
  Message,
  MessageAttachment,
  MessageType,
  SendMessageRequest,
  PaginationInfo,
  GetConversationsResponse,
  GetMessagesResponse,
  SendMessageResponse,
  GetUnreadCountResponse,
  MarkAsReadResponse,
  StartConversationResponse,
} from "./services/message.interface";
