// frontend/src/services/api/aiUsage.ts
//
// Admin client for platform-wide AI spend, backed by the ai_usage_events view (migration 240).
//
// Three lenses that must NOT be summed together — they are different directions of money:
//   COGS      money OUT — what Anthropic/OpenAI/Stability cost us (ads AI included).
//   Overage   money IN  — what we bill shops past their allowance (Usage ×3).
//   Recon     neither   — the audit vs the per-shop counters, as a drift alarm.
//
// The axios interceptor pre-unwraps response.data, so we unwrap the {success,data} envelope here.

import apiClient from './client';

// --- AI COGS (money out) ---

export interface AiFeatureCost {
  feature: string;
  vendor: string;
  calls: number;
  costUsd: number;
  /** false for ads-attributed spend, which bills to the ads budget rather than a shop's AI allowance. */
  billableToShop: boolean;
}

export interface AiModelCost {
  model: string | null; // null = a source that records no model (voice router, ads lead replies)
  calls: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AiShopCost {
  shopId: string;
  shopName: string | null;
  calls: number;
  costUsd: number;
  billableCostUsd: number;
}

export interface AiTrendPoint {
  day: string; // YYYY-MM-DD
  costUsd: number;
  calls: number;
}

export interface AiCogs {
  totalCostUsd: number;
  billableCostUsd: number;
  adsCostUsd: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  errorRate: number;
  avgCostPerCallUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byFeature: AiFeatureCost[];
  byModel: AiModelCost[];
  byShop: AiShopCost[];
  trend: AiTrendPoint[];
}

export interface AiReconShop {
  shopId: string;
  shopName: string | null;
  derivedUsd: number;
  counterUsd: number;
  driftUsd: number;
}

export interface AiReconciliation {
  /** Always "current-month" — the window the spend cap enforces on, regardless of the COGS period. */
  scope: string;
  derivedTotalUsd: number;
  counterTotalUsd: number;
  driftUsd: number;
  shops: AiReconShop[];
}

export interface AiCostSummary {
  periodDays: number;
  cogs: AiCogs;
  reconciliation: AiReconciliation;
}

const unwrap = <T>(res: any): T => (res.data.data ?? res.data) as T;

export const getAiCostSummary = async (days = 30): Promise<AiCostSummary> => {
  const res = await apiClient.get('/ai/admin/cost-summary', { params: { days } });
  return unwrap<AiCostSummary>(res);
};

// --- AI Usage Overage (money in, T3.2) ---
// Lives here rather than in messagingCosts.ts: overage is AI revenue, not carrier cost. It was
// surfaced on the Messaging Costs tab only because that tab existed first.

export interface OverageShopRow {
  shopId: string;
  shopName: string | null;
  overageCostCents: number;
  amountCents: number; // billable = cost × 3
  status: string;
}

export interface OveragePendingRow {
  shopId: string;
  shopName: string | null;
  amountCents: number; // billable pending across completed months
  monthCount: number;
}

export interface AdminOverageSummary {
  shops: OverageShopRow[];
  grandTotal: { overageCostCents: number; amountCents: number; shopCount: number };
  /** "Ready to invoice" — completed-month pending overage (what the invoice button acts on). */
  pending: { shops: OveragePendingRow[]; grandTotal: { amountCents: number; shopCount: number } };
  /** Whether Stripe charging is live (AI_OVERAGE_STRIPE_ENABLED). Gates the invoice buttons. */
  stripeEnabled: boolean;
}

/** Per-shop AI Usage Overage this month + grand total + ready-to-invoice rollup (admin). */
export const getAdminOverageSummary = async (): Promise<AdminOverageSummary> => {
  const res = await apiClient.get('/ai/admin/overage-summary');
  return unwrap<AdminOverageSummary>(res);
};

export interface InvoiceOverageResult {
  stripeInvoiceId?: string;
  totalCents?: number;
  status?: string;
  results?: Array<{ shopId: string; ok: boolean; error?: string }>;
}

/** Invoice a shop's pending overage (shopId), or every due shop (all:true). Admin, gated by
 *  AI_OVERAGE_STRIPE_ENABLED (501 when off). Throws with the server's status/message on failure. */
export const invoiceOveragePending = async (
  arg: { shopId: string } | { all: true }
): Promise<InvoiceOverageResult> => {
  const res = await apiClient.post('/ai/admin/overage-invoice', arg);
  return unwrap<InvoiceOverageResult>(res);
};

// --- formatting ---

/** Cents (fractional allowed) → "$0.14". */
export const fmtCents = (cents: number): string => `$${((cents || 0) / 100).toFixed(2)}`;

/** USD → "$1.23". Sub-cent AI costs would all render "$0.00", so those get 4dp instead. */
export const fmtUsd = (usd: number): string => {
  const n = usd || 0;
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
};

/** Human label for a view `feature` value. Unknown features fall back to the raw slug. */
export const FEATURE_LABELS: Record<string, string> = {
  agent: 'Customer chat (Sales Agent)',
  orchestrate: 'Unified Assistant',
  insights: 'Business insights',
  marketing: 'Marketing assistant',
  help: 'How-To assistant',
  image: 'Image generation',
  voice_stt: 'Voice transcription',
  voice_router: 'Voice router',
  voice_tts: 'Voice speech',
  brand_kit: 'Brand kit (vision)',
  faq_suggestion: 'FAQ suggestions',
  ads_creative: 'Ads — creative gen',
  ads_lead: 'Ads — lead replies',
};

export const featureLabel = (f: string): string => FEATURE_LABELS[f] ?? f;
