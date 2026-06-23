// backend/src/services/FraudScanService.ts
//
// Fraud & Abuse Detection — Phase 1 (Admin AI #1).
// See docs/FRAUD_DETECTION_SPEC.md.
//
// Runs a set of read-only detection rules over the transaction ledger + reviews,
// scores each finding 0-100, and upserts into `fraud_findings` for admin review.
// Designed to run as a scheduled batch (nightly), NOT on the request hot path.
//
// Phase 1 rules: concentrated_issuance, rapid_earn_redeem, issuance_spike,
// review_brigading. Explanations are templated here; Phase 4 will AI-phrase them.
//
// Defaults (open questions in the spec — adjust as needed):
//   - severity >= 70 is "high" (notify-worthy)
//   - windows: 7d for spikes/brigading/cycling, 30d for concentration
//   - recommended_action: >=80 freeze, >=50 investigate, else dismiss

import { Pool } from "pg";
import { getSharedPool } from "../utils/database-pool";
import { logger } from "../utils/logger";

export interface RawFinding {
  ruleKey: string;
  subjectType: "shop" | "customer" | "pair";
  shopId?: string | null;
  customerAddress?: string | null;
  windowStart: Date;
  windowEnd: Date;
  severity: number; // 0-100
  metrics: Record<string, unknown>;
  explanation: string;
}

export interface FraudScanResult {
  scanned: number; // total findings produced this run
  upserted: number; // rows written/updated
  byRule: Record<string, number>;
}

const HIGH_SEVERITY = 70;

function recommendedAction(severity: number): string {
  if (severity >= 80) return "freeze";
  if (severity >= 50) return "investigate";
  return "dismiss";
}

