// backend/src/domains/AIAgentDomain/controllers/SettingsController.ts
//
// Shop-side AI settings — GET + PUT for the requesting shop's own
// ai_shop_settings row. See docs/tasks/strategy/ai-sales-agent/shop-ai-settings-ui.md.
//
//   GET /api/ai/settings   — the shop's AI config snapshot
//   PUT /api/ai/settings   — update the shop-EDITABLE fields only
//
// Field ownership (decided in the scoping doc):
//   - Admin "gates" (read-only here): ai_global_enabled, ai_followup_enabled,
//     monthly_budget_usd. The shop never edits these via this endpoint — a
//     shop must not turn on its own AI capability or raise its own cost cap.
//   - Shop-editable: escalation_threshold, ai_followup_delay_minutes,
//     human_reply_baseline_minutes. Behavior tuning + the per-shop baseline
//     used by the Impact Metrics "Time your AI saved you" estimate.
//     human_reply_baseline_minutes is OPTIONAL on PUT — older clients that
//     don't yet send it are honored; we only write the column when present.
//
// Deliberately NOT exposed: business_hours_only_ai and blacklist_keywords —
// both are columns on ai_shop_settings but NO code reads them yet. Surfacing
// a toggle that does nothing would mislead the shop. Add them here only once
// they are actually enforced.
//
// Factory + lazy-default pattern mirrors SpendController / PreviewController
// so tests can inject a mocked pool.

import { Request, Response } from "express";
import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { getShopTier, getShopAiBudget } from "../../../utils/shopTier";
import { AI_TIER_ALLOWANCE, SubscriptionTier } from "../../../config/subscriptionPlans";
import { tierAllowsFeature, getRequiredTier } from "../../../config/featureTiers";
import { logger } from "../../../utils/logger";

const DEFAULT_ESCALATION_THRESHOLD = 5;
const DEFAULT_FOLLOWUP_DELAY_MINUTES = 20;
// Matches DB DEFAULT 240 on ai_shop_settings.human_reply_baseline_minutes
// (migration 117). Used when no row exists yet for the shop.
const DEFAULT_HUMAN_REPLY_BASELINE_MINUTES = 240;

// Validation bounds for the shop-editable fields.
const ESCALATION_MIN = 1;
const ESCALATION_MAX = 20;
const DELAY_MIN = 15;
const DELAY_MAX = 30;
// Mirrors the DB CHECK constraint added in migration 117.
const BASELINE_MIN = 15;
const BASELINE_MAX = 1440;

// Phase 6 branding — shop-settable assistant display name. Empty/blank clears
// it (→ NULL → UI shows "Assistant"). 40 chars matches the DB column.
const ASSISTANT_NAME_MAX = 40;

export interface ShopAiSettings {
  // Admin-gated (read-only for the shop)
  aiGlobalEnabled: boolean;
  aiFollowupEnabled: boolean;
  aiImagesEnabled: boolean;
  campaignRewardsEnabled: boolean;
  monthlyBudgetUsd: number;
  currentMonthSpendUsd: number;
  // Shop-editable
  escalationThreshold: number;
  aiFollowupDelayMinutes: number;
  humanReplyBaselineMinutes: number;
  /** Phase 6 branding — unified assistant display name; null when unset. */
  assistantName?: string | null;
}

/**
 * All fields optional — a partial update. The shop UI may PUT just the
 * assistant name, just the tuning fields, or any subset. At least one must be
 * present (validator enforces).
 */
export interface ShopAiSettingsUpdate {
  escalationThreshold?: number;
  aiFollowupDelayMinutes?: number;
  humanReplyBaselineMinutes?: number;
  /** Trimmed name; empty/blank → null (clears it). */
  assistantName?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: ShopAiSettingsUpdate;
}

/**
 * Validate a PUT /api/ai/settings body. Pure — exported for unit testing.
 * Only the two shop-editable fields are accepted; any gate field in the
 * body is simply ignored (never trusted).
 */
