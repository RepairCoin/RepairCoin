// backend/src/services/autoMessageActions/notifyStaffAction.ts
//
// Custom Workflows — the `notify_staff` action. The first action that talks to the SHOP rather than the
// customer: "a no-show just happened", "this customer left 1 star", "stock is low".
//
// Why it matters beyond being another action: every trigger before it had to be customer-scoped,
// because messaging and rewards both need a recipient. notify_staff is what makes shop-scoped triggers
// (low_stock) mean anything at all.
//
// Delivery goes through the notification GATEWAY, never hand-wired. Per CLAUDE.md, wiring
// createNotification + wsManager + pushDispatcher by hand at each call site is exactly how channels get
// silently dropped; the registry entry (workflow_staff_alert) decides which channels fire.
//
// TARGETING (fixed 2026-07-30): the first version dispatched only to `shopId`, which looked right and
// mostly did not work. Following each channel:
//   - in-app  ✅ the notification query is [walletAddress, shopId], so the shop's bell shows it
//   - socket  ❌ sendNotificationToUser() looks up clients by address; nobody connects as "peanut"
//   - push    ❌ getActiveTokensByWallet("peanut") returns nothing; device tokens are per wallet
// So a registry entry declaring three channels delivered on one, and the whole shop shared a single
// notification row — read it once and it was read for everybody. For something called "notify my team"
// that is wrong twice over.
//
// It now ALSO fans out to each active team member's wallet address (Business-tier Team Management),
// filtered by the permission that matches the trigger. That makes all three channels resolve, gives
// each person their own read state, and means a staff member who cannot see inventory is not paged
// about stock.

import { logger } from '../../utils/logger';
import { getNotificationGateway } from '../../domains/notification/services/NotificationGateway';
import { shopTeamRepository } from '../../repositories';
import { hasPermission } from '../../domains/shop/permissions';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

export interface NotifyStaffPayload {
  /** What the alert says. Falls back to a line built from the rule name. */
  message?: string;
}

const MAX_MESSAGE = 500;

/**
 * Which permission a member needs to be worth alerting for a given trigger. An absent entry means
 * "everyone on the team" — better to over-notify than to silently exclude someone from an alert whose
 * audience we have not thought about.
 */
const NOTIFY_PERMISSION_BY_EVENT: Record<string, string> = {
  low_stock: 'inventory:view',
  // A lead is a marketing contact, so whoever handles customers should be the one paged to ring them.
  new_ad_lead: 'customers:view',
  no_show: 'bookings:view',
  booking_cancelled: 'bookings:view',
  booking_completed: 'bookings:view',
  payment_failed: 'payments:manage',
  review_received: 'customers:view',
  low_rating: 'customers:view',
};

export function parseNotifyStaffPayload(raw: unknown): NotifyStaffPayload {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const message = typeof p.message === 'string' ? p.message.trim().slice(0, MAX_MESSAGE) : '';
  return message ? { message } : {};
}

/**
 * Minimal shape this action needs from the team repository — injectable for tests.
 * `walletAddress` is nullable on purpose: a member who has been INVITED but hasn't accepted has an
 * email and no wallet, so there is nothing to address a notification to yet.
 */
export interface TeamLister {
  getMembersByShop(shopId: string): Promise<Array<{
    walletAddress: string | null;
    status: string;
    permissions?: string[];
    role?: string;
  }>>;
}

export class NotifyStaffAction implements AutoMessageActionHandler {
  readonly type = 'notify_staff';

  constructor(
    private readonly gateway: { dispatch: Function } = getNotificationGateway(),
    private readonly team: TeamLister = shopTeamRepository as unknown as TeamLister
  ) {}

  /**
   * Team members who should see this alert: active, with a wallet to address, and holding the
   * permission that matches the trigger. Fails OPEN — if the lookup breaks we still send the
   * shop-level alert rather than going silent.
   */
  private async recipients(ctx: AutoMessageActionContext): Promise<string[]> {
    try {
      const required = NOTIFY_PERMISSION_BY_EVENT[ctx.rule.eventType || ''];
      const members = await this.team.getMembersByShop(ctx.shopId);
      return members
        // 'invited' members have an email but no wallet yet — nothing to address.
        .filter((m): m is typeof m & { walletAddress: string } => m.status === 'active' && !!m.walletAddress)
        // An owner always gets the alert; anyone else needs the trigger's permission.
        .filter((m) => !required || m.role === 'owner' || hasPermission(m.permissions, required))
        .map((m) => m.walletAddress.toLowerCase());
    } catch (err) {
      logger.warn('notify_staff could not resolve team members; shop-level alert only', {
        shopId: ctx.shopId,
        error: (err as Error)?.message,
      });
      return [];
    }
  }

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const payload = parseNotifyStaffPayload(ctx.actionPayload ?? ctx.rule.actionPayload);

    // Lead with what actually happened, then the owner's own note. The detail is the part they don't
    // already know — "stock is low" is why they built the workflow; WHICH items is the alert.
    const detail = ctx.triggerDetail?.trim();
    const note = payload.message;
    const message =
      [detail, note].filter(Boolean).join(' ') ||
      `Your automation "${ctx.rule.name}" fired${ctx.customerName ? ` for ${ctx.customerName}` : ''}.`;

    const metadata = {
      workflowName: ctx.rule.name,
      workflowId: ctx.rule.id,
      customerAddress: ctx.customerAddress || null,
      customerName: ctx.customerName || null,
    };

    // Shop-level first: the shop's own bell is addressed by shopId, and a shop login is frequently a
    // social wallet that doesn't match shops.wallet_address — so this is the one delivery that always
    // resolves regardless of how the owner signed in.
    let delivered = 0;
    try {
      await this.gateway.dispatch('workflow_staff_alert', ctx.shopId, { message, metadata });
      delivered++;
    } catch (err) {
      logger.error('notify_staff failed to dispatch shop-level alert', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        error: (err as Error)?.message,
      });
    }

    // Then each teammate individually, so socket + push resolve and read state is per person.
    for (const address of await this.recipients(ctx)) {
      try {
        await this.gateway.dispatch('workflow_staff_alert', address, { message, metadata });
        delivered++;
      } catch (err) {
        // One teammate's failure must not stop the rest, or the tick.
        logger.error('notify_staff failed to dispatch to team member', {
          ruleId: ctx.rule.id,
          shopId: ctx.shopId,
          error: (err as Error)?.message,
        });
      }
    }

    if (delivered === 0) return { ok: false, skipped: 'empty' };

    logger.info('notify_staff action dispatched', {
      ruleId: ctx.rule.id,
      shopId: ctx.shopId,
      recipients: delivered,
    });
    // No customer message was produced, so there is no messageId to record against the send.
    return { ok: true };
  }
}
