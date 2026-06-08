/**
 * AI Assistant API Service
 * Handles all API calls for the AI Repair Assistant
 */

import apiClient from './client';
import {
  StartChatRequest,
  StartChatResponse,
  SendMessageRequest,
  SendMessageResponse,
  UploadImageRequest,
  UploadImageResponse,
  GetRecommendationsRequest,
  GetRecommendationsResponse,
  GetChatHistoryResponse,
  ChatMessage,
  ImageAnalysis,
  ServiceRecommendation,
} from '@/types/aiChat';

// Feature flag to use mock data during development
const USE_MOCK_DATA = false; // Backend endpoints are ready!

/**
 * Start a new AI chat session
 */
export const startChatSession = async (
  data: StartChatRequest
): Promise<StartChatResponse> => {
  if (USE_MOCK_DATA) {
    return mockStartChatSession(data);
  }

  const response = await apiClient.post<StartChatResponse>(
    '/ai/customer-chat/start',
    data
  );
  return response.data;
};

/**
 * Send a message to the AI assistant
 */
export const sendMessage = async (
  data: SendMessageRequest
): Promise<SendMessageResponse> => {
  if (USE_MOCK_DATA) {
    return mockSendMessage(data);
  }

  const response = await apiClient.post<SendMessageResponse>(
    '/ai/customer-chat/message',
    data
  );
  return response.data;
};

/**
 * Upload an image for AI analysis
 */
export const uploadImage = async (
  data: UploadImageRequest
): Promise<UploadImageResponse> => {
  if (USE_MOCK_DATA) {
    return mockUploadImage(data);
  }

  const formData = new FormData();
  formData.append('image', data.image);
  formData.append('sessionId', data.sessionId);
  if (data.sessionToken) {
    formData.append('sessionToken', data.sessionToken);
  }

  const response = await apiClient.post<UploadImageResponse>(
    '/ai/customer-chat/upload-image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Get service recommendations based on diagnosis
 */
export const getRecommendations = async (
  data: GetRecommendationsRequest
): Promise<GetRecommendationsResponse> => {
  if (USE_MOCK_DATA) {
    return mockGetRecommendations(data);
  }

  const response = await apiClient.get<GetRecommendationsResponse>(
    '/ai-assistant/chat/recommendations',
    { params: data }
  );
  return response.data;
};

/**
 * Get chat history for a session
 */
export const getChatHistory = async (
  sessionId: string,
  sessionToken?: string
): Promise<GetChatHistoryResponse> => {
  if (USE_MOCK_DATA) {
    return mockGetChatHistory(sessionId);
  }

  const response = await apiClient.get<GetChatHistoryResponse>(
    '/ai-assistant/chat/history',
    { params: { sessionId, sessionToken } }
  );
  return response.data;
};

// ============================================================================
// Mock Data Functions (for development without backend)
// ============================================================================

const generateId = () => Math.random().toString(36).substring(7);

const mockStartChatSession = async (
  data: StartChatRequest
): Promise<StartChatResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

  const sessionId = `session-${generateId()}`;
  const message: ChatMessage = {
    id: `msg-${generateId()}`,
    sessionId,
    role: 'assistant',
    content:
      "Hi! I'm your AI repair assistant. I can help diagnose device issues and find the best repair services for you. What device needs repair?",
    timestamp: new Date().toISOString(),
    metadata: {
      quickActions: [
        { id: 'phone', label: '📱 Phone', value: 'phone' },
        { id: 'laptop', label: '💻 Laptop', value: 'laptop' },
        { id: 'tablet', label: '📱 Tablet', value: 'tablet' },
        { id: 'watch', label: '⌚ Watch', value: 'watch' },
      ],
    },
  };

  return {
    success: true,
    data: {
      sessionId,
      sessionToken: data.customerAddress ? undefined : `token-${generateId()}`,
      message,
    },
  };
};

const mockSendMessage = async (
  data: SendMessageRequest
): Promise<SendMessageResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate AI thinking

  const userMessage: ChatMessage = {
    id: `msg-${generateId()}`,
    sessionId: data.sessionId,
    role: 'user',
    content: data.message,
    timestamp: new Date().toISOString(),
  };

  let assistantContent = '';
  let metadata: any = {};

  // Simple keyword-based responses
  const lowerMessage = data.message.toLowerCase();

  if (lowerMessage.includes('phone') || lowerMessage.includes('iphone')) {
    assistantContent =
      "Got it! You need help with a phone. Can you tell me what's wrong with it, or upload a photo for instant diagnosis?";
    metadata = {
      showImageUpload: true,
    };
  } else if (lowerMessage.includes('screen') || lowerMessage.includes('crack')) {
    assistantContent =
      "A cracked screen - that's one of the most common issues! To give you an accurate estimate, could you upload a photo of the damage?";
    metadata = {
      showImageUpload: true,
    };
  } else if (lowerMessage.includes('battery')) {
    assistantContent =
      "Battery issues can be tricky. Is your battery draining quickly, or is the device not charging? Also, what device model do you have?";
  } else if (lowerMessage.includes('laptop')) {
    assistantContent =
      "I can help with your laptop! What seems to be the problem? Common issues include screen damage, battery problems, or won't turn on.";
  } else {
    assistantContent =
      "Thanks for sharing that! To help you better, could you provide more details or upload a photo of the issue?";
    metadata = {
      showImageUpload: true,
    };
  }

  const assistantMessage: ChatMessage = {
    id: `msg-${generateId()}`,
    sessionId: data.sessionId,
    role: 'assistant',
    content: assistantContent,
    timestamp: new Date().toISOString(),
    metadata,
  };

  return {
    success: true,
    data: {
      userMessage,
      assistantMessage,
    },
  };
};

