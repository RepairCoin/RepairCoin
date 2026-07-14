import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { requireShopPermission, requireAnyShopPermission } from '../../../middleware/permissions';
import { requireTier } from '../../../middleware/tierGuard';
import { shopLocationRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

const router = Router();

// Viewing and editing a location is available to every tier (a shop always has its primary
// location). Adding/removing locations and changing the primary is Business-tier only.
const guard = [authMiddleware, requireRole(['shop']), requireShopPermission('shop:manage')];
const guardBusiness = [...guard, requireTier('multiLocation')];
// Reading the location list is needed both to manage locations (shop:manage) and to pick
// one when booking (bookings:manage), so staff who can book can list — but not edit — them.
const readGuard = [
  authMiddleware,
  requireRole(['shop']),
  requireAnyShopPermission(['shop:manage', 'bookings:manage']),
];

// Coerce a lat/lng-ish value to a finite number or null.
const toNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Trim a string field to null when empty/absent.
const toStr = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
};

// GET /api/shops/locations — list this shop's locations
router.get('/', readGuard, async (req: Request, res: Response) => {
  try {
    const locations = await shopLocationRepository.listByShop(req.user!.shopId!);
    res.json({ success: true, data: locations });
  } catch (error) {
    logger.error('Error listing shop locations:', error);
    res.status(500).json({ success: false, error: 'Failed to list locations' });
  }
});

// POST /api/shops/locations — create a location (Business tier)
router.post('/', guardBusiness, async (req: Request, res: Response) => {
  try {
    const name = toStr(req.body?.name);
    if (!name) {
      return res.status(400).json({ success: false, error: 'Location name is required' });
    }

    const location = await shopLocationRepository.create({
      shopId: req.user!.shopId!,
      name,
      address: toStr(req.body?.address),
      city: toStr(req.body?.city),
      state: toStr(req.body?.state),
      zipCode: toStr(req.body?.zipCode),
      lat: toNum(req.body?.lat),
      lng: toNum(req.body?.lng),
      phone: toStr(req.body?.phone),
      active: req.body?.active === undefined ? true : !!req.body.active,
    });

    res.status(201).json({ success: true, data: location });
  } catch (error) {
    logger.error('Error creating shop location:', error);
    res.status(500).json({ success: false, error: 'Failed to create location' });
  }
});

// PUT /api/shops/locations/:id — update a location
router.put('/:id', guard, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const existing = await shopLocationRepository.getById(req.params.id);
    if (!existing || existing.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const updates: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      const name = toStr(req.body.name);
      if (!name) {
        return res.status(400).json({ success: false, error: 'Location name cannot be empty' });
      }
      updates.name = name;
    }
    if (req.body?.address !== undefined) updates.address = toStr(req.body.address);
    if (req.body?.city !== undefined) updates.city = toStr(req.body.city);
    if (req.body?.state !== undefined) updates.state = toStr(req.body.state);
    if (req.body?.zipCode !== undefined) updates.zipCode = toStr(req.body.zipCode);
    if (req.body?.lat !== undefined) updates.lat = toNum(req.body.lat);
    if (req.body?.lng !== undefined) updates.lng = toNum(req.body.lng);
    if (req.body?.phone !== undefined) updates.phone = toStr(req.body.phone);
    if (req.body?.active !== undefined) {
      if (existing.isPrimary && !req.body.active) {
        return res.status(400).json({ success: false, error: 'Cannot deactivate the primary location' });
      }
      updates.active = !!req.body.active;
    }

    const updated = await shopLocationRepository.update(req.params.id, updates);
    if (existing.isPrimary) {
      await shopLocationRepository.syncShopCanonicalAddress(shopId);
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating shop location:', error);
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
});

// POST /api/shops/locations/:id/primary — mark a location as the shop's primary (Business tier)
router.post('/:id/primary', guardBusiness, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const existing = await shopLocationRepository.getById(req.params.id);
    if (!existing || existing.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const updated = await shopLocationRepository.setPrimary(shopId, req.params.id);
    await shopLocationRepository.syncShopCanonicalAddress(shopId);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error setting primary location:', error);
    res.status(500).json({ success: false, error: 'Failed to set primary location' });
  }
});

// DELETE /api/shops/locations/:id — delete a location (Business tier)
router.delete('/:id', guardBusiness, async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const existing = await shopLocationRepository.getById(req.params.id);
    if (!existing || existing.shopId !== shopId) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    // The primary is the shop's canonical location; set another primary before deleting it.
    if (existing.isPrimary) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the primary location. Set another location as primary first.',
      });
    }

    await shopLocationRepository.delete(req.params.id);
    await shopLocationRepository.syncShopCanonicalAddress(shopId);
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    logger.error('Error deleting shop location:', error);
    res.status(500).json({ success: false, error: 'Failed to delete location' });
  }
});

export default router;
