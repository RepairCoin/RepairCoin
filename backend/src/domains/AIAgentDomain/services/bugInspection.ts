// backend/src/domains/AIAgentDomain/services/bugInspection.ts
//
// Bug Report Inspection (Admin AI).
// Given a bug report, has Claude (Haiku) analyze the most likely CAUSE of the
// problem, where in the platform it originates, how severe it is, and concrete
// steps to investigate/fix it. Cached per (report, updated_at) so it refreshes
// when the report changes; keyword-templated fallback if AI is unavailable.
// No new table/migration.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { cheapModel } from "../../../config/aiModels";
import { AnthropicClient } from "./AnthropicClient";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;

export interface BugInspection {
  reportId: number;
  probableCause: string;
  rootCauseAnalysis: string;
  affectedArea: string;
  severity: (typeof SEVERITIES)[number];
  confidence: (typeof CONFIDENCES)[number];
  suggestedFix: string[];
  generatedAt: string;
}

const cache = new Map<string, BugInspection>();
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

export async function getBugInspection(
  reportId: number,
  force = false,
  pool: Pool = getSharedPool()
): Promise<BugInspection | null> {
  const res = await pool.query(
    `SELECT id, wallet_address, role, category, title, description, status,
            admin_notes, created_at, updated_at
       FROM bug_reports WHERE id = $1`,
    [reportId]
  );
  if (res.rows.length === 0) return null;
  const bug = res.rows[0];

  const cacheKey = `${reportId}:${new Date(bug.updated_at).getTime()}`;
  if (!force && cache.has(cacheKey)) return cache.get(cacheKey)!;

  const value = await analyze(bug);
  cache.set(cacheKey, value);
  return value;
}

interface BugRow {
  id: number;
  role: string;
  category: string;
  title: string;
  description: string;
  admin_notes: string | null;
}

async function analyze(bug: BugRow): Promise<BugInspection> {
  const ai = getAnthropic();
  if (ai) {
    try {
      const systemPrompt =
        "You are a senior engineer triaging bug reports for RepairCoin, a " +
        "repair-shop rewards platform (Node/Express + PostgreSQL backend, " +
        "Next.js/React frontend, Stripe subscriptions, wallet login). " +
        "FIRST read the report carefully, then diagnose the MOST LIKELY technical " +
        "cause of the problem. Respond with STRICT JSON only: " +
        '{"probableCause":"one or two sentences naming the most likely cause",' +
        '"rootCauseAnalysis":"a short paragraph explaining your reasoning and what ' +
        'is probably happening under the hood",' +
        '"affectedArea":"the subsystem most likely involved, e.g. Stripe billing / ' +
        'webhook, wallet auth, token redemption, booking flow, notifications, UI ' +
        'rendering, database",' +
        '"severity":"low|medium|high|critical",' +
        '"confidence":"low|medium|high",' +
        '"suggestedFix":["concrete investigation or fix step", "..."]}. ' +
        "critical = data loss / payments broken / users locked out; high = a core " +
        "flow broken for many; medium = degraded but workaround exists; low = minor/UI. " +
        "Base the diagnosis only on the report; if information is thin, say so and lower " +
        "your confidence. Do not invent specifics. Keep it practical and actionable.";

      const content =
        `Category: ${bug.category}\n` +
        `Reported by role: ${bug.role}\n` +
        `Title: ${bug.title}\n\n` +
        `Description:\n${bug.description || "(none)"}\n\n` +
        `Admin notes:\n${bug.admin_notes || "(none)"}`;

      const out = await ai.complete({
        systemPrompt: [{ text: systemPrompt, cache: true }],
        messages: [{ role: "user", content }],
        model: cheapModel(),
        maxTokens: 700,
      });
      const parsed = parseInspection(out.text);
      if (parsed) {
        return { reportId: bug.id, ...parsed, generatedAt: new Date().toISOString() };
      }
    } catch (err) {
      logger.warn("Bug inspection AI failed (using templated):", err);
    }
  }
  return { reportId: bug.id, ...templated(bug), generatedAt: new Date().toISOString() };
}

function parseInspection(text: string):
  | Omit<BugInspection, "reportId" | "generatedAt">
  | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]);
    const fix = Array.isArray(o.suggestedFix)
      ? o.suggestedFix.filter((s: unknown): s is string => typeof s === "string")
      : [];
    return {
      probableCause: typeof o.probableCause === "string" ? o.probableCause : "",
      rootCauseAnalysis: typeof o.rootCauseAnalysis === "string" ? o.rootCauseAnalysis : "",
      affectedArea: typeof o.affectedArea === "string" ? o.affectedArea : "Unknown",
      severity: (SEVERITIES as readonly string[]).includes(o.severity) ? o.severity : "medium",
      confidence: (CONFIDENCES as readonly string[]).includes(o.confidence) ? o.confidence : "low",
      suggestedFix: fix,
    };
  } catch {
    return null;
  }
}

/** Keyword-based fallback when AI is unavailable. */
function templated(bug: BugRow): Omit<BugInspection, "reportId" | "generatedAt"> {
  const text = `${bug.category} ${bug.title} ${bug.description}`.toLowerCase();

  let affectedArea = "General application";
  let probableCause = "Unable to run AI analysis — review the report details manually.";
  let severity: BugInspection["severity"] = "medium";

  if (/(payment|charge|invoice|refund|subscription|stripe|billing)/.test(text)) {
    affectedArea = "Stripe billing / webhooks";
    probableCause =
      "Likely a billing or Stripe webhook issue — a payment event may not have been processed or a subscription state is out of sync.";
    severity = "high";
  } else if (/(wallet|token|rcn|rcg|mint|redeem|balance)/.test(text)) {
    affectedArea = "Token / wallet flow";
    probableCause =
      "Likely a token balance or redemption issue — check the customer balance calculation and redemption flow (database-only mode is active).";
    severity = "high";
  } else if (/(login|auth|sign in|password|session|verify)/.test(text)) {
    affectedArea = "Authentication";
    probableCause =
      "Likely an authentication/session issue — check JWT handling, wallet login, and session expiry.";
    severity = "high";
  } else if (/(book|order|appointment|schedul)/.test(text)) {
    affectedArea = "Booking / orders";
    probableCause =
      "Likely a booking or order flow issue — check availability calculation and order state transitions.";
  } else if (/(notif|email|alert)/.test(text)) {
    affectedArea = "Notifications";
    probableCause =
      "Likely a notification delivery issue — check the notification gateway and channel preferences.";
    severity = "low";
  } else if (/(crash|white screen|blank|render|ui|display|button)/.test(text)) {
    affectedArea = "Frontend / UI";
    probableCause =
      "Likely a frontend rendering issue — check the component for unhandled null/undefined data or a failed API response.";
    severity = "low";
  }

  return {
    probableCause,
    rootCauseAnalysis:
      "AI analysis was unavailable, so this is a keyword-based estimate from the report's " +
      "category and description. Configure the AI key to get a full diagnosis.",
    affectedArea,
    severity,
    confidence: "low",
    suggestedFix: [
      "Reproduce the issue using the reporter's role and steps.",
      "Check server logs around the report timestamp for related errors.",
      `Inspect the ${affectedArea} code path for the failure.`,
    ],
  };
}