const mockUploadImage = async (
  data: UploadImageRequest
): Promise<UploadImageResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate image processing

  const imageUrl = URL.createObjectURL(data.image);

  const analysis: ImageAnalysis = {
    deviceType: 'phone',
    deviceModel: 'iPhone 13',
    damageType: 'cracked_screen',
    severity: 'moderate',
    severityScore: 6,
    confidence: 0.92,
    diagnosis:
      'Cracked front screen with moderate damage extending from top-left corner. No visible LCD damage. Touchscreen likely still functional.',
    estimatedCost: {
      min: 80,
      max: 120,
      currency: 'USD',
    },
    additionalIssues: ['Minor scratches on camera lens'],
    repairability: 'economical',
  };

  const assistantMessage: ChatMessage = {
    id: `msg-${generateId()}`,
    sessionId: data.sessionId,
    role: 'assistant',
    content: `✅ Analysis complete!\n\n📊 **Diagnosis:**\n• ${analysis.damageType.replace('_', ' ')}\n• Severity: ${analysis.severity} (${analysis.severityScore}/10)\n• ${analysis.diagnosis}\n\n💰 **Estimated Cost:** $${analysis.estimatedCost.min} - $${analysis.estimatedCost.max}\n\nI found 3 shops nearby that can fix this. Would you like to see them?`,
    timestamp: new Date().toISOString(),
    metadata: {
      showServiceRecommendations: true,
      analysis,
      imageUrl,
    },
  };

  return {
    success: true,
    data: {
      imageId: `img-${generateId()}`,
      imageUrl,
      analysis,
      assistantMessage,
    },
  };
};

const mockGetRecommendations = async (
  data: GetRecommendationsRequest
): Promise<GetRecommendationsResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const recommendations: ServiceRecommendation[] = [
    {
      serviceId: 'service-1',
      serviceName: 'iPhone Screen Replacement',
      shopId: 'techfix',
      shopName: 'TechFix',
      price: 95.0,
      rating: 4.8,
      reviewCount: 127,
      distance: 0.5,
      distanceUnit: 'mi',
      estimatedDuration: '30-60 minutes',
      matchReason: 'Exact match for iPhone screen repair',
    },
    {
      serviceId: 'service-2',
      serviceName: 'Screen Repair - All Models',
      shopId: 'quickrepair',
      shopName: 'QuickRepair',
      price: 110.0,
      rating: 4.9,
      reviewCount: 89,
      distance: 1.2,
      distanceUnit: 'mi',
      estimatedDuration: '45 minutes',
      matchReason: 'Highly rated for screen repairs',
    },
    {
      serviceId: 'service-3',
      serviceName: 'iPhone 13 Screen Fix',
      shopId: 'repairpro',
      shopName: 'RepairPro',
      price: 100.0,
      rating: 4.7,
      reviewCount: 201,
      distance: 2.1,
      distanceUnit: 'mi',
      estimatedDuration: '1 hour',
      matchReason: 'Specializes in iPhone 13 repairs',
    },
  ];

  return {
    success: true,
    data: {
      recommendations,
      totalMatches: recommendations.length,
    },
  };
};

const mockGetChatHistory = async (
  sessionId: string
): Promise<GetChatHistoryResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    success: true,
    data: {
      sessionId,
      messages: [], // Will be populated from localStorage
    },
  };
};