export function validateShopAiSettingsUpdate(body: any): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required" };
  }
  // Partial update — validate each field only when present, require ≥1.
  const value: ShopAiSettingsUpdate = {};

  if (body.escalationThreshold !== undefined) {
    const esc = body.escalationThreshold;
    if (!Number.isInteger(esc) || esc < ESCALATION_MIN || esc > ESCALATION_MAX) {
      return {
        ok: false,
        error: `escalationThreshold must be an integer between ${ESCALATION_MIN} and ${ESCALATION_MAX}`,
      };
    }
    value.escalationThreshold = esc;
  }
  if (body.aiFollowupDelayMinutes !== undefined) {
    const delay = body.aiFollowupDelayMinutes;
    if (!Number.isInteger(delay) || delay < DELAY_MIN || delay > DELAY_MAX) {
      return {
        ok: false,
        error: `aiFollowupDelayMinutes must be an integer between ${DELAY_MIN} and ${DELAY_MAX}`,
      };
    }
    value.aiFollowupDelayMinutes = delay;
  }
  if (body.humanReplyBaselineMinutes !== undefined) {
    const baseline = body.humanReplyBaselineMinutes;
    if (!Number.isInteger(baseline) || baseline < BASELINE_MIN || baseline > BASELINE_MAX) {
      return {
        ok: false,
        error: `humanReplyBaselineMinutes must be an integer between ${BASELINE_MIN} and ${BASELINE_MAX}`,
      };
    }
    value.humanReplyBaselineMinutes = baseline;
  }
  if (body.assistantName !== undefined) {
    if (body.assistantName === null) {
      value.assistantName = null;
    } else if (typeof body.assistantName !== "string") {
      return { ok: false, error: "assistantName must be a string or null" };
    } else {
      const name = body.assistantName.trim();
      if (name.length > ASSISTANT_NAME_MAX) {
        return {
          ok: false,
          error: `assistantName must be ${ASSISTANT_NAME_MAX} characters or fewer`,
        };
      }
      value.assistantName = name.length === 0 ? null : name; // blank clears
    }
  }

  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      error:
        "Provide at least one editable field: escalationThreshold, aiFollowupDelayMinutes, humanReplyBaselineMinutes, or assistantName",
    };
  }

  return { ok: true, value };
}

/** One shop's AI settings as the admin gate view sees it. */
export interface AdminShopAiSettings extends ShopAiSettings {
  shopId: string;
  shopName: string;
  /** The shop's plan tier — the UI uses it to lock feature toggles the tier doesn't include (WS2). */
  tier: SubscriptionTier;
}

/** The admin-editable gate fields. All optional — a partial update.
 *  (monthlyBudgetUsd is NOT here — the AI budget is tier-derived + read-only.) */
export interface AdminShopAiSettingsUpdate {
  aiGlobalEnabled?: boolean;
  aiFollowupEnabled?: boolean;
  aiImagesEnabled?: boolean;
  campaignRewardsEnabled?: boolean;
}

export interface AdminValidationResult {
  ok: boolean;
  error?: string;
  value?: AdminShopAiSettingsUpdate;
}

/**
 * Validate a PUT /api/ai/admin/shop-settings/:shopId body. Pure — exported
 * for unit testing. Accepts any non-empty subset of the three gate fields;
 * rejects when nothing valid is provided.
 */
export function validateAdminShopAiSettingsUpdate(body: any): AdminValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required" };
  }
  const out: AdminShopAiSettingsUpdate = {};

  if (body.aiGlobalEnabled !== undefined) {
    if (typeof body.aiGlobalEnabled !== "boolean") {
      return { ok: false, error: "aiGlobalEnabled must be a boolean" };
    }
    out.aiGlobalEnabled = body.aiGlobalEnabled;
  }
  if (body.aiFollowupEnabled !== undefined) {
    if (typeof body.aiFollowupEnabled !== "boolean") {
      return { ok: false, error: "aiFollowupEnabled must be a boolean" };
    }
    out.aiFollowupEnabled = body.aiFollowupEnabled;
  }
  if (body.aiImagesEnabled !== undefined) {
    if (typeof body.aiImagesEnabled !== "boolean") {
      return { ok: false, error: "aiImagesEnabled must be a boolean" };
    }
    out.aiImagesEnabled = body.aiImagesEnabled;
  }
  if (body.campaignRewardsEnabled !== undefined) {
    if (typeof body.campaignRewardsEnabled !== "boolean") {
      return { ok: false, error: "campaignRewardsEnabled must be a boolean" };
    }
    out.campaignRewardsEnabled = body.campaignRewardsEnabled;
  }
  // monthlyBudgetUsd is NO LONGER settable — the AI budget is a pure function of the shop's tier
  // ($10/$30/$75), computed at read. Any monthlyBudgetUsd in the body is ignored (read-only field).

  if (Object.keys(out).length === 0) {
    return {
      ok: false,
      error:
        "Provide at least one of: aiGlobalEnabled, aiFollowupEnabled, aiImagesEnabled, campaignRewardsEnabled",
    };
  }
  return { ok: true, value: out };
}

