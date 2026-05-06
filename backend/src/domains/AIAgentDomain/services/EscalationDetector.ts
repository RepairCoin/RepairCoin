// backend/src/domains/AIAgentDomain/services/EscalationDetector.ts
//
// Heuristic-only escalation detection for Phase 3 MVP. Returns true when the
// AI should bow out and let a human take over.
//
// Three signals:
//   1. Keyword match — customer typed "human", "agent", "real person", "stop", etc.
//   2. AI reply count threshold — too many back-and-forths means the AI isn't helping.
//   3. (Phase 4) confused-pattern detection via LLM classifier
//
// Design intent: prefer over-escalation to under-escalation. Wrong escalation
// = lost AI conversation cost (annoying but recoverable). Wrong continuation
// = customer gets frustrated and stops trusting the system. Phase 4 will
// replace this with a Claude-driven classifier; for MVP, simple keyword
// matching is fine.

import { AgentMessageContext, EscalationDecision } from "../types";

/**
 * Phrases that explicitly signal "I want a human." Stored lowercase; matching
 * is case-insensitive against the customer's message.
 *
 * Some are full phrases ("real person") because matching just "real" would
 * over-trigger ("really?", "real quick"). Others are single words ("human")
 * where the false-positive risk is low.
 */
const HUMAN_HANDOFF_PHRASES = [
  "talk to a human",
  "real person",
  "real human",
  "real agent",
  "speak to someone",
  "speak to a person",
  "speak to a human",
  "speak with someone",
  "stop the bot",
  "stop the ai",
  "i want a human",
  "i need a human",
  "get me a human",
  "get a human",
  "human please",
  "is this a bot",
  "are you a bot",
  "are you human",
  "are you a real person",
];

/**
 * Single-word triggers — used with word-boundary matching to avoid
 * over-triggering on common substrings.
 */
const HUMAN_HANDOFF_KEYWORDS = ["human", "agent", "manager", "owner"];

const STOP_KEYWORDS = ["stop", "cancel"];

export class EscalationDetector {
  /**
   * Decide whether to skip the AI reply and route this conversation to a
   * human.
   *
   * @param customerMessage  the message the customer just sent
   * @param history          prior conversation messages (oldest-first)
   * @param escalationThreshold  shop-configured max consecutive AI replies
   *                             (from ai_shop_settings.escalation_threshold,
   *                             default 5)
   */
  shouldEscalate(
    customerMessage: string,
    history: AgentMessageContext[],
    escalationThreshold: number = 5
  ): EscalationDecision {
    const normalized = customerMessage.toLowerCase().trim();

    // 1. Phrase match — most reliable signal
    for (const phrase of HUMAN_HANDOFF_PHRASES) {
      if (normalized.includes(phrase)) {
        return {
          shouldEscalate: true,
          reason: `customer_requested_human:phrase:${phrase}`,
        };
      }
    }

    // 2. Single-word match with word boundary
    for (const keyword of HUMAN_HANDOFF_KEYWORDS) {
      if (matchesWord(normalized, keyword)) {
        return {
          shouldEscalate: true,
          reason: `customer_requested_human:keyword:${keyword}`,
        };
      }
    }

    // 3. "stop"/"cancel" — escalation only when it appears alone or near the
    //    front of the message. "Stop talking" yes, "I'd like the stop sign
    //    feature" no.
    for (const keyword of STOP_KEYWORDS) {
      if (matchesAtStart(normalized, keyword)) {
        return {
          shouldEscalate: true,
          reason: `customer_requested_stop:${keyword}`,
        };
      }
    }

    // 4. Reply-count threshold — count consecutive AI replies in history.
    //    If the customer has already received N AI replies in a row without
    //    successful resolution, escalate.
    const consecutiveAIReplies = countTrailingAssistantMessages(history);
    if (consecutiveAIReplies >= escalationThreshold) {
      return {
        shouldEscalate: true,
        reason: `consecutive_ai_replies:${consecutiveAIReplies}`,
      };
    }

    return { shouldEscalate: false };
  }
}

/**
 * Word-boundary match. "human?" matches, "humanitarian" doesn't.
 */
function matchesWord(text: string, word: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  return re.test(text);
}

/**
 * Match keyword at the start of the message (allowing leading punctuation
 * like "stop." or "stop!"). Avoids matching "stop" buried mid-sentence.
 */
function matchesAtStart(text: string, word: string): boolean {
  const re = new RegExp(`^${escapeRegExp(word)}\\b`, "i");
  return re.test(text.trim());
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Count assistant messages at the trailing end of the history array. Stops
 * counting at the first user message encountered while walking backward.
 */
function countTrailingAssistantMessages(history: AgentMessageContext[]): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export const escalationDetector = new EscalationDetector();
