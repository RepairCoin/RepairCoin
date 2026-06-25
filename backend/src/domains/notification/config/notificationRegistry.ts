import { NotificationChannels } from '../../../services/ExpoPushService';

/**
 * notificationRegistry — the single source of truth for how each notification
 * TYPE is delivered and displayed.
 *
 * Why this exists: notification delivery used to be hand-wired at every
 * emission site (persist + WebSocket + push), so each site could silently drop
 * a channel — that was the root cause of the "mobile didn't get it" /
 * "no native banner" / generic-icon bugs. With this table, "which channels fire
 * and how it renders" is a DATA decision per type, not something each caller
 * re-codes from memory.
 *
 * To add a NEW notification type:
 *   1. Add one entry here.
 *   2. Call `notificationGateway.dispatch('<type>', receiver, { message, metadata })`
 *      from wherever the event happens.
 * That's it — all configured channels fire and both clients render correctly.
 * Do NOT hand-wire createNotification + wsManager + pushDispatcher anymore.
 */

export type DeliveryChannel = 'persist' | 'ws' | 'push';

/**
 * Display chrome sent to the clients via `metadata.display`. The web and mobile
 * notification components read these instead of maintaining per-type switch
 * statements (which drifted and caused the generic 📬 icon). `icon` is a
 * semantic token the clients map to their own renderer (emoji on web, vector
 * icon on mobile), so reusing an existing token needs ZERO client edits.
 */
export interface NotificationDisplay {
  title: string;
  /** Semantic icon token, e.g. 'cancelled' | 'reward' | 'calendar'. Mapped client-side. */
  icon: string;
  /** Hex accent color (mobile icon/background tint). Optional. */
  color?: string;
}

export interface NotificationPushConfig {
  channelId: string;
  priority?: 'default' | 'normal' | 'high';
  /** Push title; defaults to display.title when omitted. */
  title?: (metadata: Record<string, any>) => string;
  /** Push body; defaults to the in-app `message` when omitted. */
  body?: (metadata: Record<string, any>) => string;
}

export interface NotificationTypeConfig {
  /** Which delivery legs fire for this type. */
  channels: DeliveryChannel[];
  /**
   * Transactional notifications (e.g. a cancellation + refund) always reach the
   * user regardless of their preference toggles. Preference GATING itself stays
   * owned by NOTIFICATION_PREFERENCE_MAP in NotificationService — this flag just
   * bypasses it. Keeps a single source of truth for preferences.
   */
  transactional?: boolean;
  display: NotificationDisplay;
  /** Push payload builder. Required when `channels` includes 'push'. */
  push?: NotificationPushConfig;
}

/**
 * Registry entries. Only types routed through the gateway need to live here.
 * Legacy types still emitted by NotificationDomain handlers are intentionally
 * absent — they keep using their own (frozen) path. See dispatch() for the
 * fallback applied to unregistered types.
 */
export const NOTIFICATION_REGISTRY: Record<string, NotificationTypeConfig> = {
  // ── Shop-cancelled booking (migrated from PaymentService) ─────────────────
  service_order_cancelled: {
    channels: ['persist', 'ws', 'push'],
    transactional: true, // cancel + refund must always reach the customer
    display: { title: 'Order Cancelled', icon: 'cancelled', color: '#EF4444' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      title: () => 'Booking Cancelled',
      body: (m) =>
        `${m.shopName} cancelled your ${m.serviceName} booking.` +
        (m.refundSummary ? ` Refund: ${m.refundSummary}` : ''),
    },
  },

  // ── Appointment reminders (migrated from AppointmentReminderService) ──────
  booking_confirmed: {
    channels: ['persist', 'ws', 'push'],
    display: { title: 'Booking Confirmed', icon: 'calendar', color: '#3B82F6' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      body: (m) =>
        `Your ${m.serviceName} at ${m.shopName} is confirmed for ${m.bookingDate} at ${m.bookingTime}`,
    },
  },
  appointment_reminder: {
    channels: ['persist', 'ws', 'push'],
    display: { title: 'Appointment Reminder', icon: 'alarm', color: '#8B5CF6' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      title: () => 'Appointment Tomorrow',
      body: (m) => `Reminder: ${m.serviceName} at ${m.shopName} at ${m.bookingTime}`,
    },
  },
  // NOTE: the _2h and upcoming_* reminders are persist+ws only — they have
  // never sent a native push. Channels here deliberately MATCH that existing
  // behavior so this migration changes nothing. Adding push to them is a
  // separate, intentional decision (just add 'push' + a push block).
  appointment_reminder_2h: {
    channels: ['persist', 'ws'],
    display: { title: 'Appointment Reminder', icon: 'alarm', color: '#8B5CF6' },
  },
  upcoming_appointment: {
    channels: ['persist', 'ws'],
    display: { title: 'Upcoming Appointment', icon: 'alarm', color: '#8B5CF6' },
  },
  upcoming_appointment_2h: {
    channels: ['persist', 'ws'],
    display: { title: 'Upcoming Appointment', icon: 'alarm', color: '#8B5CF6' },
  },
  // Quiet-hours skip is an in-app audit note — persist + ws, no push (matches
  // the current createAndBroadcastNotification behavior).
  reminder_skipped_quiet_hours: {
    channels: ['persist', 'ws'],
    display: { title: 'Reminder Skipped', icon: 'alarm', color: '#9CA3AF' },
  },

  // ── Marketing campaigns (migrated from MarketingService) ──────────────────
  marketing_campaign: {
    channels: ['persist', 'ws'],
    display: { title: 'Campaign', icon: 'campaign', color: '#EC4899' },
  },
};
