// backend/src/services/openai/OpenAIModerationClient.ts
//
// Thin client for OpenAI's moderation endpoint — a pre-flight safety check on
// image prompts BEFORE we spend money generating (AI Image Generation §5/§8;
// risk: "shop generates inappropriate imagery deliberately").
//
// Free + fast. Reuses OPENAI_API_KEY. Fail-OPEN by design: if moderation itself
// errors (network/outage), we do NOT block the generation — a moderation
// outage shouldn't take image gen down; DALL·E has its own server-side
// guardrails as a backstop. Returns flagged=false on error.

import { logger } from "../../utils/logger";

const MODERATION_MODEL = "omni-moderation-latest";
const MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";

export interface ModerationResult {
  flagged: boolean;
  /** Category names that tripped, for the audit row / logs. */
  categories: string[];
}

export class OpenAIModerationClient {
  /** Check a prompt. Fails open (flagged:false) on any error. */
  async check(input: string): Promise<ModerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // No key → can't moderate; fail open (DALL·E guardrails still apply).
      return { flagged: false, categories: [] };
    }

    try {
      const res = await fetch(MODERATION_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODERATION_MODEL, input }),
      });
      if (!res.ok) {
        logger.warn("OpenAIModerationClient non-OK — failing open", {
          status: res.status,
        });
        return { flagged: false, categories: [] };
      }
      const payload = (await res.json()) as {
        results?: Array<{
          flagged?: boolean;
          categories?: Record<string, boolean>;
        }>;
      };
      const r = payload.results?.[0];
      const categories = r?.categories
        ? Object.entries(r.categories)
            .filter(([, v]) => v === true)
            .map(([k]) => k)
        : [];
      return { flagged: Boolean(r?.flagged), categories };
    } catch (err) {
      logger.warn("OpenAIModerationClient error — failing open", {
        message: err instanceof Error ? err.message : String(err),
      });
      return { flagged: false, categories: [] };
    }
  }
}

export const openAIModerationClient = new OpenAIModerationClient();
