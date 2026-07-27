// backend/src/domains/AIAgentDomain/services/shopScreening.ts
//
// Shop Approval Assistant (Admin AI #3).
// Screens a pending shop application: gathers legitimacy/risk signals from the
// DB (duplicate email/wallet/phone/name, profile completeness, account age),
// then has Claude (Haiku) produce a structured risk assessment for the admin
// reviewer. Cached per shop (in-memory, short TTL); templated fallback if AI is
// unavailable. No new table/migration required.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { cheapModel } from "../../../config/aiModels";
import { AnthropicClient } from "./AnthropicClient";

export interface ShopScreening {
  shopId: string;
  riskLevel: "low" | "medium" | "high";
  recommendation: "approve" | "review" | "reject";
  summary: string;
  legitimacySignals: string[];
  riskFlags: string[];
  signals: Record<string, unknown>;
  generatedAt: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const cache = new Map<string, { at: number; value: ShopScreening }>();
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

export async function getShopScreening(
  shopId: string,
  force = false,
  pool: Pool = getSharedPool()
): Promise<ShopScreening | null> {
  const cached = cache.get(shopId);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const shopRes = await pool.query(
    `SELECT shop_id, name, email, phone, address, wallet_address, website,
            category, country, location_city, location_state, created_at,
            verified, operational_status
     FROM shops WHERE shop_id = $1`,
    [shopId]
  );
  if (shopRes.rows.length === 0) return null;
  const shop = shopRes.rows[0];

  // ---- DB-derived signals ----
  const dup = await pool.query<{
    dup_email: string;
    dup_wallet: string;
    dup_phone: string;
    dup_name: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM shops WHERE shop_id <> $1 AND email IS NOT NULL AND LOWER(email) = LOWER($2)) AS dup_email,
       (SELECT COUNT(*) FROM shops WHERE shop_id <> $1 AND wallet_address IS NOT NULL AND LOWER(wallet_address) = LOWER($3)) AS dup_wallet,
       (SELECT COUNT(*) FROM shops WHERE shop_id <> $1 AND phone IS NOT NULL AND phone = $4) AS dup_phone,
       (SELECT COUNT(*) FROM shops WHERE shop_id <> $1 AND LOWER(name) = LOWER($5)) AS dup_name`,
    [shopId, shop.email ?? "", shop.wallet_address ?? "", shop.phone ?? "", shop.name ?? ""]
  );
  const d = dup.rows[0];

  const missing: string[] = [];
  if (!shop.email) missing.push("email");
  if (!shop.phone) missing.push("phone");
  if (!shop.address) missing.push("address");
  if (!shop.website) missing.push("website");
  if (!shop.category) missing.push("category");

  const signals = {
    duplicateEmail: parseInt(d.dup_email, 10),
    duplicateWallet: parseInt(d.dup_wallet, 10),
    duplicatePhone: parseInt(d.dup_phone, 10),
    duplicateName: parseInt(d.dup_name, 10),
    missingFields: missing,
    hasWebsite: !!shop.website,
    createdAt: shop.created_at,
  };

  const profile = {
    name: shop.name,
    email: shop.email,
    phone: shop.phone,
    address: shop.address,
    website: shop.website,
    category: shop.category,
    country: shop.country,
    city: shop.location_city,
    state: shop.location_state,
    walletAddress: shop.wallet_address,
  };

  const value = await assess(shopId, profile, signals);
  cache.set(shopId, { at: Date.now(), value });
  return value;
}

async function assess(
  shopId: string,
  profile: Record<string, unknown>,
  signals: Record<string, unknown>
): Promise<ShopScreening> {
  const ai = getAnthropic();
  if (ai) {
    try {
      const systemPrompt =
        "You are a fraud/trust screener for a repair-shop rewards platform. Given a " +
        "pending shop's profile and pre-computed signals, assess legitimacy and risk. " +
        'Respond with STRICT JSON only: {"riskLevel":"low|medium|high",' +
        '"recommendation":"approve|review|reject","summary":"one sentence",' +
        '"legitimacySignals":["..."],"riskFlags":["..."]}. ' +
        "Duplicate wallet/email/phone across shops, missing contact info, and no website " +
        "are risk flags. A complete, unique profile is a legitimacy signal. Keep arrays to 2-4 items.";
      const res = await ai.complete({
        systemPrompt: [{ text: systemPrompt, cache: true }],
        messages: [
          {
            role: "user",
            content: `Profile: ${JSON.stringify(profile)}\nSignals: ${JSON.stringify(signals)}`,
          },
        ],
        model: cheapModel(),
        maxTokens: 400,
      });
      const parsed = parseAssessment(res.text);
      if (parsed) {
        return {
          shopId,
          ...parsed,
          signals,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      logger.warn("Shop screening AI failed (using templated):", err);
    }
  }
  return { shopId, ...templatedAssessment(signals), signals, generatedAt: new Date().toISOString() };
}

function parseAssessment(text: string):
  | Pick<ShopScreening, "riskLevel" | "recommendation" | "summary" | "legitimacySignals" | "riskFlags">
  | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const o = JSON.parse(match[0]);
    const riskLevel = ["low", "medium", "high"].includes(o.riskLevel) ? o.riskLevel : "medium";
    const recommendation = ["approve", "review", "reject"].includes(o.recommendation)
      ? o.recommendation
      : "review";
    return {
      riskLevel,
      recommendation,
      summary: typeof o.summary === "string" ? o.summary : "",
      legitimacySignals: Array.isArray(o.legitimacySignals) ? o.legitimacySignals.map(String) : [],
      riskFlags: Array.isArray(o.riskFlags) ? o.riskFlags.map(String) : [],
    };
  } catch {
    return null;
  }
}

/** Deterministic fallback (rules-only) when AI is unavailable. */
function templatedAssessment(
  signals: Record<string, unknown>
): Pick<ShopScreening, "riskLevel" | "recommendation" | "summary" | "legitimacySignals" | "riskFlags"> {
  const dupWallet = Number(signals.duplicateWallet) || 0;
  const dupEmail = Number(signals.duplicateEmail) || 0;
  const dupPhone = Number(signals.duplicatePhone) || 0;
  const missing = (signals.missingFields as string[]) || [];

  const riskFlags: string[] = [];
  if (dupWallet > 0) riskFlags.push(`Wallet already used by ${dupWallet} other shop(s)`);
  if (dupEmail > 0) riskFlags.push(`Email already used by ${dupEmail} other shop(s)`);
  if (dupPhone > 0) riskFlags.push(`Phone already used by ${dupPhone} other shop(s)`);
  if (missing.length) riskFlags.push(`Missing: ${missing.join(", ")}`);

  const legitimacySignals: string[] = [];
  if (signals.hasWebsite) legitimacySignals.push("Has a website");
  if (!dupWallet && !dupEmail && !dupPhone) legitimacySignals.push("Unique contact details");
  if (missing.length === 0) legitimacySignals.push("Complete profile");

  const high = dupWallet > 0 || dupEmail > 0;
  const medium = dupPhone > 0 || missing.length >= 3;
  const riskLevel = high ? "high" : medium ? "medium" : "low";
  const recommendation = high ? "reject" : medium ? "review" : "approve";

  return {
    riskLevel,
    recommendation,
    summary:
      riskFlags.length === 0
        ? "Clean application — unique details and a complete profile."
        : `Review recommended: ${riskFlags[0]}.`,
    legitimacySignals,
    riskFlags,
  };
}