/** Read the shop's settings, applying defaults when no row exists. */
async function fetchSettings(pool: Pool, shopId: string): Promise<ShopAiSettings> {
  const r = await pool.query<{
    ai_global_enabled: boolean;
    ai_followup_enabled: boolean;
    ai_images_enabled: boolean;
    campaign_rewards_enabled: boolean;
    ai_followup_delay_minutes: number | null;
    escalation_threshold: number | null;
    monthly_budget_usd: string;
    current_month_spend_usd: string;
    human_reply_baseline_minutes: number | null;
    assistant_name: string | null;
  }>(
    `SELECT ai_global_enabled, ai_followup_enabled, ai_images_enabled,
            campaign_rewards_enabled, ai_followup_delay_minutes,
            escalation_threshold, monthly_budget_usd, current_month_spend_usd,
            human_reply_baseline_minutes, assistant_name
     FROM ai_shop_settings WHERE shop_id = $1`,
    [shopId]
  );

  // Budget is the shop's tier allowance ($10/$30/$75) — the stored monthly_budget_usd is inert
  // (read-only monitoring shows the real cap).
  const budget = await getShopAiBudget(shopId);

  if (r.rows.length === 0) {
    return {
      aiGlobalEnabled: false,
      aiFollowupEnabled: false,
      aiImagesEnabled: false,
      campaignRewardsEnabled: false,
      monthlyBudgetUsd: budget,
      currentMonthSpendUsd: 0,
      escalationThreshold: DEFAULT_ESCALATION_THRESHOLD,
      aiFollowupDelayMinutes: DEFAULT_FOLLOWUP_DELAY_MINUTES,
      humanReplyBaselineMinutes: DEFAULT_HUMAN_REPLY_BASELINE_MINUTES,
      assistantName: null,
    };
  }
  const row = r.rows[0];
  return {
    aiGlobalEnabled: row.ai_global_enabled === true,
    aiFollowupEnabled: row.ai_followup_enabled === true,
    aiImagesEnabled: row.ai_images_enabled === true,
    campaignRewardsEnabled: row.campaign_rewards_enabled === true,
    monthlyBudgetUsd: budget,
    currentMonthSpendUsd: parseFloat(row.current_month_spend_usd) || 0,
    escalationThreshold: row.escalation_threshold ?? DEFAULT_ESCALATION_THRESHOLD,
    aiFollowupDelayMinutes:
      row.ai_followup_delay_minutes ?? DEFAULT_FOLLOWUP_DELAY_MINUTES,
    humanReplyBaselineMinutes:
      row.human_reply_baseline_minutes ?? DEFAULT_HUMAN_REPLY_BASELINE_MINUTES,
    assistantName: row.assistant_name ?? null,
  };
}

/** SELECT clause for the admin gate view — one shop's AI settings + name. */
const ADMIN_SELECT = `
  SELECT s.shop_id, COALESCE(sh.name, s.shop_id) AS shop_name,
         s.ai_global_enabled, s.ai_followup_enabled, s.ai_images_enabled,
         s.campaign_rewards_enabled,
         s.ai_followup_delay_minutes, s.escalation_threshold,
         s.monthly_budget_usd, s.current_month_spend_usd,
         s.human_reply_baseline_minutes
  FROM ai_shop_settings s
  LEFT JOIN shops sh ON sh.shop_id = s.shop_id`;

