// backend/src/domains/AIAgentDomain/controllers/RecommendationsController.ts
//
// P0 — read + dismiss endpoints for the dashboard recommendation feed.
//
//   GET  /api/ai/recommendations            — active cards for this shop
//   POST /api/ai/recommendations/:id/dismiss — snooze (default) or dismiss
//   POST /api/ai/recommendations/:id/acted   — record a tap-through
//
// Shop-scoped via JWT (req.user.shopId) — never trusts the URL or body for
// scope, matching InsightsAnomaliesController.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import {
  RecommendationService,
  getRecommendationService,
} from '../services/recommendations/RecommendationService';

export interface RecommendationsControllerDeps {
  service?: RecommendationService;
}

export function makeRecommendationsController(
  deps: RecommendationsControllerDeps = {}
) {
  const service = deps.service ?? getRecommendationService();

  const requireShop = (req: Request, res: Response): string | null => {
    const shopId = (req as any).user?.shopId;
    if (!shopId) {
      res.status(401).json({ success: false, error: 'Shop ID required' });
      return null;
    }
    return shopId;
  };

  return {
    listRecommendations: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = requireShop(req, res);
        if (!shopId) return;

        const limitRaw = Number(req.query.limit);
        const limit =
          Number.isFinite(limitRaw) && limitRaw > 0
            ? Math.min(limitRaw, 20)
            : undefined;

        // Which dashboard surface is asking: the recommendations list ('card',
        // the default) or the Priority Actions grid ('action'). Anything else
        // falls back to 'card' rather than erroring — a bad query param should
        // not blank the dashboard.
        const presentation =
          req.query.presentation === 'action' ? 'action' : 'card';

        const [recommendations, gatedCount] = await Promise.all([
          service.listForShop(shopId, limit, presentation),
          service.countGatedForShop(shopId),
        ]);

        res.json({ success: true, data: { recommendations, gatedCount } });
      } catch (err) {
        logger.error('RecommendationsController.list failed', err);
        res
          .status(500)
          .json({ success: false, error: 'Failed to load recommendations' });
      }
    },

    dismissRecommendation: async (
      req: Request,
      res: Response
    ): Promise<void> => {
      try {
        const shopId = requireShop(req, res);
        if (!shopId) return;

        const id = req.params.id;
        if (!id || typeof id !== 'string') {
          res.status(400).json({ success: false, error: 'id required' });
          return;
        }
        // Default is a snooze so a recurring condition can resurface; the
        // client opts into a permanent dismiss explicitly.
        const permanent = req.body?.permanent === true;

        const ok = await service.dismiss(shopId, id, permanent);
        if (!ok) {
          res
            .status(404)
            .json({ success: false, error: 'Recommendation not found' });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        logger.error('RecommendationsController.dismiss failed', err);
        res
          .status(500)
          .json({ success: false, error: 'Failed to dismiss recommendation' });
      }
    },

    markActed: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = requireShop(req, res);
        if (!shopId) return;

        const id = req.params.id;
        if (!id || typeof id !== 'string') {
          res.status(400).json({ success: false, error: 'id required' });
          return;
        }
        const ok = await service.markActed(shopId, id);
        if (!ok) {
          res
            .status(404)
            .json({ success: false, error: 'Recommendation not found' });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        logger.error('RecommendationsController.markActed failed', err);
        res.status(500).json({ success: false, error: 'Failed to record' });
      }
    },
  };
}

let _defaultController: ReturnType<
  typeof makeRecommendationsController
> | null = null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeRecommendationsController();
  }
  return _defaultController;
}

export function listRecommendations(
  req: Request,
  res: Response
): Promise<void> {
  return getDefaults().listRecommendations(req, res);
}
export function dismissRecommendation(
  req: Request,
  res: Response
): Promise<void> {
  return getDefaults().dismissRecommendation(req, res);
}
export function markRecommendationActed(
  req: Request,
  res: Response
): Promise<void> {
  return getDefaults().markActed(req, res);
}
