// backend/src/domains/AdsDomain/controllers/AppPlacementController.ts
//
// In-app sponsored ad placements for the customer app (first surface: the Trending Services
// grid). Returns only public-safe campaign info — image, copy, shop name, and a resolved tap
// target. Budget, spend, Meta/Google object ids and lead data are NEVER exposed here.
//
// Shape and null-safety conventions follow LandingController.ts: every enrichment degrades to a
// null field rather than failing the request.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { AppPlacementRepository, EligiblePlacementRow } from '../repositories/AppPlacementRepository';

const placements = new AppPlacementRepository();

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_PLACEMENT = 'trending_services';
/** Surfaces allowed to be logged — keeps arbitrary strings out of the analytics column.
 *  Add a new surface here when the app starts rendering placements on it. */
const KNOWN_PLACEMENTS = new Set([DEFAULT_PLACEMENT, 'marketplace']);

/** Where tapping the card sends the customer. */
type PlacementTarget =
  | { type: 'service'; serviceId: string }
  | { type: 'shop'; shopId: string };

interface AppPlacement {
  campaignId: string;
  shopId: string;
  shopName: string;
  headline: string;
  body: string | null;
  imageUrl: string;
  logoUrl: string | null;
  offer: string | null;
  target: PlacementTarget;
}

function truncate(text: string | null, max: number): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function sanitizePlacement(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return KNOWN_PLACEMENTS.has(value) ? value : DEFAULT_PLACEMENT;
}

/**
 * Resolve the tap target for one campaign: the first still-active promoted service, else the
 * shop. A brief's promote_service_ids is a snapshot from when the campaign was requested — the
 * service may have been deactivated since, which is why it's re-checked against shop_services.
 */
function resolveTarget(
  row: EligiblePlacementRow,
  activeServiceIds: Set<string>
): PlacementTarget {
  const promoted = row.promoteServiceIds.find((id) => activeServiceIds.has(id));
  return promoted ? { type: 'service', serviceId: promoted } : { type: 'shop', shopId: row.shopId };
}

// GET /api/ads/app-placements — customer-authenticated. Sponsored cards for an in-app surface.
export async function getAppPlacements(req: Request, res: Response): Promise<void> {
  try {
    const requested = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const placement = sanitizePlacement(req.query.placement);

    const rows = await placements.listEligible(limit);
    if (!rows.length) {
      res.json({ success: true, data: [] });
      return;
    }

    // One lookup for every promoted service across all campaigns, rather than per campaign.
    const allPromotedIds = [...new Set(rows.flatMap((r) => r.promoteServiceIds))];
    const activeServices = await placements.findActiveServices(allPromotedIds).catch(() => []);
    const activeServiceIds = new Set(activeServices.map((s) => s.serviceId));

    const data: AppPlacement[] = rows.map((row) => ({
      campaignId: row.campaignId,
      shopId: row.shopId,
      shopName: row.shopName,
      // Creative headline is the intended copy; the brief's offer and the shop name are
      // progressively weaker fallbacks so the card always has a title.
      headline: truncate(row.headline, 80) ?? truncate(row.offer, 80) ?? row.shopName,
      body: truncate(row.body, 140),
      imageUrl: row.imageUrl,
      logoUrl: row.logoUrl,
      offer: truncate(row.offer, 60),
      target: resolveTarget(row, activeServiceIds),
    }));

    res.json({ success: true, data, meta: { placement } });
  } catch (err) {
    logger.error('AppPlacementController.getAppPlacements failed', err);
    res.status(500).json({ success: false, error: 'Failed to load placements' });
  }
}

// POST /api/ads/app-placements/:campaignId/click — customer-authenticated tap log.
// Analytics must never break the tap: unknown campaigns 404, but a failed insert still 200s.
export async function recordPlacementClick(req: Request, res: Response): Promise<void> {
  const { campaignId } = req.params;
  try {
    if (!(await placements.campaignExists(campaignId))) {
      res.status(404).json({ success: false, error: 'not_found' });
      return;
    }

    const address = (req as any).user?.address;
    await placements.recordClick({
      campaignId,
      customerAddress: typeof address === 'string' ? address.toLowerCase() : null,
      placement: sanitizePlacement(req.body?.placement),
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('AppPlacementController.recordPlacementClick failed', err);
    // Swallow: the client has already navigated. A lost analytics row is not a client error.
    res.json({ success: true });
  }
}
