import { Router, Request, Response } from 'express';
import { shopTaxRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { authMiddleware, requireRole } from '../../../middleware/auth';

const router = Router();

router.use(authMiddleware, requireRole(['shop']));

// Rates arrive as a percentage because that is how a shop thinks about tax, and are stored as
// basis points so 8.25% survives without a float.
const toBps = (percent: unknown): number => {
  const value = Number(percent);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw Object.assign(new Error('Tax rate must be between 0 and 100 percent.'), { status: 400 });
  }
  return Math.round(value * 100);
};

router.get('/pos/tax-rates', async (req: Request, res: Response) => {
  const shopId = req.user?.shopId;
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const rates = await shopTaxRepository.listByShop(shopId);
    return res.json({ success: true, data: { rates } });
  } catch (error) {
    logger.error('Failed to list tax rates', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ success: false, error: 'Failed to load tax rates' });
  }
});

router.put('/pos/tax-rates', async (req: Request, res: Response) => {
  const shopId = req.user?.shopId;
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const rateBps = toBps(req.body?.ratePercent);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const locationId = typeof req.body?.locationId === 'string' ? req.body.locationId : null;

    const rate = locationId
      ? await shopTaxRepository.upsert({ shopId, locationId, name, rateBps })
      : await shopTaxRepository.upsertDefault({ shopId, name, rateBps });

    return res.json({ success: true, data: { rate } });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 400) {
      return res.status(400).json({ success: false, error: (error as Error).message });
    }
    logger.error('Failed to save tax rate', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ success: false, error: 'Failed to save tax rate' });
  }
});

router.delete('/pos/tax-rates/:id', async (req: Request, res: Response) => {
  const shopId = req.user?.shopId;
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const removed = await shopTaxRepository.deactivate(shopId, req.params.id);
    if (!removed) return res.status(404).json({ success: false, error: 'Tax rate not found' });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove tax rate', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ success: false, error: 'Failed to remove tax rate' });
  }
});

export default router;
