// backend/src/services/AutoMessageSchedulerService.ts
import { logger } from '../utils/logger';
import { AutoMessageRepository, AutoMessage } from '../repositories/AutoMessageRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ShopRepository } from '../repositories/ShopRepository';
import { getSharedPool } from '../utils/database-pool';
import { v4 as uuidv4 } from 'uuid';

// Max auto-messages per shop per scheduler run (prevent spam)
const MAX_SENDS_PER_SHOP_PER_RUN = 50;

/**
 * Resolves {{variable}} placeholders in message templates
 */
function resolveTemplate(template: string, context: {
  customerName?: string;
  rcnBalance?: number;
  shopName?: string;
  lastServiceName?: string;
  lastVisitDate?: string;
}): string {
  return template
    .replace(/\{\{customerName\}\}/g, context.customerName || 'Valued Customer')
    .replace(/\{\{rcnBalance\}\}/g, String(context.rcnBalance || 0))
    .replace(/\{\{shopName\}\}/g, context.shopName || 'our shop')
    .replace(/\{\{lastServiceName\}\}/g, context.lastServiceName || 'your last service')
    .replace(/\{\{lastVisitDate\}\}/g, context.lastVisitDate || 'recently');
}

export class AutoMessageSchedulerService {
  private autoMessageRepo: AutoMessageRepository;
  private messageRepo: MessageRepository;
  private customerRepo: CustomerRepository;
  private shopRepo: ShopRepository;
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.autoMessageRepo = new AutoMessageRepository();
    this.messageRepo = new MessageRepository();
    this.customerRepo = new CustomerRepository();
    this.shopRepo = new ShopRepository();
  }

  /**
   * Check if a schedule-based rule should run right now
   */
  private shouldRunNow(rule: AutoMessage): boolean {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDayOfWeek = now.getUTCDay(); // 0=Sunday
    const currentDayOfMonth = now.getUTCDate();

    // Must match the configured hour
    if (rule.scheduleHour !== currentHour) return false;

    switch (rule.scheduleType) {
      case 'daily':
        return true;
      case 'weekly':
        return rule.scheduleDayOfWeek === currentDayOfWeek;
      case 'monthly':
        return rule.scheduleDayOfMonth === currentDayOfMonth;
      default:
        return false;
    }
  }

  /**
   * Get target customers for a rule based on audience type
   */
  private async getTargetCustomers(rule: AutoMessage): Promise<Array<{
    walletAddress: string;
    name?: string;
    rcnBalance?: number;
    lastServiceName?: string;
    lastVisitDate?: string;
  }>> {
    const pool = getSharedPool();

    switch (rule.targetAudience) {
      case 'all': {
        // All customers who have interacted with this shop
        const customers = await this.customerRepo.findByShopInteraction(rule.shopId);
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
        `, [rule.shopId]);
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
        `, [rule.shopId]);
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
        `, [rule.shopId]);
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
        `, [rule.shopId]);
        return result.rows.map((r: any) => ({
          walletAddress: r.wallet_address,
          name: r.name || undefined,
          lastServiceName: r.last_service_name || undefined,
          lastVisitDate: r.last_visit ? new Date(r.last_visit).toLocaleDateString() : undefined,
        }));
      }

      default:
        return [];
    }
  }

  /**
   * Send auto-message to a single customer
   */
  /**
   * A/B variant pick (Phase 4). If the rule has a variant B, 50/50 between A (messageTemplate) and B;
   * returns the chosen message + label so the send can be attributed. No variant B → variant null.
   */
  private pickVariant(rule: AutoMessage): { message: string; variant: string | null } {
    if (rule.variantB && rule.variantB.trim()) {
      const isA = Math.random() < 0.5;
      return { message: isA ? rule.messageTemplate : rule.variantB, variant: isA ? 'A' : 'B' };
    }
    return { message: rule.messageTemplate, variant: null };
  }

  private async sendToCustomer(
    rule: AutoMessage,
    customer: { walletAddress: string; name?: string; rcnBalance?: number; lastServiceName?: string; lastVisitDate?: string },
    shopName: string
  ): Promise<{ success: boolean; messageId?: string; conversationId?: string }> {
    try {
      // Check max sends per customer
      const sendCount = await this.autoMessageRepo.countSendsForCustomer(rule.id, customer.walletAddress);
      if (rule.maxSendsPerCustomer && sendCount >= rule.maxSendsPerCustomer) {
        logger.debug('Max sends reached for customer', { ruleId: rule.id, customer: customer.walletAddress, sendCount });
        return { success: false };
      }

      // Check if already sent today (daily dedup for schedule rules)
      if (rule.triggerType === 'schedule') {
        const sentToday = await this.autoMessageRepo.hasSentToday(rule.id, customer.walletAddress);
        if (sentToday) {
          return { success: false };
        }
      }

      // Get or create conversation
      const conversation = await this.messageRepo.getOrCreateConversation(customer.walletAddress, rule.shopId);

      // Skip blocked conversations
      if (conversation.isBlocked) {
        logger.debug('Skipping blocked conversation', { ruleId: rule.id, customer: customer.walletAddress });
        return { success: false };
      }

      // A/B: pick a variant (if any) so the send can be attributed.
      const { message: variantMessage, variant } = this.pickVariant(rule);

      // Resolve template variables
      const messageText = resolveTemplate(variantMessage, {
        customerName: customer.name,
        rcnBalance: customer.rcnBalance,
        shopName,
        lastServiceName: customer.lastServiceName,
        lastVisitDate: customer.lastVisitDate,
      });

      // Create the message
      const messageId = `msg_${uuidv4()}`;
      const { message } = await this.messageRepo.createMessage({
        messageId,
        conversationId: conversation.conversationId,
        senderAddress: rule.shopId,
        senderType: 'shop',
        messageText,
        messageType: 'text',
        metadata: {
          autoMessageId: rule.id,
          autoMessageName: rule.name,
          isAutoMessage: true,
        },
      });

      // Update unread count
      await this.messageRepo.incrementUnreadCount(
        conversation.conversationId,
        'customer',
        messageText
      );

      // Record the send
      await this.autoMessageRepo.recordSend({
        autoMessageId: rule.id,
        shopId: rule.shopId,
        customerAddress: customer.walletAddress,
        conversationId: conversation.conversationId,
        messageId: message.messageId,
        status: 'sent',
        variant,
      });

      return { success: true, messageId: message.messageId, conversationId: conversation.conversationId };
    } catch (error) {
      logger.error('Error sending auto-message to customer', {
        ruleId: rule.id,
        customer: customer.walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Record failed send
      try {
        await this.autoMessageRepo.recordSend({
          autoMessageId: rule.id,
          shopId: rule.shopId,
          customerAddress: customer.walletAddress,
          status: 'failed',
        });
      } catch (_) {
        // Silent fail on recording
      }

      return { success: false };
    }
  }

  /**
   * Handle an event-based trigger (e.g., booking completed/cancelled).
   * Creates pending sends in the DB with a scheduled_send_at based on delay_hours.
   * The hourly scheduler picks them up when due.
   */
  async handleEventTrigger(eventType: string, data: {
    shopId: string;
    customerAddress: string;
    orderId?: string;
    serviceId?: string;
  }): Promise<{ scheduledCount: number }> {
    let scheduledCount = 0;

    try {
      // Find active event-based rules for this shop + event type
      const rules = await this.autoMessageRepo.getActiveEventRules(data.shopId, eventType);
      if (rules.length === 0) return { scheduledCount: 0 };

      logger.info(`Found ${rules.length} event rules for ${eventType}`, { shopId: data.shopId });

      for (const rule of rules) {
        try {
          // Check max sends per customer
          const sendCount = await this.autoMessageRepo.countSendsForCustomer(rule.id, data.customerAddress);
          if (rule.maxSendsPerCustomer && sendCount >= rule.maxSendsPerCustomer) {
            logger.debug('Max sends reached for event rule', { ruleId: rule.id, customer: data.customerAddress });
            continue;
          }

          // Check for duplicate trigger reference (same order shouldn't trigger twice)
          if (data.orderId) {
            const existingSend = await this.autoMessageRepo.hasSendForTriggerReference(
              rule.id, data.customerAddress, data.orderId
            );
            if (existingSend) {
              logger.debug('Duplicate trigger reference, skipping', { ruleId: rule.id, orderId: data.orderId });
              continue;
            }
          }

          // Drip sequence (Phase 3): enrol the customer by enqueuing step 0 as a pending send. Firing a
          // step enqueues the next (see the pending-send processor), so the whole sequence runs off the
          // existing queue. A rule with no steps falls through to the single-message behavior below.
          if (rule.steps && rule.steps.length > 0) {
            const step0 = rule.steps[0];
            const seqAt = new Date();
            seqAt.setHours(seqAt.getHours() + (step0.delayHours || 0));
            await this.autoMessageRepo.recordSend({
              autoMessageId: rule.id,
              shopId: data.shopId,
              customerAddress: data.customerAddress,
              triggerReference: data.orderId || undefined,
              status: 'pending',
              scheduledSendAt: seqAt,
              stepIndex: 0,
            });
            scheduledCount++;
            logger.info(`Enrolled ${data.customerAddress} in sequence "${rule.name}" (step 1 at ${seqAt.toISOString()})`, { ruleId: rule.id });
            continue;
          }

          // Calculate when to send
          const scheduledSendAt = new Date();
          scheduledSendAt.setHours(scheduledSendAt.getHours() + (rule.delayHours || 0));

          if (rule.delayHours === 0) {
            // Send immediately — no delay
            const shop = await this.shopRepo.getShop(data.shopId);
            const shopName = shop?.name || 'Our Shop';
            const customer = await this.customerRepo.getCustomer(data.customerAddress);

            const sendResult = await this.sendToCustomer(rule, {
              walletAddress: data.customerAddress,
              name: customer?.name || undefined,
            }, shopName);

            if (sendResult.success) {
              // Update the send record with trigger reference
              scheduledCount++;
            }
          } else {
            // Schedule for later — store as pending
            await this.autoMessageRepo.recordSend({
              autoMessageId: rule.id,
              shopId: data.shopId,
              customerAddress: data.customerAddress,
              triggerReference: data.orderId || undefined,
              status: 'pending',
              scheduledSendAt,
            });
            scheduledCount++;
            logger.info(`Scheduled event auto-message "${rule.name}" for ${data.customerAddress} at ${scheduledSendAt.toISOString()}`, {
              ruleId: rule.id,
              delayHours: rule.delayHours,
            });
          }
        } catch (error) {
          logger.error(`Error processing event rule "${rule.name}"`, {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('Error in handleEventTrigger:', error);
    }

    return { scheduledCount };
  }

  /**
   * Process inactive_30_days rules.
   * Finds customers whose last completed order at a shop was 30+ days ago
   * and sends auto-messages. Deduped with a 30-day send window.
   */
  async processInactiveCustomers(): Promise<{ rulesFired: number; messagesSent: number }> {
    let rulesFired = 0;
    let messagesSent = 0;

    try {
      const rules = await this.autoMessageRepo.getAllActiveEventRulesByType('inactive_30_days');
      if (rules.length === 0) return { rulesFired: 0, messagesSent: 0 };

      logger.info(`Processing ${rules.length} inactive_30_days rules`);

      for (const rule of rules) {
        rulesFired++;
        try {
          // Verify shop is active
          const shop = await this.shopRepo.getShop(rule.shopId);
          if (!shop || !shop.active) continue;

          const pool = getSharedPool();

          // Find customers whose last completed order at this shop was 30+ days ago
          const result = await pool.query(`
            SELECT DISTINCT LOWER(so.customer_address) as customer_address,
              c.name,
              MAX(so.updated_at) as last_order_date
            FROM service_orders so
            INNER JOIN customers c ON LOWER(c.address) = LOWER(so.customer_address)
            WHERE so.shop_id = $1
              AND so.status = 'completed'
              AND c.is_active = true
            GROUP BY LOWER(so.customer_address), c.name
            HAVING MAX(so.updated_at) < NOW() - INTERVAL '30 days'
          `, [rule.shopId]);

          if (result.rows.length === 0) continue;

          logger.info(`Rule "${rule.name}" found ${result.rows.length} inactive customers`, { ruleId: rule.id, shopId: rule.shopId });

          for (const row of result.rows) {
            // Check max sends per customer
            const sendCount = await this.autoMessageRepo.countSendsForCustomer(rule.id, row.customer_address);
            if (rule.maxSendsPerCustomer && sendCount >= rule.maxSendsPerCustomer) continue;

            // Dedup: don't send again within 30 days
            const recentlySent = await this.autoMessageRepo.hasSentWithinDays(rule.id, row.customer_address, 30);
            if (recentlySent) continue;

            const sendResult = await this.sendToCustomer(rule, {
              walletAddress: row.customer_address,
              name: row.name || undefined,
              lastVisitDate: row.last_order_date ? new Date(row.last_order_date).toLocaleDateString() : undefined,
            }, shop.name || 'Our Shop');

            if (sendResult.success) messagesSent++;
          }
        } catch (error) {
          logger.error(`Error processing inactive_30_days rule "${rule.name}"`, {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('Error in processInactiveCustomers:', error);
    }

    if (rulesFired > 0) {
      logger.info('Inactive customers processing completed', { rulesFired, messagesSent });
    }

    return { rulesFired, messagesSent };
  }

  /**
   * Drip stop-on-booking exit check (Phase 3): has the customer completed a booking at this shop SINCE
   * enrolling in the sequence? Enrollment time ≈ the earliest (step-0) pending send for this rule+customer.
   */
  private async bookedSinceEnrollment(ruleId: string, customerAddress: string, shopId: string): Promise<boolean> {
    try {
      const pool = getSharedPool();
      const enroll = await pool.query(
        `SELECT MIN(scheduled_send_at) AS enrolled_at
           FROM auto_message_sends
          WHERE auto_message_id = $1 AND LOWER(customer_address) = LOWER($2) AND step_index = 0`,
        [ruleId, customerAddress]
      );
      const enrolledAt = enroll.rows[0]?.enrolled_at;
      if (!enrolledAt) return false;
      const booked = await pool.query(
        `SELECT 1 FROM service_orders
          WHERE shop_id = $1 AND LOWER(customer_address) = LOWER($2)
            AND status = 'completed' AND updated_at >= $3
          LIMIT 1`,
        [shopId, customerAddress, enrolledAt]
      );
      return booked.rows.length > 0;
    } catch (error) {
      logger.error('bookedSinceEnrollment check failed', { ruleId, error: (error as Error)?.message });
      return false; // fail open — don't block the sequence on a check error
    }
  }

  /**
   * Process low_bookings rules — the "slow week" autonomous trigger (AI Campaigns Advanced, Phase 2).
   * For each active rule: if the shop's bookings over the last 7 days dropped notably below its OWN
   * trailing 4-week weekly average, fire the rule's message to its target audience (a win-back / promo
   * nudge). Shop-relative so it adapts per shop; the trailing baseline (>= 4 prior bookings) avoids
   * firing for brand-new/empty shops. Per-customer 7-day dedup + maxSendsPerCustomer prevent re-blasting.
   * Threshold is a v1 heuristic (this week < 50% of the weekly average) — a configurable cap can come later.
   */
  async processLowBookings(): Promise<{ rulesFired: number; messagesSent: number }> {
    let rulesFired = 0;
    let messagesSent = 0;

    try {
      const rules = await this.autoMessageRepo.getAllActiveEventRulesByType('low_bookings');
      if (rules.length === 0) return { rulesFired: 0, messagesSent: 0 };

      logger.info(`Processing ${rules.length} low_bookings rules`);
      const pool = getSharedPool();

      for (const rule of rules) {
        try {
          const shop = await this.shopRepo.getShop(rule.shopId);
          if (!shop || !shop.active) continue;

          // last-7-days bookings vs the trailing 4 weeks (the 28-day window just before the last 7 days)
          const stats = await pool.query(`
            SELECT
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last7,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '35 days'
                               AND created_at <  NOW() - INTERVAL '7 days')   AS prior28
            FROM service_orders
            WHERE shop_id = $1 AND status <> 'cancelled'
          `, [rule.shopId]);
          const last7 = Number(stats.rows[0]?.last7) || 0;
          const prior28 = Number(stats.rows[0]?.prior28) || 0;
          const weeklyAvg = prior28 / 4;
          const isSlow = prior28 >= 4 && weeklyAvg > 0 && last7 < weeklyAvg * 0.5;
          if (!isSlow) continue;

          rulesFired++;
          logger.info(`Rule "${rule.name}" fired — slow week (${last7} vs ~${weeklyAvg.toFixed(1)}/wk avg)`, {
            ruleId: rule.id, shopId: rule.shopId,
          });

          const customers = await this.getTargetCustomers(rule);
          for (const cust of customers) {
            const sendCount = await this.autoMessageRepo.countSendsForCustomer(rule.id, cust.walletAddress);
            if (rule.maxSendsPerCustomer && sendCount >= rule.maxSendsPerCustomer) continue;
            // Don't re-blast the same customer within 7 days (also caps repeat slow-week firings).
            if (await this.autoMessageRepo.hasSentWithinDays(rule.id, cust.walletAddress, 7)) continue;

            const sendResult = await this.sendToCustomer(rule, cust, shop.name || 'Our Shop');
            if (sendResult.success) messagesSent++;
          }
        } catch (error) {
          logger.error(`Error processing low_bookings rule "${rule.name}"`, {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('Error in processLowBookings:', error);
    }

    if (rulesFired > 0) {
      logger.info('Low bookings processing completed', { rulesFired, messagesSent });
    }

    return { rulesFired, messagesSent };
  }

  /**
   * Process all active schedule-based auto-message rules
   */
  async processScheduledMessages(): Promise<{
    rulesChecked: number;
    rulesFired: number;
    messagesSent: number;
    messagesFailed: number;
    errors: string[];
  }> {
    if (this.isRunning) {
      logger.warn('Auto-message scheduler already running');
      return { rulesChecked: 0, rulesFired: 0, messagesSent: 0, messagesFailed: 0, errors: ['Already running'] };
    }

    this.isRunning = true;
    const result = {
      rulesChecked: 0,
      rulesFired: 0,
      messagesSent: 0,
      messagesFailed: 0,
      errors: [] as string[],
    };

    try {
      // Get all active schedule-based rules
      const rules = await this.autoMessageRepo.getActiveScheduleRules();
      result.rulesChecked = rules.length;

      if (rules.length === 0) {
        logger.debug('No active schedule rules to process');
        return result;
      }

      logger.info(`Processing ${rules.length} active auto-message rules`);

      // Group rules by shop for rate limiting
      const rulesByShop = new Map<string, AutoMessage[]>();
      for (const rule of rules) {
        if (!this.shouldRunNow(rule)) continue;

        const shopRules = rulesByShop.get(rule.shopId) || [];
        shopRules.push(rule);
        rulesByShop.set(rule.shopId, shopRules);
      }

      // Process each shop's rules
      for (const [shopId, shopRules] of rulesByShop) {
        let shopSendCount = 0;

        // Verify shop has active subscription
        try {
          const shop = await this.shopRepo.getShop(shopId);
          if (!shop || !shop.active) {
            logger.debug('Skipping inactive shop', { shopId });
            continue;
          }
        } catch (_) {
          logger.debug('Could not verify shop, skipping', { shopId });
          continue;
        }

        const shop = await this.shopRepo.getShop(shopId);
        const shopName = shop?.name || 'Our Shop';

        for (const rule of shopRules) {
          result.rulesFired++;

          try {
            const customers = await this.getTargetCustomers(rule);
            logger.info(`Rule "${rule.name}" targeting ${customers.length} customers`, { ruleId: rule.id, shopId });

            for (const customer of customers) {
              if (shopSendCount >= MAX_SENDS_PER_SHOP_PER_RUN) {
                logger.warn('Max sends per shop per run reached', { shopId, limit: MAX_SENDS_PER_SHOP_PER_RUN });
                break;
              }

              const sendResult = await this.sendToCustomer(rule, customer, shopName);
              if (sendResult.success) {
                result.messagesSent++;
                shopSendCount++;
              } else {
                result.messagesFailed++;
              }
            }
          } catch (error) {
            const errorMsg = `Error processing rule "${rule.name}" (${rule.id}): ${error instanceof Error ? error.message : 'Unknown error'}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }
      }

      // Process pending delayed sends (from event-based triggers)
      try {
        const pendingSends = await this.autoMessageRepo.getPendingSends();
        if (pendingSends.length > 0) {
          logger.info(`Processing ${pendingSends.length} pending delayed sends`);

          for (const send of pendingSends) {
            try {
              // Get the rule to access template
              const rule = await this.autoMessageRepo.getById(send.autoMessageId);
              if (!rule || !rule.isActive) {
                await this.autoMessageRepo.updateSendStatus(send.id, 'failed');
                continue;
              }

              const shop = await this.shopRepo.getShop(send.shopId);
              const shopName = shop?.name || 'Our Shop';

              // Get customer info
              const customer = await this.customerRepo.getCustomer(send.customerAddress);

              // Drip sequence step (Phase 3): resolve which step's message to send, honor stop-on-booking,
              // and enqueue the next step after this one fires. A null step_index = legacy single message.
              const isSequenceStep = send.stepIndex !== null && !!rule.steps && rule.steps.length > 0;
              const step = isSequenceStep ? rule.steps![send.stepIndex as number] : null;
              if (isSequenceStep && !step) {
                // The step was removed from the rule since enrollment — end the sequence cleanly.
                await this.autoMessageRepo.updateSendStatus(send.id, 'failed');
                continue;
              }

              // Exit condition: if the sequence is set to stop once the customer books, and they've
              // completed a booking since enrolling, end the sequence without sending this step.
              if (isSequenceStep && rule.stopOnBooking) {
                if (await this.bookedSinceEnrollment(send.autoMessageId, send.customerAddress, send.shopId)) {
                  await this.autoMessageRepo.updateSendStatus(send.id, 'sent'); // processed, no message, no next
                  logger.info(`Sequence "${rule.name}" exited for ${send.customerAddress} — customer booked`, { ruleId: rule.id });
                  continue;
                }
              }

              const conversation = await this.messageRepo.getOrCreateConversation(send.customerAddress, send.shopId);
              if (conversation.isBlocked) {
                await this.autoMessageRepo.updateSendStatus(send.id, 'failed');
                continue;
              }

              // A/B on delayed single-message sends: pick a variant at send time (sequence steps skip A/B).
              const abPick = isSequenceStep ? null : this.pickVariant(rule);
              const messageText = resolveTemplate(
                step ? step.messageTemplate : (abPick ? abPick.message : rule.messageTemplate),
                { customerName: customer?.name || undefined, shopName }
              );

              const messageId = `msg_${uuidv4()}`;
              const { message } = await this.messageRepo.createMessage({
                messageId,
                conversationId: conversation.conversationId,
                senderAddress: rule.shopId,
                senderType: 'shop',
                messageText,
                messageType: 'text',
                metadata: {
                  autoMessageId: rule.id,
                  autoMessageName: rule.name,
                  isAutoMessage: true,
                },
              });

              await this.messageRepo.incrementUnreadCount(conversation.conversationId, 'customer', messageText);
              await this.autoMessageRepo.updateSendStatus(send.id, 'sent', message.messageId, conversation.conversationId, abPick?.variant ?? null);
              result.messagesSent++;

              // Sequence: enqueue the next step (if any) after this one fired.
              if (isSequenceStep) {
                const nextIndex = (send.stepIndex as number) + 1;
                const nextStep = rule.steps![nextIndex];
                if (nextStep) {
                  const nextAt = new Date();
                  nextAt.setHours(nextAt.getHours() + (nextStep.delayHours || 0));
                  await this.autoMessageRepo.recordSend({
                    autoMessageId: rule.id,
                    shopId: send.shopId,
                    customerAddress: send.customerAddress,
                    status: 'pending',
                    scheduledSendAt: nextAt,
                    stepIndex: nextIndex,
                  });
                }
              }
            } catch (error) {
              logger.error('Error processing pending send', { sendId: send.id, error });
              await this.autoMessageRepo.updateSendStatus(send.id, 'failed');
              result.messagesFailed++;
            }
          }
        }
      } catch (error) {
        logger.error('Error processing pending sends:', error);
      }

      // Process inactive_30_days rules
      try {
        const inactiveResult = await this.processInactiveCustomers();
        result.rulesFired += inactiveResult.rulesFired;
        result.messagesSent += inactiveResult.messagesSent;
      } catch (error) {
        logger.error('Error processing inactive customers:', error);
      }

      // Process low_bookings ("slow week") rules
      try {
        const lowResult = await this.processLowBookings();
        result.rulesFired += lowResult.rulesFired;
        result.messagesSent += lowResult.messagesSent;
      } catch (error) {
        logger.error('Error processing low bookings:', error);
      }

      if (result.messagesSent > 0 || result.rulesFired > 0) {
        logger.info('Auto-message scheduler completed', result);
      }

      return result;
    } catch (error) {
      logger.error('Auto-message scheduler failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Schedule automatic processing
   * Runs every hour to check for rules that should fire
   */
  start(intervalHours: number = 1): void {
    if (this.scheduledIntervalId) {
      logger.warn('Auto-message scheduler already started');
      return;
    }

    // Run on startup
    this.processScheduledMessages().catch(error => {
      logger.error('Initial auto-message processing failed:', error);
    });

    // Schedule periodic checks
    this.scheduledIntervalId = setInterval(async () => {
      try {
        await this.processScheduledMessages();
      } catch (error) {
        logger.error('Scheduled auto-message processing failed:', error);
      }
    }, intervalHours * 60 * 60 * 1000);

    logger.info('Auto-message scheduler started', { intervalHours });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
      logger.info('Auto-message scheduler stopped');
    }
  }
}

// Export singleton instance
export const autoMessageSchedulerService = new AutoMessageSchedulerService();
