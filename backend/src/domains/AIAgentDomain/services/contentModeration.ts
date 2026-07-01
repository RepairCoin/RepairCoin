// backend/src/domains/AIAgentDomain/services/contentModeration.ts
//
// AI Content Moderation (Admin AI #5).
// Scans active service listings and recent reviews through the OpenAI moderation
// endpoint and surfaces flagged content for admin review. On-demand + cached
// (no new table/migration). Fails open per-item (a moderation error never blocks
// the scan).

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { openAIModerationClient } from "../../../services/openai/OpenAIModerationClient";

const SERVICE_LIMIT = 250;
const REVIEW_LIMIT = 250;
const REVIEW_LOOKBACK_DAYS = 90;
const BATCH = 8;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export interface FlaggedContent {
  type: "service" | "review";
  id: string;
  shopId: string | null;
  snippet: string;
  categories: string[];
}

export interface ContentModerationResult {
  generatedAt: string;
  scannedServices: number;
  scannedReviews: number;
  flagged: FlaggedContent[];
}

let cache: { at: number; value: ContentModerationResult } | null = null;

async function runBatched<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH) {
    await Promise.all(items.slice(i, i + BATCH).map(fn));
  }
}

export async function scanContent(
  force = false,
  pool: Pool = getSharedPool()
): Promise<ContentModerationResult> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const services = await pool.query<{ service_id: string; shop_id: string; service_name: string; description: string | null }>(
    `SELECT service_id, shop_id, service_name, description
     FROM shop_services
     WHERE active = true
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $1`,
    [SERVICE_LIMIT]
  );
  const reviews = await pool.query<{ review_id: string; shop_id: string; comment: string | null }>(
    `SELECT review_id, shop_id, comment
     FROM service_reviews
     WHERE comment IS NOT NULL AND comment <> ''
       AND created_at >= NOW() - ($1::int || ' days')::interval
     ORDER BY created_at DESC
     LIMIT $2`,
    [REVIEW_LOOKBACK_DAYS, REVIEW_LIMIT]
  );

  const flagged: FlaggedContent[] = [];

  await runBatched(services.rows, async (s) => {
    const text = `${s.service_name} ${s.description ?? ""}`.trim();
    if (!text) return;
    const res = await openAIModerationClient.check(text);
    if (res.flagged) {
      flagged.push({
        type: "service",
        id: s.service_id,
        shopId: s.shop_id,
        snippet: text.slice(0, 200),
        categories: res.categories,
      });
    }
  });

  await runBatched(reviews.rows, async (r) => {
    const text = (r.comment ?? "").trim();
    if (!text) return;
    const res = await openAIModerationClient.check(text);
    if (res.flagged) {
      flagged.push({
        type: "review",
        id: r.review_id,
        shopId: r.shop_id,
        snippet: text.slice(0, 200),
        categories: res.categories,
      });
    }
  });

  const value: ContentModerationResult = {
    generatedAt: new Date().toISOString(),
    scannedServices: services.rows.length,
    scannedReviews: reviews.rows.length,
    flagged,
  };
  cache = { at: Date.now(), value };
  logger.info(
    `🧹 Content moderation scan: ${value.scannedServices} services + ${value.scannedReviews} reviews → ${flagged.length} flagged`
  );
  return value;
}

/** Deactivate a flagged service listing (admin enforcement). */
export async function deactivateService(
  serviceId: string,
  pool: Pool = getSharedPool()
): Promise<boolean> {
  const res = await pool.query(
    `UPDATE shop_services SET active = false, updated_at = NOW() WHERE service_id = $1`,
    [serviceId]
  );
  // Drop the cached scan so the deactivated item disappears on next view.
  cache = null;
  return (res.rowCount ?? 0) > 0;
}

/** Remove a flagged review (admin enforcement — deletes the inappropriate review). */
export async function removeReview(
  reviewId: string,
  pool: Pool = getSharedPool()
): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM service_reviews WHERE review_id = $1`,
    [reviewId]
  );
  // Drop the cached scan so the removed item disappears on next view.
  cache = null;
  return (res.rowCount ?? 0) > 0;
}
