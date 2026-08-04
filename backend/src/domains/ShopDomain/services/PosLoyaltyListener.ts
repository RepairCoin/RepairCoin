import { eventBus } from '../../../events/EventBus';
import { logger } from '../../../utils/logger';
import { customerRepository } from '../../../repositories';
import { rewardIssuanceService } from '../../../services/RewardIssuanceService';
import { calculateReward } from '../../../utils/repairReward';

/**
 * Issues RCN for a completed counter sale.
 *
 * Subscribes to `pos.sale_completed` rather than republishing the sale as `service.order_completed`.
 * Every consumer of that event — ad attribution, order confirmation, campaign redemption, messaging
 * — keys on an `orderId` pointing at a `service_orders` row a counter sale does not have, so
 * borrowing the event would feed them a sale they cannot read and would corrupt ad attribution.
 *
 * A walk-in earns nothing, because there is nobody to credit. That is the common case at a counter,
 * not an error.
 */
interface PosSaleCompletedEvent {
  data: {
    saleId: string;
    shopId: string;
    saleNumber: number | null;
    customerAddress: string | null;
    netCents: number;
  };
}

export async function issueLoyaltyForSale(event: PosSaleCompletedEvent): Promise<void> {
  const { saleId, shopId, saleNumber, customerAddress, netCents } = event.data;
  if (!customerAddress) return;

  try {
    const customer = await customerRepository.getCustomer(customerAddress);
    if (!customer) {
      logger.warn('POS loyalty: sale names a customer who is not registered', {
        saleId,
        customerAddress,
      });
      return;
    }

    const { baseReward, tierBonus, total } = calculateReward(
      (netCents ?? 0) / 100,
      customer.tier
    );
    if (total <= 0) return;

    const result = await rewardIssuanceService.issueExact({
      shopId,
      customerAddress,
      rcnAmount: total,
      source: 'pos_sale',
      reason: saleNumber ? `Counter sale #${saleNumber}` : 'Counter sale',
    });

    if (!result.ok) {
      // Never retried and never surfaced to the register: the customer has already paid and left.
      // A shop out of RCN needs to buy more, which is a conversation, not a checkout error.
      logger.warn('POS loyalty: reward not issued', {
        saleId,
        shopId,
        customerAddress,
        rcnAmount: total,
        errorCode: result.errorCode,
        error: result.error,
      });
      return;
    }

    logger.info('POS loyalty: reward issued', {
      saleId,
      shopId,
      customerAddress,
      baseReward,
      tierBonus,
      total,
      onChain: result.onChain,
    });
  } catch (error) {
    logger.error('POS loyalty: failed to issue reward', {
      saleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function setupPosLoyaltyListener(): void {
  eventBus.subscribe('pos.sale_completed', issueLoyaltyForSale, 'ShopDomain:PosLoyalty');
  logger.info('POS sale listener registered for RCN loyalty');
}
