// backend/src/domains/messaging/services/AiFollowupScheduler.ts
//
// Sends AI inactivity follow-up / closing messages parked on conversations by
// the orchestrator's schedule_followup tool (migration 239). Runs every minute:
// pick due rows, deliver via MessageService, then advance 'followup' -> 'closing'
// (when a closing was drafted) or clear. A customer reply clears the columns
// first (MessageService.sendMessage), so a reply cancels anything queued.
//
// Rows that come due outside the shop's daytime window are deferred to the next
// morning rather than sent — see utils/shopQuietHours.
//
// Mirrors CampaignScheduler's shape (node-cron + isRunning lock + singleton).

import cron from 'node-cron';
import { logger } from '../../../utils/logger';
import { MessageRepository } from '../../../repositories/MessageRepository';
import { MessageService } from './MessageService';
import { getWebSocketManager } from '../../../services/WebSocketManager';
import { getShopTimezone, hoursUntilShopDaytime } from '../../../utils/shopQuietHours';

const MAX_PER_TICK = 100;

export class AiFollowupScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastRun: Date | null = null;
  private readonly messageRepo = new MessageRepository();
  private readonly messageService = new MessageService();

  start(): void {
    if (this.cronJob) {
      logger.warn('AI follow-up scheduler is already running');
      return;
    }
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.tick();
    });
    logger.info('AI follow-up scheduler started — every minute, sends due inactivity follow-ups');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('AI follow-up scheduler stopped');
    }
  }

  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  async tick(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AI follow-up scheduler tick already in progress, skipping');
      return;
    }
    this.isRunning = true;
    try {
      // The WS manager only exists once the HTTP server is up; wire it each tick
      // so in-app follow-ups broadcast in real-time.
      const ws = getWebSocketManager();
      if (ws) this.messageService.setWebSocketManager(ws);

      const due = await this.messageRepo.listDueAiFollowups(MAX_PER_TICK);
      let sent = 0;
      let deferred = 0;
      // One timezone lookup per shop per tick, not per conversation.
      const timezones = new Map<string, string>();
      for (const row of due) {
        try {
          const text = row.stage === 'followup' ? row.followupText : row.closingText;
          if (!text) {
            await this.messageRepo.clearAiFollowup(row.conversationId);
            continue;
          }

          // Quiet hours: hold until the shop's morning. Delays now run to days,
          // so a follow-up can easily come due at 3am — and unlike the sales
          // nudge, skipping would drop it for good rather than retry it.
          let tz = timezones.get(row.shopId);
          if (!tz) {
            tz = await getShopTimezone(row.shopId);
            timezones.set(row.shopId, tz);
          }
          const deferHours = hoursUntilShopDaytime(tz);
          if (deferHours > 0) {
            await this.messageRepo.deferAiFollowup(row.conversationId, deferHours);
            deferred++;
            continue;
          }
          await this.messageService.deliverScheduledAiMessage(row, text);
          sent++;
          if (row.stage === 'followup' && row.closingText) {
            await this.messageRepo.advanceAiFollowupToClosing(row.conversationId);
          } else {
            await this.messageRepo.clearAiFollowup(row.conversationId);
          }
        } catch (err) {
          logger.error('AI follow-up send failed', {
            conversationId: row.conversationId,
            error: (err as Error)?.message,
          });
          // Clear so a poison row can't re-fire every minute.
          await this.messageRepo.clearAiFollowup(row.conversationId).catch(() => undefined);
        }
      }
      if (sent > 0 || deferred > 0) {
        logger.info(
          `AI follow-up scheduler sent ${sent} message(s), deferred ${deferred} to shop daytime`
        );
      }
      this.lastRun = new Date();
    } catch (err) {
      logger.error('AI follow-up scheduler tick failed', { error: (err as Error)?.message });
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isSchedulerRunning(),
      isTickInProgress: this.isRunning,
      lastRun: this.lastRun,
      schedule: 'every minute',
    };
  }
}

let instance: AiFollowupScheduler | null = null;
export function getAiFollowupScheduler(): AiFollowupScheduler {
  if (!instance) instance = new AiFollowupScheduler();
  return instance;
}
