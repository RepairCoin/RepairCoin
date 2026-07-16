import { getSharedPool } from './database-pool';

/**
 * Whether a shop is entitled to Growth-tier features via its managing agency. A client shop
 * is only entitled while the agency's own subscription is live: 'active', or 'past_due' as the
 * grace window (Stripe dunning retries before the subscription flips to 'cancelled'). A
 * cancelled agency de-entitles its clients, which revert to needing their own subscription.
 */
export async function isEntitledByAgency(shopId: string): Promise<boolean> {
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT 1 FROM shops s
         JOIN agencies a ON a.id = s.agency_id
        WHERE s.shop_id = $1 AND a.status IN ('active', 'past_due')
        LIMIT 1`,
      [shopId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}
