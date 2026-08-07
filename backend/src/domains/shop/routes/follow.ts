// backend/src/domains/shop/routes/follow.ts
//
// Customer "follow shop" endpoints. Mounted at /api/shops/follow with
// authMiddleware + requireRole(['customer']) applied at the mount point, so every
// handler here already has an authenticated customer on req.user.
import { Router, Request, Response } from 'express';
import { ShopFavoriteRepository } from '../../../repositories/ShopFavoriteRepository';
import { shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

const router = Router();
const shopFavorites = new ShopFavoriteRepository();

/** GET /api/shops/follow — the shops this customer follows (full shop records). */
router.get('/', async (req: Request, res: Response) => {
  try {
    const customer = req.user!.address;
    const ids = await shopFavorites.getFollowedShopIds(customer);
    const shops = (
      await Promise.all(ids.map((id) => shopRepository.getShop(id).catch(() => null)))
    ).filter(Boolean);
    return res.json({ success: true, data: shops });
  } catch (error) {
    logger.error('Error listing followed shops:', error);
    return res.status(500).json({ success: false, error: 'Failed to list followed shops' });
  }
});

/** GET /api/shops/follow/:shopId/status — whether this customer follows the shop. */
router.get('/:shopId/status', async (req: Request, res: Response) => {
  try {
    const following = await shopFavorites.isFollowing(req.user!.address, req.params.shopId);
    return res.json({ success: true, data: { following } });
  } catch (error) {
    logger.error('Error checking follow status:', error);
    return res.status(500).json({ success: false, error: 'Failed to check follow status' });
  }
});

/** GET /api/shops/follow/:shopId/count — how many customers follow the shop. */
router.get('/:shopId/count', async (req: Request, res: Response) => {
  try {
    const count = await shopFavorites.getFollowerCount(req.params.shopId);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error('Error counting shop followers:', error);
    return res.status(500).json({ success: false, error: 'Failed to count followers' });
  }
});

/**
 * POST /api/shops/follow/counts — follower counts for many shops at once, so a
 * grid of shop cards costs one request instead of one per card. Registered BEFORE
 * POST /:shopId so "counts" isn't swallowed as a shop id.
 */
const MAX_COUNT_LOOKUP = 200;
router.post('/counts', async (req: Request, res: Response) => {
  try {
    const { shopIds } = req.body as { shopIds?: unknown };
    if (!Array.isArray(shopIds)) {
      return res.status(400).json({ success: false, error: 'shopIds must be an array' });
    }
    const ids = shopIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_COUNT_LOOKUP);
    const counts = await shopFavorites.getFollowerCounts(ids);
    return res.json({ success: true, data: { counts } });
  } catch (error) {
    logger.error('Error counting shop followers (batch):', error);
    return res.status(500).json({ success: false, error: 'Failed to count followers' });
  }
});

/** POST /api/shops/follow/:shopId — follow a shop. */
router.post('/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    await shopFavorites.follow(req.user!.address, shopId);
    return res.json({ success: true, data: { following: true } });
  } catch (error) {
    logger.error('Error following shop:', error);
    return res.status(500).json({ success: false, error: 'Failed to follow shop' });
  }
});

/** DELETE /api/shops/follow/:shopId — unfollow a shop. */
router.delete('/:shopId', async (req: Request, res: Response) => {
  try {
    await shopFavorites.unfollow(req.user!.address, req.params.shopId);
    return res.json({ success: true, data: { following: false } });
  } catch (error) {
    logger.error('Error unfollowing shop:', error);
    return res.status(500).json({ success: false, error: 'Failed to unfollow shop' });
  }
});

export default router;