async function mapAdminRow(row: any): Promise<AdminShopAiSettings> {
  const tier = await getShopTier(row.shop_id);
  return {
    shopId: row.shop_id,
    shopName: row.shop_name ?? row.shop_id,
    aiGlobalEnabled: row.ai_global_enabled === true,
    aiFollowupEnabled: row.ai_followup_enabled === true,
    aiImagesEnabled: row.ai_images_enabled === true,
    campaignRewardsEnabled: row.campaign_rewards_enabled === true,
    // Tier + tier-derived budget (both read-only). One tier lookup; budget = AI_TIER_ALLOWANCE[tier].
    tier,
    monthlyBudgetUsd: AI_TIER_ALLOWANCE[tier],
    currentMonthSpendUsd: parseFloat(row.current_month_spend_usd) || 0,
    escalationThreshold: row.escalation_threshold ?? DEFAULT_ESCALATION_THRESHOLD,
    aiFollowupDelayMinutes:
      row.ai_followup_delay_minutes ?? DEFAULT_FOLLOWUP_DELAY_MINUTES,
    humanReplyBaselineMinutes:
      row.human_reply_baseline_minutes ?? DEFAULT_HUMAN_REPLY_BASELINE_MINUTES,
  };
}

export interface SettingsControllerDeps {
  pool?: Pool;
}

