// backend/src/domains/AIAgentDomain/controllers/FaqSuggestionController.ts
//
// POST /api/ai/services/:serviceId/faq-suggestions — AI-suggested FAQ
// entries for a service. See docs/tasks/strategy/ai-sales-agent/ai-suggested-faq.md.
//
// The shop clicks "Suggest FAQs" in the service's AI panel; this returns a
// handful of candidate { question, answer } pairs. They are DRAFTS — the
// shop reviews, edits, and explicitly adds them; nothing here saves.
//
// Critical guardrail: FAQ answers are quoted verbatim to customers by
// PromptTemplates. So the prompt instructs Claude to:
//   - suggest QUESTIONS freely (predicting what customers ask is low-risk),
//   - draft ANSWERS only from the service description, and leave the answer
//     EMPTY when the description doesn't cover it — never invent a price,
//     policy, or detail.
//
// Auth: shop owner of the service, or admin. Cost: one Haiku call, charged
// against the shop's monthly AI budget via SpendCapEnforcer.

import { Request, Response } from "express";
import { ServiceRepository } from "../../../repositories/ServiceRepository";
import { ServiceAIFaqRepository } from "../../../repositories/ServiceAIFaqRepository";
import { AnthropicClient } from "../services/AnthropicClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { logger } from "../../../utils/logger";
import { ClaudeModel } from "../types";
import { cheapModel } from "../../../config/aiModels";

const SUGGEST_MODEL: ClaudeModel = cheapModel();
const SUGGEST_MAX_TOKENS = 1100;
const SUGGESTION_COUNT = 6;
const MAX_QUESTION_LEN = 200;
const MAX_ANSWER_LEN = 600;
const MAX_HINT_LEN = 200;
/** Cap on shop-pasted source material — keeps the prompt cost bounded. */
const MAX_SOURCE_TEXT_LEN = 4000;
/** Cap on a live-description override (the form field itself caps at 200). */
const MAX_DESCRIPTION_LEN = 2000;

export interface FaqSuggestion {
  question: string;
  /** AI-drafted answer — empty when the description didn't support one. */
  answer: string;
  /**
   * A one-line "what to write here" guide for the shop owner. Always
   * produced by the AI; surfaced in the UI when the answer is blank, so a
   * blank answer is a guided fill-in rather than an empty box.
   */
  answerHint: string;
}

/**
 * Parse Claude's reply into clean FAQ suggestions. Pure — exported for unit
 * testing. Tolerant: extracts the first JSON array even if Claude wraps it
 * in ```json fences or surrounding prose. Returns [] on any malformed output
 * rather than throwing — a bad model response should yield "no suggestions",
 * never a 500.
 */
export function parseFaqSuggestions(text: string): FaqSuggestion[] {
  if (!text || typeof text !== "string") return [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: FaqSuggestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const q = typeof (item as any).question === "string" ? (item as any).question.trim() : "";
    const a = typeof (item as any).answer === "string" ? (item as any).answer.trim() : "";
    const h = typeof (item as any).answerHint === "string" ? (item as any).answerHint.trim() : "";
    if (!q) continue; // a suggestion with no question is useless
    out.push({
      question: q.slice(0, MAX_QUESTION_LEN),
      answer: a.slice(0, MAX_ANSWER_LEN),
      answerHint: h.slice(0, MAX_HINT_LEN),
    });
    if (out.length >= SUGGESTION_COUNT) break;
  }
  return out;
}

/** Build the Haiku system prompt for FAQ suggestion. */
function buildSuggestPrompt(args: {
  serviceName: string;
  description: string;
  category: string;
  existingQuestions: string[];
  /** Optional extra material the shop pasted in to draft answers from. */
  sourceText?: string;
}): string {
  const { serviceName, description, category, existingQuestions, sourceText } = args;
  const existingBlock =
    existingQuestions.length > 0
      ? `\n\nThe shop has ALREADY added FAQ entries for these questions — do NOT suggest these or close paraphrases of them:\n${existingQuestions.map((q) => `- ${q}`).join("\n")}`
      : "";
  const sourceBlock = sourceText
    ? `\n\nADDITIONAL SOURCE MATERIAL (pasted in by the shop — notes / website copy / etc. Treat this as factual source material you may also draft answers from, exactly like the Description):\n${sourceText}`
    : "";

  return `You help a shop owner write FAQ entries for one of their services. These FAQ answers are shown WORD-FOR-WORD to real customers, so accuracy is critical.

SERVICE
Name: ${serviceName}
Category: ${category}
Description: ${description || "(no description provided)"}${sourceBlock}${existingBlock}

YOUR TASK
Suggest up to ${SUGGESTION_COUNT} NEW, distinct FAQ entries — common questions a customer would ask about THIS service.

HARD RULES
- NEVER suggest a question about price, cost, payment amount, deposit, or how long the appointment takes. The service already has dedicated price and duration fields and the system surfaces those to customers automatically. A FAQ copy of them would go stale and contradict the real field the moment the shop edits it.
- Focus on questions that have NO dedicated field: what's included / not included, what to bring or prepare, who the service is suitable for, the process and what to expect, results, and the cancellation or reschedule policy.
- "question": a natural question a real customer would ask about this service. Suggest these confidently.
- "answer": write the answer ONLY using facts in the Description (and the Additional Source Material, if any) above. If those do not contain the information needed to answer accurately, set "answer" to an empty string "" — leave it for the shop owner to fill in. NEVER invent or guess a policy, guarantee, or any detail not stated above.
- "answerHint": ALWAYS provide this — a short one-line guide telling the shop owner what to write in the answer (the specific fact the question needs). It is shown to the shop as a prompt, NOT to customers. Example: for "Is it suitable for sensitive skin?" → "State which skin types this is safe for." Keep it under 15 words.
- Do not repeat any already-covered question listed above.
- Keep questions under 20 words and answers under 60 words.

OUTPUT
Reply with ONLY a JSON array, no prose and no markdown fences. Each element:
  {"question": "...", "answer": "...", "answerHint": "..."}
If you cannot suggest anything useful, reply with [].`.trim();
}

