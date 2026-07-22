import { NotificationService } from './NotificationService';
import { Notification } from '../../../repositories/NotificationRepository';
import { getWebSocketManager } from '../../../services/WebSocketManager';
import { getPushNotificationDispatcher, PushNotificationDispatcher } from '../../../services/PushNotificationDispatcher';
import {
  NOTIFICATION_REGISTRY,
  NotificationTypeConfig,
  DeliveryChannel,
} from '../config/notificationRegistry';
import { logger } from '../../../utils/logger';
import { twilioService } from '../../../services/TwilioService';
import { smsOptOutRepository } from '../../../repositories/SmsOptOutRepository';
import { normalizePhone } from '../../../utils/phone';
import { customerRepository, shopRepository } from '../../../repositories';

export interface DispatchParams {
  /** In-app message body. Defaults to '' (push body can still be built from metadata). */
  message: string;
  metadata?: Record<string, any>;
  /** Defaults to 'SYSTEM'. */
  senderAddress?: string;
}

/**
 * NotificationGateway — the single entry point for emitting a notification.
 *
 * One call fans out to every channel configured for the type in
 * notificationRegistry (persist → WebSocket → push), so a channel can never be
 * silently dropped by a caller forgetting to wire it. This replaces the
 * hand-rolled "createNotification + wsManager.sendNotificationToUser +
 * pushDispatcher.sendX" dance at each emission site.
 *
 * Preference gating stays owned by NotificationService (NOTIFICATION_PREFERENCE_MAP)
 * — the gateway only passes `bypassPreferences` for registry-marked
 * transactional types. If persistence is suppressed by a user preference, the
 * WS and push legs are skipped too (consistent: a muted type stays fully muted).
 */
export class NotificationGateway {
  private notificationService: NotificationService;
  private pushDispatcher: PushNotificationDispatcher;

  constructor(notificationService?: NotificationService, pushDispatcher?: PushNotificationDispatcher) {
    this.notificationService = notificationService || new NotificationService();
    this.pushDispatcher = pushDispatcher || getPushNotificationDispatcher();
  }

  private getConfig(type: string): NotificationTypeConfig {
    const config = NOTIFICATION_REGISTRY[type];
    if (config) return config;
    // Unregistered type: don't silently drop everything. Deliver on all
    // channels with no display chrome and log so the gap is visible. Callers
    // should add a registry entry.
    logger.warn(`NotificationGateway: no registry entry for type '${type}', using all-channel fallback`);
    return {
      channels: ['persist', 'ws', 'push'] as DeliveryChannel[],
      display: { title: 'Notification', icon: 'default' },
      push: { channelId: 'default', body: () => '' },
    };
  }

  /**
   * Emit a notification of `type` to `receiverAddress`. Returns the persisted
   * Notification, or null if it was suppressed by preference or not persisted.
   */
  async dispatch(type: string, receiverAddress: string, params: DispatchParams): Promise<Notification | null> {
    const config = this.getConfig(type);
    const metadata = params.metadata || {};
    const senderAddress = params.senderAddress || 'SYSTEM';

    // Resolve the display title (may be a metadata-dependent builder) once, so
    // both the persisted metadata.display and the push fallback title agree.
    const resolvedDisplay = {
      ...config.display,
      title:
        typeof config.display.title === 'function'
          ? config.display.title(metadata)
          : config.display.title,
    };

    let notification: Notification | null = null;
    let suppressed = false;

    // 1. Persist (+ preference gating). Display chrome is folded into metadata
    //    so the clients render title/icon without a per-type switch.
    if (config.channels.includes('persist')) {
      const created = await this.notificationService.createNotification(
        {
          senderAddress,
          receiverAddress,
          notificationType: type,
          message: params.message,
          metadata: { ...metadata, display: resolvedDisplay },
        },
        { bypassPreferences: config.transactional }
      );
      suppressed = created.id === 'suppressed';
      notification = suppressed ? null : created;
    }

    // A type muted by preference stays fully muted — skip the live channels too.
    if (suppressed) {
      return null;
    }

    // 2. In-app realtime broadcast.
    if (config.channels.includes('ws') && notification) {
      try {
        getWebSocketManager()?.sendNotificationToUser(receiverAddress, notification);
      } catch (err) {
        logger.error(`NotificationGateway: WS broadcast failed for '${type}':`, err);
      }
    }

    // 3. Native push (web + mobile). Never let a push failure break the caller.
    if (config.channels.includes('push') && config.push) {
      try {
        await this.pushDispatcher.sendToUser(receiverAddress, {
          title: config.push.title ? config.push.title(metadata) : resolvedDisplay.title,
          body: config.push.body ? config.push.body(metadata) : params.message,
          channelId: config.push.channelId,
          priority: config.push.priority,
          imageUrl: config.push.imageUrl ? config.push.imageUrl(metadata) : undefined,
          data: { type, ...metadata },
        });
      } catch (err) {
        logger.error(`NotificationGateway: push failed for '${type}':`, err);
      }
    }

    // 4. SMS (Twilio). Only when the type opts in, Twilio is configured, the
    //    recipient has a phone, they haven't opted out, and the number is valid
    //    E.164. A no-op/failure here never breaks the caller or other channels.
    if (config.channels.includes('sms') && config.sms && twilioService.enabled()) {
      try {
        const normalized = normalizePhone(await this.resolvePhone(receiverAddress));
        if (normalized && !(await smsOptOutRepository.isOptedOut(normalized))) {
          await twilioService.sendSms(normalized, config.sms.body(metadata));
        }
      } catch (err) {
        logger.error(`NotificationGateway: SMS failed for '${type}':`, err);
      }
    }

    return notification;
  }

  /**
   * Resolve a recipient's phone from their address. Notifications go to either a
   * customer (wallet address) or a shop (shopId); try customer first, then shop.
   */
  private async resolvePhone(address: string): Promise<string | null> {
    try {
      const customer = await customerRepository.getCustomer(address);
      if (customer?.phone) return customer.phone;
    } catch {
      // fall through to shop lookup
    }
    try {
      const shop = await shopRepository.getShop(address);
      if (shop?.phone) return shop.phone;
    } catch {
      // no resolvable phone
    }
    return null;
  }
}

// Singleton accessor (mirrors getPushNotificationDispatcher / getWebSocketManager).
let gatewayInstance: NotificationGateway | null = null;

export function getNotificationGateway(): NotificationGateway {
  if (!gatewayInstance) {
    gatewayInstance = new NotificationGateway();
  }
  return gatewayInstance;
}
