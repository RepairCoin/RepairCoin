// backend/src/services/audienceResolver.ts
//
// "Who does this rule act on?" — extracted from AutoMessageSchedulerService so more than one caller
// can ask.
//
// The scheduler has always resolved a rule's audience to send messages and issue rewards. A campaign
// workflow needs the same answer for a different reason: the campaign it sends must go to whoever
// qualifies AT THAT MOMENT, and the campaign's own audience vocabulary cannot express what the
// workflow means. There is no campaign equivalent of "inactive 30 days" or "holds an RCN balance".
//
// Resolving here and handing the result to the campaign sidesteps that mismatch entirely: the rule
// stays a live rule, re-evaluated on every run, and each send carries the people it actually found.

import { logger } from '../utils/logger';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { getSharedPool } from '../utils/database-pool';

const customerRepo = new CustomerRepository();

export interface AudienceQuery {
  shopId: string;
  targetAudience: string | null | undefined;
  /** Only for the log line when an audience cannot be resolved. */
  ruleId?: string;
  ruleName?: string;
  triggerType?: string | null;
  eventType?: string | null;
}

export interface AudienceMember {
  walletAddress: string;
  name?: string;
  rcnBalance?: number;
  lastServiceName?: string;
  lastVisitDate?: string;
}

/** Everyone this rule should act on right now. Empty when the audience cannot be resolved. */
export async function resolveAudience(input: AudienceQuery): Promise<AudienceMember[]> {
    const pool = getSharedPool();

    switch (input.targetAudience) {
      case 'all': {
        // All customers who have interacted with this shop
        const customers = await customerRepo.findByShopInteraction(input.shopId);
        return customers.map(c => ({
          walletAddress: c.walletAddress,
          name: c.name,
          lastVisitDate: c.lastVisit ? c.lastVisit.toLocaleDateString() : undefined,
        }));
      }

      case 'active': {
        // Customers who visited in last 30 days
        const result = await pool.query(`
          SELECT DISTINCT c.address as wallet_address, c.name,
            MAX(t.created_at) as last_visit
          FROM customers c
          INNER JOIN transactions t ON c.address = t.customer_address
          WHERE t.shop_id = $1
            AND t.created_at >= NOW() - INTERVAL '30 days'
            AND c.is_active = true
          GROUP BY c.address, c.name
        `, [input.shopId]);
        return result.rows.map((r: any) => ({
          walletAddress: r.wallet_address,
          name: r.name || undefined,
          lastVisitDate: r.last_visit ? new Date(r.last_visit).toLocaleDateString() : undefined,
        }));
      }

      case 'inactive_30d': {
        // Customers who haven't visited in 30+ days
        const result = await pool.query(`
          SELECT DISTINCT c.address as wallet_address, c.name,
            MAX(t.created_at) as last_visit
          FROM customers c
          INNER JOIN transactions t ON c.address = t.customer_address
          WHERE t.shop_id = $1
            AND c.is_active = true
          GROUP BY c.address, c.name
          HAVING MAX(t.created_at) < NOW() - INTERVAL '30 days'
        `, [input.shopId]);
        return result.rows.map((r: any) => ({
          walletAddress: r.wallet_address,
          name: r.name || undefined,
          lastVisitDate: r.last_visit ? new Date(r.last_visit).toLocaleDateString() : undefined,
        }));
      }

      case 'has_balance': {
        // Customers with RCN balance > 0 at this shop
        const result = await pool.query(`
          SELECT DISTINCT c.address as wallet_address, c.name, c.current_rcn_balance
          FROM customers c
          INNER JOIN transactions t ON c.address = t.customer_address
          WHERE t.shop_id = $1
            AND c.is_active = true
            AND c.current_rcn_balance > 0
          GROUP BY c.address, c.name, c.current_rcn_balance
        `, [input.shopId]);
        return result.rows.map((r: any) => ({
          walletAddress: r.wallet_address,
          name: r.name || undefined,
          rcnBalance: parseFloat(r.current_rcn_balance) || 0,
        }));
      }

      case 'completed_booking': {
        // Customers who completed a booking at this shop
        const result = await pool.query(`
          SELECT DISTINCT c.address as wallet_address, c.name,
            MAX(so.updated_at) as last_visit,
            (SELECT ss.service_name FROM shop_services ss
             JOIN service_orders so2 ON ss.service_id = so2.service_id
             WHERE so2.customer_address = c.address AND so2.shop_id = $1 AND so2.status = 'completed'
             ORDER BY so2.updated_at DESC LIMIT 1) as last_service_name
          FROM customers c
          INNER JOIN service_orders so ON LOWER(c.address) = LOWER(so.customer_address)
          WHERE so.shop_id = $1
            AND so.status = 'completed'
            AND c.is_active = true
          GROUP BY c.address, c.name
        `, [input.shopId]);
        return result.rows.map((r: any) => ({
          walletAddress: r.wallet_address,
          name: r.name || undefined,
          lastServiceName: r.last_service_name || undefined,
          lastVisitDate: r.last_visit ? new Date(r.last_visit).toLocaleDateString() : undefined,
        }));
      }

      default:
        // Returning [] is the right OUTCOME — an audience we cannot resolve must not fall back to
        // 'all', because guessing the widest possible audience is how a workflow messages a shop's
        // entire customer list by accident. The defect was the SILENCE: a rule with an unresolvable
        // audience showed as published and active, updated nothing, and enrolled nobody, forever, with
        // no error and no failed send to look at. Say so, loudly, and keep the safe behaviour.
        logger.error('AutoMessageScheduler: rule has an unresolvable target audience — enrolling nobody', {
          ruleId: input.ruleId,
          shopId: input.shopId,
          name: input.ruleName,
          targetAudience: input.targetAudience,
          triggerType: input.triggerType,
          eventType: input.eventType,
        });
        return [];
    }
  }