export function makeSettingsControllers(deps: SettingsControllerDeps = {}) {
  const pool = deps.pool ?? getSharedPool();

  return {
    getOwnShopAiSettings: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const data = await fetchSettings(pool, shopId);
        res.json({ success: true, data });
      } catch (err) {
        logger.error("SettingsController.getOwnShopAiSettings failed", err);
        res.status(500).json({ success: false, error: "Failed to load AI settings" });
      }
    },

    updateOwnShopAiSettings: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        const validation = validateShopAiSettingsUpdate(req.body);
        if (!validation.ok || !validation.value) {
          res.status(400).json({ success: false, error: validation.error });
          return;
        }

        // Upsert the shop-editable fields. The INSERT branch (shop has no
        // settings row yet) leaves every gate field at its column DEFAULT —
        // crucially ai_global_enabled / ai_followup_enabled stay FALSE, so a
        // shop can never enable a capability through this endpoint.
        // Dynamic columns so optional fields (humanReplyBaselineMinutes) are
        // only written when the client sent them — mirrors the admin upsert.
        const v = validation.value;
        const cols: string[] = ["shop_id"];
        const vals: any[] = [shopId];
        const setClauses: string[] = [];
        const addCol = (col: string, val: any) => {
          cols.push(col);
          vals.push(val);
          setClauses.push(`${col} = EXCLUDED.${col}`);
        };
        if (v.escalationThreshold !== undefined)
          addCol("escalation_threshold", v.escalationThreshold);
        if (v.aiFollowupDelayMinutes !== undefined)
          addCol("ai_followup_delay_minutes", v.aiFollowupDelayMinutes);
        if (v.humanReplyBaselineMinutes !== undefined)
          addCol("human_reply_baseline_minutes", v.humanReplyBaselineMinutes);
        if (v.assistantName !== undefined)
          addCol("assistant_name", v.assistantName); // null clears it
        const placeholders = vals.map((_, i) => `$${i + 1}`);
        await pool.query(
          `INSERT INTO ai_shop_settings (${cols.join(", ")})
           VALUES (${placeholders.join(", ")})
           ON CONFLICT (shop_id) DO UPDATE SET ${setClauses.join(", ")}, updated_at = NOW()`,
          vals
        );

        const data = await fetchSettings(pool, shopId);
        res.json({ success: true, data });
      } catch (err) {
        logger.error("SettingsController.updateOwnShopAiSettings failed", err);
        res.status(500).json({ success: false, error: "Failed to update AI settings" });
      }
    },

    // ---- Admin gate ----

    /** GET /api/ai/admin/shop-settings — every shop's AI settings + name. */
    listShopAiSettings: async (_req: Request, res: Response): Promise<void> => {
      try {
        const r = await pool.query(`${ADMIN_SELECT} ORDER BY shop_name ASC`);
        res.json({ success: true, data: await Promise.all(r.rows.map(mapAdminRow)) });
      } catch (err) {
        logger.error("SettingsController.listShopAiSettings failed", err);
        res.status(500).json({ success: false, error: "Failed to load shop AI settings" });
      }
    },

    /**
     * PUT /api/ai/admin/shop-settings/:shopId — set the admin-gate fields
     * (ai_global_enabled, ai_followup_enabled, monthly_budget_usd) for one
     * shop. Partial: only the fields present in the body are written.
     */
    adminUpdateShopAiSettings: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = req.params?.shopId;
        if (!shopId) {
          res.status(400).json({ success: false, error: "shopId is required" });
          return;
        }

        const validation = validateAdminShopAiSettingsUpdate(req.body);
        if (!validation.ok || !validation.value) {
          res.status(400).json({ success: false, error: validation.error });
          return;
        }

        // WS2 — a gated feature can't be ENABLED for a shop whose tier doesn't include it. Availability
        // is governed by the plan, not the admin (the UI also locks these toggles below tier).
        const tier = await getShopTier(shopId);
        const GATED: Record<string, string> = {
          aiFollowupEnabled: "aiLeadFollowUp",
          aiImagesEnabled: "aiImageGen",
          campaignRewardsEnabled: "campaignRewards",
        }; // aiGlobalEnabled (master AI on/off) is Starter+ — intentionally not gated.
        for (const [field, feature] of Object.entries(GATED)) {
          if ((validation.value as any)[field] === true && !tierAllowsFeature(tier, feature)) {
            res.status(403).json({
              success: false,
              error: `That feature isn't included in this shop's plan (${tier}). Upgrade the plan to enable it.`,
              details: { field, requiredTier: getRequiredTier(feature), currentTier: tier },
            });
            return;
          }
        }

        // Partial upsert — only the provided gate fields are written; any
        // omitted column keeps its DEFAULT (on insert) or current value
        // (on conflict).
        const cols: string[] = ["shop_id"];
        const vals: any[] = [shopId];
        const setClauses: string[] = [];
        const add = (col: string, val: any) => {
          cols.push(col);
          vals.push(val);
          setClauses.push(`${col} = EXCLUDED.${col}`);
        };
        const v = validation.value;
        if (v.aiGlobalEnabled !== undefined) add("ai_global_enabled", v.aiGlobalEnabled);
        if (v.aiFollowupEnabled !== undefined) add("ai_followup_enabled", v.aiFollowupEnabled);
        if (v.aiImagesEnabled !== undefined) add("ai_images_enabled", v.aiImagesEnabled);
        if (v.campaignRewardsEnabled !== undefined) add("campaign_rewards_enabled", v.campaignRewardsEnabled);
        // monthly_budget_usd is intentionally NOT writable — it's tier-derived + read-only.

        const placeholders = vals.map((_, i) => `$${i + 1}`);
        await pool.query(
          `INSERT INTO ai_shop_settings (${cols.join(", ")})
           VALUES (${placeholders.join(", ")})
           ON CONFLICT (shop_id) DO UPDATE SET ${setClauses.join(", ")}, updated_at = NOW()`,
          vals
        );

        const r = await pool.query(`${ADMIN_SELECT} WHERE s.shop_id = $1`, [shopId]);
        if (r.rows.length === 0) {
          res.status(404).json({ success: false, error: "Shop not found" });
          return;
        }
        res.json({ success: true, data: await mapAdminRow(r.rows[0]) });
      } catch (err) {
        logger.error("SettingsController.adminUpdateShopAiSettings failed", err);
        res.status(500).json({ success: false, error: "Failed to update shop AI settings" });
      }
    },
  };
}

// Lazy default handlers for production (matches SpendController pattern).
let _defaultControllers: ReturnType<typeof makeSettingsControllers> | null = null;
function getDefaults() {
  if (!_defaultControllers) _defaultControllers = makeSettingsControllers();
  return _defaultControllers;
}

export function getOwnShopAiSettings(req: Request, res: Response): Promise<void> {
  return getDefaults().getOwnShopAiSettings(req, res);
}
export function updateOwnShopAiSettings(req: Request, res: Response): Promise<void> {
  return getDefaults().updateOwnShopAiSettings(req, res);
}
export function listShopAiSettings(req: Request, res: Response): Promise<void> {
  return getDefaults().listShopAiSettings(req, res);
}
export function adminUpdateShopAiSettings(req: Request, res: Response): Promise<void> {
  return getDefaults().adminUpdateShopAiSettings(req, res);
}
