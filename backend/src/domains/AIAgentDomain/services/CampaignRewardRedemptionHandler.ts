// backend/src/domains/AIAgentDomain/services/CampaignRewardRedemptionHandler.ts
//
// Campaign Rewards — Phase 2 (redeem-on-return). Subscribes to
// `service.order_completed`: when a customer completes an order at a shop, any
// PENDING on_return RCN rewards that shop's campaigns promised them are issued
// now (CampaignRewardService.redeemReturning — atomic claim + mint, balance
// checked at this moment). Idempotent: the claim flips pending → redeemed in one
// statement, so a second order or a redelivered event is a no-op.
//
// Errors are swallowed here — a reward-redemption hiccup must NEVER break order
// completion (this is a fan-out subscriber alongside the booking-confirmation
// and auto-message hooks).

import { campaignRewardService } from "../../../services/CampaignRewardService";
import { logger } from "../../../utils/logger";

export class CampaignRewardRedemptionHandler {
  async handleOrderCompleted(event: any): Promise<void> {
    try {
      const data = event?.data ?? {};
      const shopId = data.shopId;
      const customerAddress = data.customerAddress;
      if (!shopId || !customerAddress) return;

      const result = await campaignRewardService.redeemReturning(shopId, customerAddress);
      if (result.redeemed > 0 || result.failed > 0) {
        logger.info("CampaignRewardRedemptionHandler: redeemed on return", {
          shopId,
          customerAddress,
          ...result,
        });
      }
    } catch (err) {
      logger.error("CampaignRewardRedemptionHandler: failed (non-fatal)", {
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

export const campaignRewardRedemptionHandler = new CampaignRewardRedemptionHandler();
