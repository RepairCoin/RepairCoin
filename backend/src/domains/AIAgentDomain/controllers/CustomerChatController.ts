// backend/src/domains/AIAgentDomain/controllers/CustomerChatController.ts
//
// POST /api/ai/customer-chat/start — Start a new customer diagnostic chat session
// POST /api/ai/customer-chat/message — Send a message and get AI diagnosis + service recommendations
// POST /api/ai/customer-chat/upload-image — Upload device image for visual diagnosis
//
// Customer-facing AI diagnostic assistant that:
// 1. Understands device issues through conversation
// 2. Analyzes images of damaged devices
// 3. Recommends relevant repair services from the marketplace
// 4. Provides cost estimates and service details
//
// Pipeline:
//   1. Parse request + validate
//   2. Build diagnostic system prompt with marketplace context
//   3. Call Claude with diagnostic tools (search_services, estimate_cost)
//   4. Return AI response + clickable service recommendations
//   5. Track conversation in ai_customer_chat_sessions table

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { ClaudeModel, ChatMessage } from "../types";

const CUSTOMER_CHAT_MODEL: ClaudeModel = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

interface StartChatRequest {
  customerAddress?: string; // Optional - for logged in customers
}

interface SendMessageRequest {
  sessionId: string;
  sessionToken?: string;
  message: string;
}

interface UploadImageRequest {
  sessionId: string;
  sessionToken?: string;
  image: string; // Base64 encoded image
}

interface ServiceRecommendation {
  serviceId: string;
  serviceName: string;
  shopId: string;
  shopName: string;
  price: number;
  rating: number;
  reviewCount: number;
  description: string;
  imageUrl?: string;
  estimatedDuration?: string;
}

interface ChatMessageResponse {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    deviceType?: string;
    damageType?: string;
    estimatedCost?: string;
    services?: ServiceRecommendation[];
    imageUrl?: string;
  };
}

/**
 * Build system prompt for customer diagnostic AI
 */
function buildDiagnosticSystemPrompt(): string {
  return `You are a helpful AI repair assistant for RepairCoin, a device repair marketplace.

Your role:
- Help customers diagnose device issues (phones, laptops, tablets, etc.)
- Ask clarifying questions to understand the problem
- Provide cost estimates when possible
- Recommend relevant repair services from our marketplace

Guidelines:
1. Be friendly, concise, and helpful
2. Ask specific questions about:
   - Device type and model
   - Specific symptoms/damage
   - When the issue started
3. When you have enough info, provide:
   - A brief diagnosis
   - Estimated repair cost range
   - Recommended services
4. Use tools to search for relevant services
5. Keep responses under 150 words

Available repair categories:
- Screen repairs
- Battery replacement
- Water damage repair
- Charging port repair
- Camera repair
- Back glass replacement
- Data recovery
- Software issues
- And more...

Always be empathetic and reassuring. Device issues are stressful!`;
}

/**
 * Search marketplace for relevant services based on diagnosis
 */
async function searchRelevantServices(
  pool: Pool,
  searchQuery: string,
  limit: number = 3
): Promise<ServiceRecommendation[]> {
  try {
    const result = await pool.query(
      `SELECT
        s.service_id,
        s.service_name,
        s.shop_id,
        sh.name as shop_name,
        s.price_usd as price,
        s.description,
        s.image_url,
        s.duration_minutes as estimated_duration,
        COALESCE(s.average_rating, 0) as rating,
        COALESCE(s.review_count, 0) as review_count
       FROM shop_services s
       JOIN shops sh ON sh.shop_id = s.shop_id
       WHERE s.active = true
         AND sh.subscription_active = true
         AND (
           s.service_name ILIKE $1
           OR s.description ILIKE $1
           OR s.tags::text ILIKE $1
         )
       ORDER BY
         COALESCE(s.average_rating, 0) DESC,
         COALESCE(s.review_count, 0) DESC,
         s.price_usd ASC
       LIMIT $2`,
      [`%${searchQuery}%`, limit]
    );

    return result.rows.map(row => {
      // Format duration from minutes to human-readable string
      let duration = '';
      if (row.estimated_duration) {
        const minutes = parseInt(row.estimated_duration, 10);
        if (minutes >= 60) {
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          duration = remainingMinutes > 0
            ? `${hours}h ${remainingMinutes}m`
            : `${hours}h`;
        } else {
          duration = `${minutes}m`;
        }
      }

      return {
        serviceId: row.service_id,
        serviceName: row.service_name,
        shopId: row.shop_id,
        shopName: row.shop_name,
        price: parseFloat(row.price),
        rating: parseFloat(row.rating) || 0,
        reviewCount: parseInt(row.review_count, 10) || 0,
        description: row.description,
        imageUrl: row.image_url,
        estimatedDuration: duration,
      };
    });
  } catch (err) {
    logger.error("searchRelevantServices failed", err);
    return [];
  }
}

