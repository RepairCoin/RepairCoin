// frontend/src/services/api/aiHelp.ts
//
// Shop-side How-To Assistant. Backed by POST /api/ai/help.
// See backend:
//   backend/src/domains/AIAgentDomain/controllers/HelpAssistantController.ts
//
// The assistant is grounded strictly in docs/help/*.md (loaded
// server-side at boot). It answers questions about how to use the
// RepairCoin shop dashboard. It declines business-data + non-product
// questions politely.
//
// Multi-turn shape: the caller holds the conversation in local state
// and passes the whole `messages` array (alternating user/assistant,
// starting with user, last message must be user — the new question).

import apiClient from "./client";

export type HelpMessageRole = "user" | "assistant";

export interface HelpMessage {
  role: HelpMessageRole;
  content: string;
}

export interface HelpResponse {
  /** Claude's reply text, ready to display to the shop owner. */
  reply: string;
  /** The model id Claude reported (e.g. `claude-haiku-4-5-20251001`). */
  model: string;
  /**
   * True when the call benefited from Anthropic prompt cache hits on
   * the corpus + guardrail block. Useful for diagnostics but not
   * meaningful UI data — most callers can ignore.
   */
  cached: boolean;
  /** Wall-clock latency the backend observed (ms). */
  latencyMs: number;
}

/**
 * Validation bounds the backend enforces. Exported so the panel UI can
 * pre-check before POSTing (better UX than waiting for a 400).
 */
export const HELP_LIMITS = {
  maxMessages: 20,
  maxContentChars: 4000,
  maxSessionIdChars: 64,
} as const;

/**
 * Ask the How-To Assistant. The same `sessionId` should be reused for
 * every call within one help-panel session — the backend groups audit
 * rows by it so we can measure conversation length / quality later.
 * `crypto.randomUUID()` is a fine source on modern browsers.
 *
 * `messages` must:
 *   - alternate user → assistant → user → … (strict)
 *   - start with `user`
 *   - end with `user` (the new question)
 *   - total ≤ HELP_LIMITS.maxMessages, each content ≤ maxContentChars
 *
 * Errors the panel should be ready to render:
 *   - 401 → shop session expired; nudge re-login.
 *   - 400 → validation failure; the message will say what.
 *   - 429 → AI monthly budget exhausted for this shop.
 *   - 503 → AI service degraded; retry later.
 */
export const askHelp = async (
  sessionId: string,
  messages: HelpMessage[]
): Promise<HelpResponse> => {
  const response = await apiClient.post("/ai/help", { sessionId, messages });
  return response.data.data || response.data;
};

// ----- Help article expansion (Option A: click *Related:* footer to read inline) -----

export interface HelpArticleIndexEntry {
  filename: string;
  title: string;
}

export interface HelpArticleFull extends HelpArticleIndexEntry {
  body: string;
}

/**
 * Fetch the index of every help article (filename + title only — no
 * bodies). Lightweight, called once when the help panel mounts so the
 * UI can resolve titles Claude cited back to filenames.
 */
export const getHelpArticleIndex = async (): Promise<HelpArticleIndexEntry[]> => {
  const response = await apiClient.get("/ai/help/articles");
  return response.data.data || response.data || [];
};

/**
 * Fetch one help article's body. 404 if the filename isn't in the
 * loaded corpus — path-traversal-safe by virtue of the backend's
 * in-memory filename lookup.
 */
export const getHelpArticle = async (
  filename: string
): Promise<HelpArticleFull> => {
  const response = await apiClient.get(
    `/ai/help/articles/${encodeURIComponent(filename)}`
  );
  return response.data.data || response.data;
};
