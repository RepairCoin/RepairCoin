// backend/src/domains/AIAgentDomain/services/insights/tools/suggestFollowups.ts
//
// Tool: suggest_followups
//
// Meta-tool. Claude calls this AFTER a data-fetching tool has answered
// the user's question, supplying 2-3 short next questions the user
// might tap. The frontend renders them as tap-able chips below the
// assistant bubble; tapping submits the chip text as a new user
// message.
//
// Unlike the other tools, this one doesn't query the DB. It just
// echoes Claude's `questions` array through as a `follow_ups` display
// payload. The tool exists so:
//   1. Claude is bound by `inputSchema` to provide a clean array of
//      short strings (≤80 chars each, max 5), preventing markdown
//      blobs or numbered prose.
//   2. The dispatcher + audit trail capture the chips as a structured
//      tool call (we can analyze chip-suggestion quality later).
//   3. The same renderer pipeline handles every display kind —
//      InsightsToolCallCard branches on `display.kind` once, the
//      panel doesn't need a separate path for "follow-ups from prose".
//
// Risk surfaced in the Phase 6.3 design (impl-doc Section 8b): "dead
// chips" — questions Claude couldn't actually answer if tapped. The
// tool description is aggressive about "answerable by your other
// tools" to mitigate. Bad chips will show up in the audit JSONB
// where we can spot them post-deploy.

import {
  BusinessInsightsTool,
  ToolContext,
  ToolResult,
} from "../types";

const NAME = "suggest_followups";
const MAX_QUESTIONS = 5;
const MAX_QUESTION_LENGTH = 80;

export const suggestFollowups: BusinessInsightsTool = {
  name: NAME,
  description:
    "Call this AFTER you've answered the user's question with a data " +
    "tool. Suggests 2-3 short next questions the user might tap. Pick " +
    "questions that another of your tools can answer — not speculation " +
    "or out-of-scope topics. Skip the call when the user has clearly " +
    "indicated they're done (e.g. 'thanks', 'that's all'). Each " +
    "question must be ≤80 characters, phrased naturally as the user " +
    "would type it (\"Who are my top customers?\" not " +
    "\"top_customers tool\").",
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
          maxLength: MAX_QUESTION_LENGTH,
        },
        minItems: 1,
        maxItems: MAX_QUESTIONS,
        description:
          "2-3 short next questions, phrased naturally. Each ≤80 chars.",
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  async execute(args: unknown, _ctx: ToolContext): Promise<ToolResult> {
    // Defensive parse — Anthropic pre-validates against inputSchema but
    // the dispatcher also revalidates. Still, mistrust the input shape
    // and clean it before echoing into the display.
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const raw = (args as { questions?: unknown }).questions;
    if (!Array.isArray(raw)) {
      throw new Error(`${NAME}: questions must be an array`);
    }
    const questions = raw
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && q.length <= MAX_QUESTION_LENGTH)
      .slice(0, MAX_QUESTIONS);

    if (questions.length === 0) {
      throw new Error(`${NAME}: at least one non-empty question required`);
    }

    return {
      data: { questions },
      display: { kind: "follow_ups", items: questions },
    };
  },
};