/**
 * Create or retrieve customer chat session
 */
async function getOrCreateSession(
  pool: Pool,
  sessionId?: string,
  customerAddress?: string
): Promise<{ id: string; token: string }> {
  if (sessionId) {
    // Validate existing session
    const result = await pool.query(
      `SELECT id, session_token FROM ai_customer_chat_sessions
       WHERE id = $1 AND expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length > 0) {
      return {
        id: result.rows[0].id,
        token: result.rows[0].session_token,
      };
    }
  }

  // Create new session
  const token = generateSessionToken();
  const result = await pool.query(
    `INSERT INTO ai_customer_chat_sessions (
      customer_address,
      session_token,
      expires_at,
      created_at,
      updated_at
    ) VALUES ($1, $2, NOW() + INTERVAL '24 hours', NOW(), NOW())
    RETURNING id, session_token`,
    [customerAddress, token]
  );

  return {
    id: result.rows[0].id,
    token: result.rows[0].session_token,
  };
}

/**
 * Save chat message to database
 */
async function saveChatMessage(
  pool: Pool,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: any
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO ai_customer_chat_messages (
      session_id,
      role,
      content,
      metadata,
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING id`,
    [sessionId, role, content, metadata ? JSON.stringify(metadata) : null]
  );

  return result.rows[0].id;
}

/**
 * Get chat history for session
 */
async function getChatHistory(
  pool: Pool,
  sessionId: string
): Promise<ChatMessage[]> {
  const result = await pool.query(
    `SELECT role, content, metadata, created_at
     FROM ai_customer_chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC
     LIMIT 50`,
    [sessionId]
  );

  return result.rows.map(row => ({
    role: row.role,
    content: row.content,
  }));
}

function generateSessionToken(): string {
  return `tok_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export interface CustomerChatControllerDeps {
  anthropic?: AnthropicClient;
  pool?: Pool;
}

export function makeCustomerChatController(
  deps: CustomerChatControllerDeps = {}
) {
  const pool = deps.pool ?? getSharedPool();
  let anthropic: AnthropicClient | null = deps.anthropic ?? null;

  return {
    /**
     * POST /api/ai/customer-chat/start
     * Start a new diagnostic chat session
     */
    startChat: async (req: Request, res: Response): Promise<void> => {
      try {
        const { customerAddress } = req.body as StartChatRequest;

        // Create session
        const session = await getOrCreateSession(pool, undefined, customerAddress);

        // Generate welcome message
        const welcomeMessage: ChatMessageResponse = {
          id: generateMessageId(),
          sessionId: session.id,
          role: "assistant",
          content: "👋 Hi! I'm your AI repair assistant. Tell me what's wrong with your device, or upload a photo of the damage, and I'll help you find the right repair service and estimate the cost.",
          timestamp: new Date().toISOString(),
        };

        // Save welcome message
        await saveChatMessage(
          pool,
          session.id,
          "assistant",
          welcomeMessage.content
        );

        res.json({
          success: true,
          data: {
            sessionId: session.id,
            sessionToken: session.token,
            message: welcomeMessage,
          },
        });
      } catch (err) {
        logger.error("CustomerChatController.startChat error", err);
        res.status(500).json({
          success: false,
          error: "Failed to start chat session",
        });
      }
    },

    /**
     * POST /api/ai/customer-chat/message
     * Send a message and get AI diagnosis + recommendations
     */
    sendMessage: async (req: Request, res: Response): Promise<void> => {
      try {
        const { sessionId, sessionToken, message } = req.body as SendMessageRequest;

        if (!sessionId || !message?.trim()) {
          res.status(400).json({
            success: false,
            error: "sessionId and message are required",
          });
          return;
        }

        // Validate session
        const session = await getOrCreateSession(pool, sessionId);
        if (session.token !== sessionToken) {
          res.status(401).json({
            success: false,
            error: "Invalid session token",
          });
          return;
        }

        // Save user message
        const userMsgId = await saveChatMessage(pool, sessionId, "user", message);
        const userMessage: ChatMessageResponse = {
          id: userMsgId,
          sessionId,
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        };

        // Get chat history
        const history = await getChatHistory(pool, sessionId);

        // Build system prompt
        const systemPrompt = buildDiagnosticSystemPrompt();

        // Lazy-construct AnthropicClient
        if (!anthropic) anthropic = new AnthropicClient();

        // Call Claude with conversation history
        const claudeMessages: ChatMessage[] = [
          ...history,
          { role: "user", content: message },
        ];

        const response = await anthropic.complete({
          systemPrompt: [{ text: systemPrompt, cache: true }],
          messages: claudeMessages,
          model: CUSTOMER_CHAT_MODEL,
          maxTokens: MAX_TOKENS,
        });

        const aiResponse = response.text;

        // Extract search keywords from the conversation
        // Look for device types, damage types, etc.
        const searchKeywords = extractSearchKeywords(message, aiResponse);

        // Search for relevant services
        let services: ServiceRecommendation[] = [];
        if (searchKeywords) {
          services = await searchRelevantServices(pool, searchKeywords, 3);
        }

        // Enhance response if we found services
        let finalResponse = aiResponse;
        const metadata: any = {};

        if (services.length > 0) {
          finalResponse += `\n\n✅ I found ${services.length} service${services.length > 1 ? 's' : ''} that can help:`;
          metadata.services = services;

          // Add price range if available
          const prices = services.map(s => s.price).filter(p => p > 0);
          if (prices.length > 0) {
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            metadata.estimatedCost = `$${minPrice.toFixed(2)}${minPrice !== maxPrice ? ` - $${maxPrice.toFixed(2)}` : ''}`;
          }
        }

        // Save assistant message
        const assistantMsgId = await saveChatMessage(
          pool,
          sessionId,
          "assistant",
          finalResponse,
          metadata
        );

        const assistantMessage: ChatMessageResponse = {
          id: assistantMsgId,
          sessionId,
          role: "assistant",
          content: finalResponse,
          timestamp: new Date().toISOString(),
          metadata,
        };

        res.json({
          success: true,
          data: {
            userMessage,
            assistantMessage,
          },
        });
      } catch (err) {
        logger.error("CustomerChatController.sendMessage error", err);
        res.status(500).json({
          success: false,
          error: "Failed to process message",
        });
      }
    },

    /**
     * POST /api/ai/customer-chat/upload-image
     * Upload image for visual diagnosis
     */
    uploadImage: async (req: Request, res: Response): Promise<void> => {
      try {
        // TODO: Implement image upload and vision analysis
        // For now, return not implemented
        res.status(501).json({
          success: false,
          error: "Image upload not yet implemented",
        });
      } catch (err) {
        logger.error("CustomerChatController.uploadImage error", err);
        res.status(500).json({
          success: false,
          error: "Failed to process image",
        });
      }
    },
  };
}

/**
 * Extract search keywords from conversation context
 */
function extractSearchKeywords(userMessage: string, aiResponse: string): string | null {
  const combined = `${userMessage} ${aiResponse}`.toLowerCase();

  // Device types
  const deviceTypes = ['phone', 'iphone', 'android', 'samsung', 'laptop', 'macbook', 'tablet', 'ipad', 'watch'];

  // Issue types
  const issueTypes = [
    'screen', 'crack', 'battery', 'charging', 'water damage',
    'camera', 'speaker', 'microphone', 'button', 'port',
    'back glass', 'data recovery', 'software', 'turn on',
    'power', 'display', 'touch'
  ];

  // Find matches
  const foundDevice = deviceTypes.find(type => combined.includes(type));
  const foundIssue = issueTypes.find(issue => combined.includes(issue));

  if (foundIssue) {
    return foundDevice ? `${foundDevice} ${foundIssue}` : foundIssue;
  }

  if (foundDevice) {
    return `${foundDevice} repair`;
  }

  return 'repair'; // Fallback to general repair search
}

// Default singleton controller
let _defaultController: ReturnType<typeof makeCustomerChatController> | null = null;

function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeCustomerChatController();
  }
  return _defaultController;
}

export function startChat(req: Request, res: Response): Promise<void> {
  return getDefaults().startChat(req, res);
}

export function sendMessage(req: Request, res: Response): Promise<void> {
  return getDefaults().sendMessage(req, res);
}

export function uploadImage(req: Request, res: Response): Promise<void> {
  return getDefaults().uploadImage(req, res);
}
