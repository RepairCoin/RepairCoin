import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

/**
 * ShopFavoriteRepository — "follow shop" relationships (shop_favorites table).
 * Distinct from FavoriteRepository (per-service). Backs the customer's followed-shops
 * list and the follower lookup used to notify on new services.
 */
export class ShopFavoriteRepository extends BaseRepository {
  async follow(customerAddress: string, shopId: string): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO shop_favorites (customer_address, shop_id)
         VALUES ($1, $2)
         ON CONFLICT (customer_address, shop_id) DO NOTHING`,
        [customerAddress.toLowerCase(), shopId]
      );
    } catch (error) {
      logger.error('Error following shop:', error);
      throw new Error('Failed to follow shop');
    }
  }

  async unfollow(customerAddress: string, shopId: string): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM shop_favorites WHERE customer_address = $1 AND shop_id = $2`,
        [customerAddress.toLowerCase(), shopId]
      );
    } catch (error) {
      logger.error('Error unfollowing shop:', error);
      throw new Error('Failed to unfollow shop');
    }
  }

  async isFollowing(customerAddress: string, shopId: string): Promise<boolean> {
    try {
      const r = await this.pool.query(
        `SELECT 1 FROM shop_favorites WHERE customer_address = $1 AND shop_id = $2 LIMIT 1`,
        [customerAddress.toLowerCase(), shopId]
      );
      return r.rows.length > 0;
    } catch (error) {
      logger.error('Error checking shop follow:', error);
      return false;
    }
  }

  /** Shop ids the customer follows, most recent first. */
  async getFollowedShopIds(customerAddress: string): Promise<string[]> {
    try {
      const r = await this.pool.query(
        `SELECT shop_id FROM shop_favorites WHERE customer_address = $1 ORDER BY created_at DESC`,
        [customerAddress.toLowerCase()]
      );
      return r.rows.map((row) => row.shop_id);
    } catch (error) {
      logger.error('Error listing followed shops:', error);
      throw new Error('Failed to list followed shops');
    }
  }

  /** Wallet addresses of everyone following a shop — used to fan out alerts. */
  async getFollowerAddresses(shopId: string): Promise<string[]> {
    try {
      const r = await this.pool.query(
        `SELECT customer_address FROM shop_favorites WHERE shop_id = $1`,
        [shopId]
      );
      return r.rows.map((row) => row.customer_address);
    } catch (error) {
      logger.error('Error listing shop followers:', error);
      return [];
    }
  }

  async getFollowerCount(shopId: string): Promise<number> {
    try {
      const r = await this.pool.query(
        `SELECT COUNT(*)::int AS n FROM shop_favorites WHERE shop_id = $1`,
        [shopId]
      );
      return r.rows[0]?.n ?? 0;
    } catch (error) {
      logger.error('Error counting shop followers:', error);
      return 0;
    }
  }

  /**
   * Follower counts for many shops in one query — so a grid of shop cards costs
   * one round trip instead of one per card. Shops with no followers are omitted;
   * callers should treat a missing key as 0.
   */
  async getFollowerCounts(shopIds: string[]): Promise<Record<string, number>> {
    if (shopIds.length === 0) return {};
    try {
      const r = await this.pool.query(
        `SELECT shop_id, COUNT(*)::int AS n
           FROM shop_favorites
          WHERE shop_id = ANY($1::varchar[])
          GROUP BY shop_id`,
        [shopIds]
      );
      const counts: Record<string, number> = {};
      for (const row of r.rows) counts[row.shop_id] = row.n;
      return counts;
    } catch (error) {
      logger.error('Error counting shop followers (batch):', error);
      return {};
    }
  }
}
