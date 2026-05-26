// backend/src/domains/AIAgentDomain/services/marketing/tools/suggestCampaignStrategies.ts
//
// Tool: suggest_campaign_strategies
//
// Meta-tool for empty-panel state. Claude calls this when the user
// hasn't yet stated a goal (e.g. first message of a new session) and
// surfaces 2-3 strategy chips the shop might tap to seed a campaign.
//
// Mirrors suggest_followups from the Insights surface but framed as
// "campaign ideas you might run" rather than "questions you might ask."
// The frontend renders chips below the assistant bubble; tapping
// submits the chip text as a fresh user message.
//
// Like suggest_followups this tool doesn't query the DB — it just
// echoes Claude's `strategies` array through as a `strategy_chips`
// display payload. Claude is expected to look at the shop's current
// context (preloaded — services, prior campaigns) and choose strategies
// the shop hasn't recently exercised.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";

const NAME = "suggest_campaign_strategies";
const MAX_STRATEGIES = 4;
const MAX_STRATEGY_LENGTH = 100;

export const suggestCampaignStrategies: MarketingTool = {
  name: NAME,
  description:
    "Call this when the shop hasn't yet stated a campaign goal (empty " +
    "panel, first message of a session, or vague openings like 'help me " +
    "with marketing'). Suggests 2-4 short, concrete campaign ideas the " +
    "shop might tap. Each strategy is phrased as the shop would type it " +
    "(\"Send a Black Friday campaign\", \"Bring back lapsed customers\") " +
    "and should be actionable by your other tools. Skip calling this " +
    "when the shop has already named what they want — go directly to " +
    "lookup_audience_count + propose_campaign_draft. Each strategy ≤100 " +
    "chars.",
  inputSchema: {
    type: "object",
    properties: {
      strategies: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
          maxLength: MAX_STRATEGY_LENGTH,
        },
        minItems: 1,
        maxItems: MAX_STRATEGIES,
        description:
          "2-4 short campaign ideas, phrased naturally. Each ≤100 chars.",
      },
    },
    required: ["strategies"],
    additionalProperties: false,
  },
  async execute(
    args: unknown,
    _ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    if (!args || typeof args !== "object") {
      throw new Error(`${NAME}: args must be an object`);
    }
    const raw = (args as { strategies?: unknown }).strategies;
    if (!Array.isArray(raw)) {
      throw new Error(`${NAME}: strategies must be an array`);
    }
    const strategies = raw
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= MAX_STRATEGY_LENGTH)
      .slice(0, MAX_STRATEGIES);

    if (strategies.length === 0) {
      throw new Error(`${NAME}: at least one non-empty strategy required`);
    }

    return {
      data: { strategies },
      display: { kind: "strategy_chips", items: strategies },
    };
  },
};
