/**
 * AI Chat Assistant - TypeScript Type Definitions
 */

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  showImageUpload?: boolean;
  showServiceRecommendations?: boolean;
  quickActions?: QuickAction[];
  imageUrl?: string;
  analysis?: ImageAnalysis;
  recommendations?: ServiceRecommendation[];
  services?: ServiceRecommendation[]; // AI-recommended services
  estimatedCost?: string; // Cost range as formatted string
  deviceType?: string;
  damageType?: string;
  recommendedServices?: string[]; // Legacy field
}

export interface QuickAction {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

export interface ImageAnalysis {
  deviceType: string;
  deviceModel?: string;
  damageType: string;
  severity: 'minor' | 'moderate' | 'severe';
  severityScore: number; // 1-10
  confidence: number; // 0-1
  diagnosis: string;
  estimatedCost: {
    min: number;
    max: number;
    currency: string;
  };
  additionalIssues?: string[];
  repairability: 'economical' | 'borderline' | 'not_recommended';
}

export interface ServiceRecommendation {
  serviceId: string;
  serviceName: string;
  shopId: string;
  shopName: string;
  price: number;
  rating: number;
  reviewCount: number;
  distance?: number;
  distanceUnit?: string;
  estimatedDuration?: string;
  imageUrl?: string;
  description?: string;
  matchReason?: string;
}

export interface ChatSession {
  id: string;
  sessionToken?: string; // For guest users
  customerAddress?: string;
  deviceType?: string;
  deviceModel?: string;
  issueDescription?: string;
  diagnosis?: ImageAnalysis;
  estimatedCostMin?: number;
  estimatedCostMax?: number;
  recommendedServices?: string[];
  status: 'active' | 'converted' | 'abandoned';
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

/**
 * A single persisted conversation thread. Kept entirely client-side
 * (localStorage) so customers can flip between their recent chats via the
 * tab strip. Intentionally lightweight — we cap the number we retain.
 */
export interface ChatThread {
  id: string; // mirrors the session id
  title: string;
  session: ChatSession;
  messages: ChatMessage[];
  createdAt: string;
  lastActivityAt: string;
}

export interface UploadedImage {
  id: string;
  sessionId: string;
  messageId: string;
  originalFilename: string;
  storageUrl: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  analysis?: ImageAnalysis;
  damageDetected: boolean;
  damageSeverity?: 'minor' | 'moderate' | 'severe';
  confidenceScore?: number;
  createdAt: string;
}

// API Request/Response types
export interface StartChatRequest {
  customerAddress?: string;
  initialMessage?: string;
}

export interface StartChatResponse {
  success: boolean;
  data: {
    sessionId: string;
    sessionToken?: string;
    message: ChatMessage;
  };
}

export interface SendMessageRequest {
  sessionId: string;
  sessionToken?: string;
  message: string;
  quickAction?: string;
}

export interface SendMessageResponse {
  success: boolean;
  data: {
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  };
}

export interface UploadImageRequest {
  sessionId: string;
  sessionToken?: string;
  image: File;
}

export interface UploadImageResponse {
  success: boolean;
  data: {
    imageId: string;
    imageUrl: string;
    analysis: ImageAnalysis;
    assistantMessage: ChatMessage;
  };
}

export interface GetRecommendationsRequest {
  sessionId: string;
  sessionToken?: string;
  latitude?: number;
  longitude?: number;
}

export interface GetRecommendationsResponse {
  success: boolean;
  data: {
    recommendations: ServiceRecommendation[];
    totalMatches: number;
  };
}

export interface GetChatHistoryResponse {
  success: boolean;
  data: {
    sessionId: string;
    messages: ChatMessage[];
  };
}

// Chat Widget State types
export interface ChatWidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  hasUnreadMessages: boolean;
  unreadCount: number;
  session: ChatSession | null;
  messages: ChatMessage[];
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;
}

// Analytics Event types
export enum AIChatAnalyticsEvent {
  SESSION_STARTED = 'ai_chat_session_started',
  WIDGET_OPENED = 'ai_chat_widget_opened',
  WIDGET_CLOSED = 'ai_chat_widget_closed',
  MESSAGE_SENT = 'ai_chat_message_sent',
  IMAGE_UPLOADED = 'ai_chat_image_uploaded',
  QUICK_ACTION_CLICKED = 'ai_chat_quick_action_clicked',
  RECOMMENDATIONS_VIEWED = 'ai_chat_recommendations_viewed',
  SERVICE_CLICKED = 'ai_chat_service_clicked',
  BOOKING_STARTED = 'ai_chat_booking_started',
  SESSION_ABANDONED = 'ai_chat_session_abandoned',
}

export interface AIChatAnalyticsEventData {
  event: AIChatAnalyticsEvent;
  sessionId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