function clampSeverity(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export class FraudScanService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getSharedPool();
  }

  /** Run all rules, upsert findings, return a summary. */
  async runScan(): Promise<FraudScanResult> {
    const windowEnd = new Date();
    const rules: Array<() => Promise<RawFinding[]>> = [
      () => this.ruleConcentratedIssuance(windowEnd),
      () => this.ruleRapidEarnRedeem(windowEnd),
      () => this.ruleIssuanceSpike(windowEnd),
      () => this.ruleReviewBrigading(windowEnd),
    ];

    const byRule: Record<string, number> = {};
    let all: RawFinding[] = [];
    for (const rule of rules) {
      try {
        const found = await rule();
        all = all.concat(found);
        for (const f of found) byRule[f.ruleKey] = (byRule[f.ruleKey] || 0) + 1;
      } catch (err) {
        logger.error("Fraud rule failed:", err);
      }
    }

    let upserted = 0;
    for (const f of all) {
      try {
        await this.upsertFinding(f);
        upserted++;
      } catch (err) {
        logger.error("Failed to upsert fraud finding:", err);
      }
    }

    const high = all.filter((f) => f.severity >= HIGH_SEVERITY).length;
    logger.info(
      `🛡️ Fraud scan complete: ${all.length} findings (${high} high-severity), ${upserted} upserted`
    );
    return { scanned: all.length, upserted, byRule };
  }

  // --- Rule 1: concentrated issuance (30d) -------------------------------------
  // A shop issues a large share of its RCN to a tiny set of wallets.
  private async ruleConcentratedIssuance(windowEnd: Date): Promise<RawFinding[]> {
    const windowStart = new Date(windowEnd.getTime() - 30 * 86400000);
    const { rows } = await this.pool.query<{
      shop_id: string;
      total: string;
      wallet_count: string;
      top3_amt: string;
      top3_share: string;
    }>(
      `WITH shop_issuance AS (
         SELECT shop_id, customer_address, SUM(amount) AS amt
         FROM transactions
         WHERE type = 'mint' AND status = 'confirmed' AND shop_id IS NOT NULL
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY shop_id, customer_address
       ),
       totals AS (
         SELECT shop_id, SUM(amt) AS total, COUNT(*) AS wallet_count
         FROM shop_issuance GROUP BY shop_id
       ),
       top3 AS (
         SELECT shop_id, SUM(amt) AS top3_amt FROM (
           SELECT shop_id, amt,
                  ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY amt DESC) rn
           FROM shop_issuance
         ) x WHERE rn <= 3 GROUP BY shop_id
       )
       SELECT t.shop_id, t.total::text, t.wallet_count::text,
              top3.top3_amt::text,
              (top3.top3_amt / NULLIF(t.total, 0))::text AS top3_share
       FROM totals t JOIN top3 ON t.shop_id = top3.shop_id
       WHERE t.wallet_count >= 5 AND t.total > 0
         AND (top3.top3_amt / NULLIF(t.total, 0)) > 0.6`
    );

    return rows.map((r) => {
      const share = parseFloat(r.top3_share);
      const severity = clampSeverity(share * 100);
      return {
        ruleKey: "concentrated_issuance",
        subjectType: "shop" as const,
        shopId: r.shop_id,
        windowStart,
        windowEnd,
        severity,
        metrics: {
          totalIssued: parseFloat(r.total),
          walletCount: parseInt(r.wallet_count, 10),
          top3Amount: parseFloat(r.top3_amt),
          top3Share: Number(share.toFixed(3)),
        },
        explanation: `Shop issued ${(share * 100).toFixed(0)}% of its 30-day RCN to just 3 wallets (out of ${r.wallet_count}). Possible reward-funneling or collusion.`,
      };
    });
  }

  // --- Rule 2: rapid earn→redeem cycling (7d) ---------------------------------
  // A wallet repeatedly earns then redeems large amounts in a short window.
  private async ruleRapidEarnRedeem(windowEnd: Date): Promise<RawFinding[]> {
    const windowStart = new Date(windowEnd.getTime() - 7 * 86400000);
    const { rows } = await this.pool.query<{
      customer_address: string;
      mint_count: string;
      redeem_count: string;
      mint_total: string;
      redeem_total: string;
    }>(
      `SELECT customer_address,
              COUNT(*) FILTER (WHERE type = 'mint')   AS mint_count,
              COUNT(*) FILTER (WHERE type = 'redeem') AS redeem_count,
              COALESCE(SUM(amount) FILTER (WHERE type = 'mint'), 0)   AS mint_total,
              COALESCE(SUM(amount) FILTER (WHERE type = 'redeem'), 0) AS redeem_total
       FROM transactions
       WHERE status = 'confirmed' AND customer_address IS NOT NULL
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY customer_address
       HAVING COUNT(*) FILTER (WHERE type = 'mint') >= 4
          AND COUNT(*) FILTER (WHERE type = 'redeem') >= 4
          AND COALESCE(SUM(amount) FILTER (WHERE type = 'redeem'), 0)
              >= 0.7 * COALESCE(SUM(amount) FILTER (WHERE type = 'mint'), 1)`
    );

    return rows.map((r) => {
      const cycles = Math.min(parseInt(r.mint_count, 10), parseInt(r.redeem_count, 10));
      // 4 cycles -> ~55, 10+ -> capped at ~95
      const severity = clampSeverity(40 + cycles * 5);
      return {
        ruleKey: "rapid_earn_redeem",
        subjectType: "customer" as const,
        customerAddress: r.customer_address,
        windowStart,
        windowEnd,
        severity,
        metrics: {
          mintCount: parseInt(r.mint_count, 10),
          redeemCount: parseInt(r.redeem_count, 10),
          mintTotal: parseFloat(r.mint_total),
          redeemTotal: parseFloat(r.redeem_total),
        },
        explanation: `Wallet earned and redeemed in rapid cycles over 7 days (${r.mint_count} earns / ${r.redeem_count} redeems, redeeming ${((parseFloat(r.redeem_total) / (parseFloat(r.mint_total) || 1)) * 100).toFixed(0)}% of what it earned). Possible wash/extraction pattern.`,
      };
    });
  }

  // --- Rule 3: issuance spike (7d peak vs 30d baseline) -----------------------
  // A shop's recent daily issuance jumps far above its own baseline.
  private async ruleIssuanceSpike(windowEnd: Date): Promise<RawFinding[]> {
    const windowStart = new Date(windowEnd.getTime() - 7 * 86400000);
    const { rows } = await this.pool.query<{
      shop_id: string;
      peak_day: string;
      avg_daily: string;
      ratio: string;
    }>(
      `WITH daily AS (
         SELECT shop_id, DATE(created_at) AS d, SUM(amount) AS amt
         FROM transactions
         WHERE type = 'mint' AND status = 'confirmed' AND shop_id IS NOT NULL
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY shop_id, DATE(created_at)
       ),
       agg AS (
         SELECT shop_id,
                AVG(amt) AS avg_daily,
                MAX(amt) FILTER (WHERE d >= (CURRENT_DATE - INTERVAL '7 days')) AS peak_recent,
                COUNT(*) AS active_days
         FROM daily GROUP BY shop_id
       )
       SELECT shop_id, peak_recent::text AS peak_day, avg_daily::text,
              (peak_recent / NULLIF(avg_daily, 0))::text AS ratio
       FROM agg
       WHERE active_days >= 5 AND avg_daily > 0 AND peak_recent IS NOT NULL
         AND (peak_recent / NULLIF(avg_daily, 0)) >= 5`
    );

    return rows.map((r) => {
      const ratio = parseFloat(r.ratio);
      // 5x -> 50, 10x -> 75, 14x+ -> capped ~95
      const severity = clampSeverity(25 + ratio * 5);
      return {
        ruleKey: "issuance_spike",
        subjectType: "shop" as const,
        shopId: r.shop_id,
        windowStart,
        windowEnd,
        severity,
        metrics: {
          peakDayIssuance: parseFloat(r.peak_day),
          avgDailyIssuance: Number(parseFloat(r.avg_daily).toFixed(2)),
          spikeRatio: Number(ratio.toFixed(1)),
        },
        explanation: `Shop's recent peak daily RCN issuance was ${ratio.toFixed(1)}× its 30-day average — an unusual spike worth reviewing.`,
      };
    });
  }

  // --- Rule 4: review brigading (24h burst) -----------------------------------
  // A shop receives a burst of reviews in a short window.
  private async ruleReviewBrigading(windowEnd: Date): Promise<RawFinding[]> {
    const windowStart = new Date(windowEnd.getTime() - 1 * 86400000);
    const { rows } = await this.pool.query<{
      shop_id: string;
      review_count: string;
      distinct_customers: string;
      avg_rating: string;
    }>(
      `SELECT shop_id,
              COUNT(*) AS review_count,
              COUNT(DISTINCT customer_address) AS distinct_customers,
              AVG(rating)::numeric(4,2) AS avg_rating
       FROM service_reviews
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY shop_id
       HAVING COUNT(*) >= 5`
    );

    return rows.map((r) => {
      const count = parseInt(r.review_count, 10);
      // 5 -> 55, 10 -> 80, 15+ -> capped ~95
      const severity = clampSeverity(30 + count * 5);
      return {
        ruleKey: "review_brigading",
        subjectType: "shop" as const,
        shopId: r.shop_id,
        windowStart,
        windowEnd,
        severity,
        metrics: {
          reviewCount: count,
          distinctCustomers: parseInt(r.distinct_customers, 10),
          avgRating: parseFloat(r.avg_rating),
        },
        explanation: `Shop received ${count} reviews in 24 hours (avg rating ${r.avg_rating}) — an unusual burst that may indicate review manipulation.`,
      };
    });
  }

  // --- upsert -----------------------------------------------------------------
  // Dedupe on (rule, subject, window-start day). Re-running updates an OPEN
  // finding's score/metrics but never resurrects a reviewed (dismissed/confirmed)
  // one.
  private async upsertFinding(f: RawFinding): Promise<void> {
    const windowStartDay = new Date(
      Date.UTC(
        f.windowStart.getUTCFullYear(),
        f.windowStart.getUTCMonth(),
        f.windowStart.getUTCDate()
      )
    );
    await this.pool.query(
      `INSERT INTO fraud_findings
         (rule_key, severity, status, subject_type, shop_id, customer_address,
          window_start, window_end, metrics, explanation, recommended_action)
       VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       ON CONFLICT (rule_key, subject_type, COALESCE(shop_id, ''),
                    COALESCE(customer_address, ''),
                    COALESCE(window_start, '1970-01-01'::timestamp))
       DO UPDATE SET
         severity = EXCLUDED.severity,
         window_end = EXCLUDED.window_end,
         metrics = EXCLUDED.metrics,
         explanation = EXCLUDED.explanation,
         recommended_action = EXCLUDED.recommended_action
       WHERE fraud_findings.status = 'open'`,
      [
        f.ruleKey,
        f.severity,
        f.subjectType,
        f.shopId ?? null,
        f.customerAddress ?? null,
        windowStartDay,
        f.windowEnd,
        JSON.stringify(f.metrics),
        f.explanation,
        recommendedAction(f.severity),
      ]
    );
  }
}

let singleton: FraudScanService | null = null;
export function getFraudScanService(): FraudScanService {
  if (!singleton) singleton = new FraudScanService();
  return singleton;
}
