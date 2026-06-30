// backend/src/domains/AIAgentDomain/services/supportTriage.ts
//
// Support Ticket Triage (Admin AI #4).
// Given a support ticket + its conversation, has Claude (Haiku) suggest a
// category, priority, a one-line summary, and a draft reply for the admin.
// Cached per (ticket, message-count) so it refreshes when new messages arrive;
// templated fallback if AI is unavailable. No new table/migration.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { AnthropicClient } from "./AnthropicClient";

const CATEGORIES = ["billing", "technical", "account", "general", "feature_request"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export interface SupportTriage {
  ticketId: string;
  suggestedCategory: (typeof CATEGORIES)[number];
  suggestedPriority: (typeof PRIORITIES)[number];
  summary: string;
  suggestedReply: string;
  generatedAt: string;
}

const cache = new Map<string, SupportTriage>();
let anthropic: AnthropicClient | null = null;
let anthropicTried = false;

function getAnthropic(): AnthropicClient | null {
  if (anthropicTried) return anthropic;
  anthropicTried = true;
  try {
    anthropic = new AnthropicClient();
  } catch {
    anthropic = null;
  }
  return anthropic;
}

export async function getSupportTriage(
  ticketId: string,
  force = false,
  pool: Pool = getSharedPool()
): Promise<SupportTriage | null> {
  const ticketRes = await pool.query(
    `SELECT t.id, t.subject, t.status, t.priority, t.category,
            COALESCE(s.name, '') AS shop_name
       FROM support_tickets t
       LEFT JOIN shops s ON s.shop_id = t.shop_id
      WHERE t.id = $1`,
    [ticketId]
  );
  if (ticketRes.rows.length === 0) return null;
  const ticket = ticketRes.rows[0];

  // Shop-side messages drive triage (admin/internal notes excluded).
  const msgRes = await pool.query<{ sender_type: string; message: string }>(
    `SELECT sender_type, message FROM support_messages
     WHERE ticket_id = $1 AND is_internal = false
     ORDER BY created_at ASC`,
    [ticketId]
  );
  const messages = msgRes.rows;

  const cacheKey = `${ticketId}:${messages.length}`;
  if (!force && cache.has(cacheKey)) return cache.get(cacheKey)!;

  const value = await assess(ticketId, ticket.subject, ticket.shop_name, messages);
  cache.set(cacheKey, value);
  return value;
}

async function assess(
  ticketId: string,
  subject: string,
  shopName: string,
  messages: Array<{ sender_type: string; message: string }>
): Promise<SupportTriage> {
  const convo = messages
    .map((m) => `${m.sender_type === "shop" ? "Shop" : "Admin"}: ${m.message}`)
    .join("\n");

  const ai = getAnthropic();
  if (ai) {
    try {
      const systemPrompt =
        "You triage support tickets for a repair-shop rewards platform. " +
        "FIRST read the ENTIRE conversation carefully and understand the shop's " +
        "specific situation before writing anything. Then respond with STRICT JSON " +
        "only: " +
        '{"category":"billing|technical|account|general|feature_request",' +
        '"priority":"low|medium|high|urgent","summary":"one sentence",' +
        '"reply":"a helpful, professional draft reply the admin can send"}. ' +
        "Urgent = blocked operations or payment failures; low = minor/feature asks. " +
        "The reply MUST be personal and specific to THIS ticket: address the shop by " +
        "name when provided, directly acknowledge the actual issue and any details they " +
        "mentioned (paraphrase their own words), and respond to what they actually said " +
        "— not a generic acknowledgement. If they asked a question, answer it or explain " +
        "the next step. Only ask for more details about specifics they genuinely did not " +
        "provide. Do not invent facts you don't know. Keep it concise, warm, and professional.";
      const shopLine = shopName ? `Shop name: ${shopName}\n` : "";
      const res = await ai.complete({
        systemPrompt: [{ text: systemPrompt, cache: true }],
        messages: [
          {
            role: "user",
            content:
              `${shopLine}Subject: ${subject}\n\n` +
              `Conversation (read all of it before replying):\n${convo || "(no messages yet)"}`,
          },
        ],
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
      });
      const parsed = parseTriage(res.text);
      if (parsed) {
        return { ticketId, ...parsed, generatedAt: new Date().toISOString() };
      }
    } catch (err) {
      logger.warn("Support triage AI failed (using templated):", err);
    }
  }
  return { ticketId, ...templated(subject, convo), generatedAt: new Date().toISOString() };
}

function parseTriage(text: string):
  | Pick<SupportTriage, "suggestedCategory" | "suggestedPriority" | "summary" | "suggestedReply">
  | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]);
    return {
      suggestedCategory: (CATEGORIES as readonly string[]).includes(o.category) ? o.category : "general",
      suggestedPriority: (PRIORITIES as readonly string[]).includes(o.priority) ? o.priority : "medium",
      summary: typeof o.summary === "string" ? o.summary : "",
      suggestedReply: typeof o.reply === "string" ? o.reply : "",
    };
  } catch {
    return null;
  }
}

/** Keyword-based fallback when AI is unavailable. */
function templated(
  subject: string,
  convo: string
): Pick<SupportTriage, "suggestedCategory" | "suggestedPriority" | "summary" | "suggestedReply"> {
  const text = `${subject} ${convo}`.toLowerCase();
  let category: SupportTriage["suggestedCategory"] = "general";
  if (/(bill|payment|charge|invoice|refund|subscription|stripe)/.test(text)) category = "billing";
  else if (/(error|bug|broken|not work|crash|fail|login|can't|cannot)/.test(text)) category = "technical";
  else if (/(account|access|password|wallet|verify|suspend)/.test(text)) category = "account";
  else if (/(feature|request|suggestion|would be nice|add )/.test(text)) category = "feature_request";

  let priority: SupportTriage["suggestedPriority"] = "medium";
  if (/(urgent|asap|immediately|can't operate|down|blocked|payment fail|charged twice)/.test(text)) priority = "urgent";
  else if (/(soon|important|stuck|not work)/.test(text)) priority = "high";
  else if (category === "feature_request") priority = "low";

  return {
    suggestedCategory: category,
    suggestedPriority: priority,
    summary: subject || "Support request",
    suggestedReply:
      "Hi, thanks for reaching out — we've received your request and are looking into it. " +
      "Could you share any additional details (screenshots, timestamps, or the affected shop/order) " +
      "so we can resolve this quickly? We'll follow up shortly.",
  };
}
