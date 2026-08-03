// backend/src/services/autoMessageActions/runCampaignAction.ts
//
// Custom Workflows §9.2 — the `run_campaign` action. A workflow fires a marketing campaign: the bridge
// to AI Campaigns (Advanced) that scope.md §3 called for, and the first action that reaches customers
// one-to-many instead of one at a time.
//
// It is also the first action that can send EMAIL. Every other action writes an in-app message, which
// only lands for customers who open the app; a campaign goes through CampaignEmailService (Resend).
//
// TWO CONSTRAINTS SHAPE THE WHOLE DESIGN, and neither is obvious from the outside:
//
// 1. SHOP-SCOPED, not per customer. The scheduler runs an action once per customer in the target
//    audience. For a message or a reward that is right; for a campaign it would fire one campaign per
//    recipient — fifty campaigns to fifty people, each resolving its own audience of fifty. Listing the
//    type in SHOP_SCOPED_ACTIONS is what makes it run exactly once per rule per tick. Same reasoning
//    that stopped notify_staff paging the team once per customer.
//
// 2. A CAMPAIGN IS A ONE-SHOT RECORD; A WORKFLOW RECURS. `MarketingService.sendCampaign` throws on
//    `status === 'sent'` and calls `markAsSent`, so pointing an action straight at a campaign would
//    work once and then throw on every later trigger — a workflow that quietly stops doing anything.
//    So the configured campaign is treated as a TEMPLATE: each firing CLONES it into a fresh draft and
//    sends the clone. The alternative — resetting the original to draft and re-sending — would
//    overwrite its recipients and open counts every run, destroying the history the metrics line reads.
//    Cloning also means each firing gets its own stats, which is what a shop would expect from
//    "this ran 6 times".
//
// The clone deliberately does NOT copy rewards. A campaign can issue RCN, and a recurring workflow
// firing a reward campaign every week is a standing order against the shop's balance that nobody
// signed off on. Rewards on an automated campaign need their own decision (cap? per-run budget?), so
// until that exists the clone sends the message and skips the money. Stated in the UI, not just here.

import { logger } from '../../utils/logger';
import { shopRepository } from '../../repositories';
import { MarketingCampaignRepository } from '../../repositories/MarketingCampaignRepository';
import { MarketingService } from '../MarketingService';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

export interface RunCampaignPayload {
  /** The campaign to use as a template. Must belong to the shop that owns the rule. */
  campaignId?: string;
}

export function parseRunCampaignPayload(raw: unknown): RunCampaignPayload {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = typeof o.campaignId === 'string' ? o.campaignId.trim() : '';
  return id ? { campaignId: id } : {};
}

/** Suffix so a shop can tell automated sends apart from ones it pressed send on itself. */
const cloneName = (name: string, ruleName: string) => `${name} — via ${ruleName}`.slice(0, 200);

export class RunCampaignAction implements AutoMessageActionHandler {
  readonly type = 'run_campaign';

  constructor(
    private readonly marketing: MarketingService = new MarketingService(),
    private readonly campaigns: MarketingCampaignRepository = new MarketingCampaignRepository(),
    // Injected rather than reached for at module scope, so it can be substituted in a test — a handler
    // that can only be exercised against a live database is a handler nobody exercises.
    private readonly shops: { getShop: (id: string) => Promise<any> } = shopRepository
  ) {}

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const { campaignId } = parseRunCampaignPayload(ctx.actionPayload);
    if (!campaignId) {
      logger.error('run_campaign has no campaignId — rule skipped', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
      });
      return { ok: false, skipped: 'empty' };
    }

    const source = await this.campaigns.findById(campaignId);
    if (!source) {
      logger.error('run_campaign points at a campaign that no longer exists', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        campaignId,
      });
      return { ok: false, skipped: 'empty' };
    }

    // Multi-tenant guard. The id arrives from a stored payload, and a rule could outlive the campaign
    // it named or be copied between shops — never take the caller's word for ownership.
    if (source.shopId !== ctx.shopId) {
      logger.error('run_campaign points at another shop\'s campaign — refusing', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        campaignId,
        ownerShopId: source.shopId,
      });
      return { ok: false, skipped: 'empty' };
    }

    // Fail SOFT. This only supplies the from-name and reply-to; ShopRepository.getShop throws on any
    // query error, and letting that abort the send would mean a transient database blip silently
    // cancels a campaign the shop scheduled.
    let shop: { name?: string; email?: string; walletAddress?: string } | null = null;
    try {
      shop = await this.shops.getShop(ctx.shopId);
    } catch (err) {
      logger.warn('run_campaign could not load shop details — sending with fallbacks', {
        shopId: ctx.shopId,
        error: (err as Error)?.message,
      });
    }

    try {
      // Fresh draft per firing — see constraint 2 above.
      const clone = await this.campaigns.create({
        shopId: ctx.shopId,
        name: cloneName(source.name, ctx.rule.name),
        campaignType: source.campaignType,
        subject: source.subject ?? undefined,
        previewText: source.previewText ?? undefined,
        designContent: source.designContent,
        templateId: source.templateId ?? undefined,
        audienceType: source.audienceType,
        audienceFilters: source.audienceFilters,
        deliveryMethod: source.deliveryMethod,
        serviceId: source.serviceId ?? undefined,
        createdBySource: 'ai_agent',
      });

      const result = await this.marketing.sendCampaign(clone.id, {
        id: ctx.shopId,
        name: shop?.name || ctx.shopName || 'Shop',
        email: shop?.email || '',
        walletAddress: shop?.walletAddress || '',
      });

      logger.info('run_campaign sent a campaign', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        sourceCampaignId: campaignId,
        sentCampaignId: clone.id,
        recipients: (result as { totalRecipients?: number } | undefined)?.totalRecipients,
      });

      return { ok: true };
    } catch (err) {
      // One rule must never take down the tick — the scheduler is processing every shop.
      logger.error('run_campaign failed to send', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        campaignId,
        error: (err as Error)?.message,
      });
      return { ok: false };
    }
  }
}