export interface FaqSuggestionControllerDeps {
  serviceRepo?: ServiceRepository;
  faqRepo?: ServiceAIFaqRepository;
  anthropicClient?: AnthropicClient;
  spendCapEnforcer?: SpendCapEnforcer;
}

/**
 * Factory: returns the Express handler for POST
 * /api/ai/services/:serviceId/faq-suggestions. Tests inject mocked deps.
 */
export function makeFaqSuggestionController(deps: FaqSuggestionControllerDeps = {}) {
  const serviceRepo = deps.serviceRepo ?? new ServiceRepository();
  const faqRepo = deps.faqRepo ?? new ServiceAIFaqRepository();
  const client = deps.anthropicClient ?? new AnthropicClient();
  const spendCapEnforcer = deps.spendCapEnforcer ?? new SpendCapEnforcer();

  return async function suggestFaqs(req: Request, res: Response): Promise<void> {
    try {
      const serviceId = req.params?.serviceId;
      if (!serviceId) {
        res.status(400).json({ success: false, error: "serviceId is required" });
        return;
      }

      const service = await serviceRepo.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: "Service not found" });
        return;
      }

      // Auth: the shop that owns this service, or an admin.
      const userRole = (req as any).user?.role;
      const userShopId = (req as any).user?.shopId;
      const isAdmin = userRole === "admin";
      const isOwnerShop = userRole === "shop" && userShopId === service.shopId;
      if (!isAdmin && !isOwnerShop) {
        res.status(403).json({
          success: false,
          error: "Only the shop that owns this service or an admin can suggest FAQs",
        });
        return;
      }

      // Budget — config-time call, but still a Claude call, so it counts.
      const spendCheck = await spendCapEnforcer.canSpend(service.shopId);
      if (!spendCheck.allowed) {
        res.json({ success: true, data: { suggestions: [], overBudget: true } });
        return;
      }

      // Existing FAQ questions — fed to the prompt AND used to post-filter,
      // so a question the shop already has is never re-suggested.
      const existing = await faqRepo.getEntriesForService(serviceId);
      const existingQuestions = existing.map((e) => e.question);

      // Optional material the shop pasted in (notes, website copy). Trimmed
      // and length-capped so the prompt stays bounded.
      const rawSource = (req.body as any)?.sourceText;
      const sourceText =
        typeof rawSource === "string"
          ? rawSource.trim().slice(0, MAX_SOURCE_TEXT_LEN)
          : "";

      // Optional live description from the service edit form. The shop may
      // have edited the description but not yet saved it — prefer that
      // in-progress text over the stale DB value so "add detail to your
      // description" actually takes effect without a save-first dance.
      const rawDescription = (req.body as any)?.description;
      const description =
        typeof rawDescription === "string" && rawDescription.trim()
          ? rawDescription.trim().slice(0, MAX_DESCRIPTION_LEN)
          : service.description ?? "";

      const systemPrompt = buildSuggestPrompt({
        serviceName: service.serviceName,
        description,
        category: service.category ?? "general",
        existingQuestions,
        sourceText,
      });

      const response = await client.complete({
        systemPrompt: [{ text: systemPrompt, cache: false }],
        messages: [{ role: "user", content: "(suggest the FAQ entries now)" }],
        model: SUGGEST_MODEL,
        maxTokens: SUGGEST_MAX_TOKENS,
      });

      // Record spend regardless of how parseable the output was — the call
      // was made and billed. FAQ suggestions have no cost table of their own, so the `ledger`
      // entry is what makes this spend visible to ai_usage_events (the spend cap's source).
      await spendCapEnforcer.recordSpend(service.shopId, response.costUsd, {
        feature: "faq_suggestion",
        vendor: "anthropic",
        model: SUGGEST_MODEL,
        metadata: { serviceId: service.serviceId },
      });

      const suggestions = parseFaqSuggestions(response.text);

      // Belt-and-suspenders dedup: drop anything that matches an existing
      // question case-insensitively, even though the prompt already asked
      // Claude not to repeat.
      const existingLower = new Set(
        existingQuestions.map((q) => q.toLowerCase().trim())
      );
      const deduped = suggestions.filter(
        (s) => !existingLower.has(s.question.toLowerCase().trim())
      );

      res.json({
        success: true,
        data: { suggestions: deduped, overBudget: false },
      });
    } catch (err: any) {
      logger.error("FAQ suggestion failed", err);
      const status = err?.status === 429 ? 429 : 500;
      res.status(status).json({
        success: false,
        error:
          status === 429
            ? "Anthropic rate limit hit — try again in a moment"
            : "Failed to generate FAQ suggestions",
      });
    }
  };
}

// Lazy default handler — avoids requiring ANTHROPIC_API_KEY at module load.
let _defaultHandler: ReturnType<typeof makeFaqSuggestionController> | null = null;
export function suggestServiceFaqs(req: Request, res: Response): Promise<void> {
  if (!_defaultHandler) _defaultHandler = makeFaqSuggestionController();
  return _defaultHandler(req, res);
}
