// backend/src/domains/AIAgentDomain/controllers/CommandBarController.ts
//
// POST /api/admin/ai/command — the "smart" brain behind the admin Smart Command
// Bar (⌘K). Given a natural-language query it decides whether the admin wants to
// NAVIGATE somewhere (jump straight to the right section) or ASK a question
// (answered, data-grounded, via the Platform Copilot tool loop). Either way it
// returns a few relevant section suggestions the admin can click.
//
// Navigation targets are referenced by stable ids that the frontend maps to
// routes, so routing stays a single source of truth on the client.

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { cheapModel } from "../../../config/aiModels";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { runPlatformCopilotLoop } from "./PlatformCopilotController";

interface Destination {
  id: string;
  label: string;
  description: string;
}

// Keep ids in sync with frontend SmartCommandBar DESTINATIONS.
const DESTINATIONS: Destination[] = [
  { id: "overview", label: "Overview", description: "Platform dashboard & stats" },
  { id: "customers", label: "Customers", description: "Manage customers & tiers" },
  { id: "shops", label: "Shops", description: "All shops" },
  { id: "shops-pending", label: "Pending Shops", description: "Shops awaiting approval" },
  { id: "treasury", label: "Treasury", description: "Token treasury & minting" },
  { id: "fraud", label: "Fraud Detection", description: "AI fraud scanning & findings" },
  { id: "content-moderation", label: "Content Moderation", description: "Scan & moderate listings" },
  { id: "analytics", label: "Analytics", description: "Platform analytics & trends" },
  { id: "subscriptions", label: "Subscriptions", description: "Shop subscriptions & billing" },
  { id: "promo-codes", label: "Promo Codes", description: "Promo code analytics" },
  { id: "admins", label: "Admins", description: "Manage admin accounts" },
  { id: "create-admin", label: "Create Admin", description: "Add a new admin" },
  { id: "sessions", label: "Sessions", description: "Active login sessions" },
  { id: "support", label: "Support Tickets", description: "Support inbox & AI triage" },
  { id: "waitlist", label: "Waitlist", description: "Waitlist signups" },
  { id: "disputes", label: "Disputes", description: "Customer/shop disputes" },
  { id: "ads", label: "Ads", description: "Ad campaigns" },
  { id: "bug-reports", label: "Bug Reports", description: "User-reported bugs + AI inspect" },
  { id: "ai-agent", label: "AI Agent", description: "AI agent shop controls" },
  { id: "copilot", label: "Platform Copilot", description: "Ask the platform AI" },
  { id: "settings", label: "Settings", description: "Platform settings" },
];

const VALID_IDS = new Set(DESTINATIONS.map((d) => d.id));
const CATALOG_TEXT = DESTINATIONS.map((d) => `- ${d.id}: ${d.label} — ${d.description}`).join("\n");

const CLASSIFY_SYSTEM =
  "You route an admin's command-bar query for RepairCoin (a repair-shop rewards platform). " +
  "You are given a catalog of admin sections (id: label — description). Decide the intent:\n" +
  '- "navigate": the admin wants to GO to a section or perform an action that lives in one ' +
  "(e.g. 'approve a shop' -> shops-pending, 'check fraud' -> fraud, 'open bug reports' -> bug-reports).\n" +
  '- "ask": the admin is asking a QUESTION that needs data or an explanation ' +
  "(e.g. 'how many shops are pending?', 'what is our RCN supply?').\n" +
  "Respond with STRICT JSON only: " +
  '{"intent":"navigate|ask","navigateTo":"<section id or null>",' +
  '"suggestions":["<section id>", ...]}. ' +
  "navigateTo MUST be one of the catalog ids or null (null when intent is ask or unclear). " +
  "suggestions = up to 3 catalog ids most relevant to the query (may be empty). " +
  "Only use ids from the catalog.";

interface Classification {
  intent: "navigate" | "ask";
  navigateTo: string | null;
  suggestions: string[];
}

function parseClassification(text: string): Classification | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]);
    const intent = o.intent === "navigate" ? "navigate" : "ask";
    const navigateTo =
      typeof o.navigateTo === "string" && VALID_IDS.has(o.navigateTo) ? o.navigateTo : null;
    const suggestions = Array.isArray(o.suggestions)
      ? o.suggestions.filter((s: unknown): s is string => typeof s === "string" && VALID_IDS.has(s)).slice(0, 3)
      : [];
    return { intent, navigateTo, suggestions };
  } catch {
    return null;
  }
}

let defaultAnthropic: AnthropicClient | null = null;

export function makeCommandBarController(
  deps: { anthropic?: AnthropicClient; pool?: Pool } = {}
) {
  const pool = deps.pool || getSharedPool();

  return {
    async run(req: Request, res: Response): Promise<Response> {
      const query = (req.body?.query ?? "").toString().trim();
      if (!query) {
        return res.status(400).json({ success: false, error: "query is required" });
      }
      if (query.length > 1000) {
        return res.status(400).json({ success: false, error: "query too long" });
      }

      let anthropic: AnthropicClient;
      try {
        anthropic = deps.anthropic || (defaultAnthropic ??= new AnthropicClient());
      } catch {
        // AI not configured — the client still has instant lexical navigation.
        return res.json({
          success: true,
          data: {
            type: "answer",
            answer:
              "AI isn't configured right now, so I can't answer questions — but you can still type a section name to jump there.",
            navigateTo: null,
            suggestions: [],
            aiAvailable: false,
          },
        });
      }

      // 1) Classify: navigate vs. ask (cheap, catalog-only — no platform data).
      let cls: Classification | null = null;
      try {
        const clsRes = await anthropic.complete({
          systemPrompt: [
            { text: CLASSIFY_SYSTEM, cache: true },
            { text: `Sections catalog:\n${CATALOG_TEXT}`, cache: true },
          ],
          messages: [{ role: "user", content: query }],
          model: cheapModel(),
          maxTokens: 200,
        });
        cls = parseClassification(clsRes.text);
      } catch (err) {
        logger.warn("CommandBar classify failed:", err);
      }

      const suggestions = cls?.suggestions ?? [];

      // 2a) Navigation intent → return the target; no expensive data call needed.
      if (cls?.intent === "navigate" && cls.navigateTo) {
        return res.json({
          success: true,
          data: {
            type: "navigate",
            navigateTo: cls.navigateTo,
            suggestions: suggestions.filter((s) => s !== cls!.navigateTo),
            aiAvailable: true,
          },
        });
      }

      // 2b) Question → data-grounded answer via the platform copilot loop.
      try {
        const result = await runPlatformCopilotLoop(anthropic, pool, [
          { role: "user", content: query },
        ]);
        return res.json({
          success: true,
          data: {
            type: "answer",
            answer: result?.reply ?? "",
            navigateTo: null,
            suggestions,
            toolCalls: result?.toolCalls ?? [],
            aiAvailable: true,
          },
        });
      } catch (err) {
        logger.error("CommandBar answer failed:", err);
        return res.json({
          success: true,
          data: {
            type: "answer",
            answer: "The AI is temporarily unavailable. Please try again in a moment.",
            navigateTo: null,
            suggestions,
            aiAvailable: false,
          },
        });
      }
    },
  };
}
