// backend/src/domains/AdsDomain/services/adsEventListeners.ts
//
// Ads System EventBus subscriptions. Stage 2 SLA: notify the shop owner the
// moment a lead is captured (speed-to-lead is the whole game). Cross-domain via
// the bus, not a direct import — registered once from AdsDomain.initialize().

import { eventBus } from '../../../events/EventBus';
import { logger } from '../../../utils/logger';
import { AdsEvents } from '../events';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { shopRepository } from '../../../repositories';
import { getAdAttributionService } from './AdAttributionService';
import { leadInitiationService } from './LeadInitiationService';

let registered = false;

export function registerAdsEventListeners(): void {
  if (registered) return;
  registered = true;
  const campaigns = new CampaignRepository();
  const notifications = new NotificationRepository();

  eventBus.subscribe(
    AdsEvents.LEAD_CAPTURED,
    async (event: any) => {
      try {
        const campaignId = event?.data?.campaignId;
        if (!campaignId) return;
        const campaign = await campaigns.findById(campaignId);
        if (!campaign) return;
        const shop = await shopRepository.getShop(campaign.shopId);
        const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
        if (!receiver) return;
        // When the AI is set to greet new leads (auto outreach + flag on), say so — otherwise the
        // "respond quickly" push contradicts the AI having already replied.
        const aiHandling = process.env.ADS_AI_INITIATE_ENABLED === 'true' && (campaign as any).aiOutreachMode === 'auto';
        await notifications.create({
          senderAddress: 'system',
          receiverAddress: receiver,
          notificationType: 'ad_lead_new',
          message: aiHandling
            ? `New lead for "${campaign.name}" — the AI is handling first contact. Open the conversation to review or take over.`
            : `New lead for "${campaign.name}". Open it to reach out.`,
          metadata: { campaignId, leadId: event?.aggregateId },
        });
      } catch (err) {
        logger.error('AdsDomain: lead_captured notify failed', err);
      }
    },
    'AdsDomain'
  );

  // P0 conversion attribution: contact-match an order to a recent ad lead, set
  // service_orders.ad_lead_id (so the roll-up records bookings/revenue/ROI), AND advance the lead's
  // Kanban stage — forward-only — so the pipeline reflects reality without the shop dragging cards.
  // Cross-domain via the bus; gated by ADS_CONVERSION_ATTRIBUTION. Three lifecycle signals:
  //   service.order_created  → 'booked' (pending) | 'paid' (manual paid booking)
  //   service.order_paid     → 'paid'
  //   service.order_completed→ 'completed'
  const attributeFromEvent = (stage: 'booked' | 'paid' | 'completed') => async (event: any) => {
    try {
      const d = event?.data || {};
      if (!d.orderId || !d.customerAddress || !d.shopId) return;
      // order_created carries the order's status; a 'paid' manual booking should land at PAID,
      // anything else (pending) at BOOKED. paid/completed events are unambiguous.
      const resolved: 'booked' | 'paid' | 'completed' =
        stage === 'booked' && String(d.status || '').toLowerCase() === 'paid' ? 'paid' : stage;
      await getAdAttributionService().attributeOrderStage(
        { orderId: d.orderId, customerAddress: d.customerAddress, shopId: d.shopId },
        resolved
      );
    } catch (err) {
      logger.error(`AdsDomain: ${stage} attribution failed`, err);
    }
  };

  // AI-initiated first contact (Part B): on capture, auto-send the first outreach when the campaign is
  // in 'auto' outreach mode + the lead is fresh/contactable. Gated by ADS_AI_INITIATE_ENABLED (default
  // off). Separate subscriber from the notify handler above (both fire on LEAD_CAPTURED). Non-throwing.
  eventBus.subscribe(
    AdsEvents.LEAD_CAPTURED,
    async (event: any) => {
      try {
        const campaignId = event?.data?.campaignId;
        const leadId = event?.aggregateId;
        if (!campaignId || !leadId) return;
        const outcome = await leadInitiationService.onLeadCaptured(leadId, campaignId);
        if (outcome !== 'disabled' && outcome !== 'mode_not_auto') {
          logger.info(`AdsDomain: AI-initiated outreach → ${outcome}`, { leadId });
        }
      } catch (err) {
        logger.error('AdsDomain: AI-initiated outreach failed', err);
      }
    },
    'AdsDomain'
  );

  eventBus.subscribe('service.order_created', attributeFromEvent('booked'), 'AdsDomain');
  eventBus.subscribe('service.order_paid', attributeFromEvent('paid'), 'AdsDomain');
  eventBus.subscribe('service.order_completed', attributeFromEvent('completed'), 'AdsDomain');

  logger.info('AdsDomain event listeners registered (lead_captured → notify + AI-initiated outreach; order created/paid/completed → attribution + Kanban auto-advance)');
}
