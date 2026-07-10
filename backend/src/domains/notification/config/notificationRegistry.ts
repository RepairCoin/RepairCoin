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
  /** Static title, or a builder for titles that depend on metadata (e.g. campaign name). */
  title: string | ((metadata: Record<string, any>) => string);
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
  /**
   * Rich notification image (Android big-picture / web icon). Returns a URL
   * from metadata, or undefined. Push bodies that need pre-formatted date/time
   * should read `*Label` metadata fields (e.g. bookingTimeLabel) — metadata
   * keeps the raw values so the clients can format for in-app display.
   */
  imageUrl?: (metadata: Record<string, any>) => string | undefined;
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
  // ── Admin platform announcement / broadcast ──────────────────────────────
  // Not transactional: recipients can mute announcements via preferences.
  admin_announcement: {
    channels: ['persist', 'ws', 'push'],
    display: {
      title: (m) => m.title || 'Announcement',
      icon: 'campaign',
      color: '#FFCC00',
    },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: (m) => m.title || 'RepairCoin Announcement',
      body: (m) => m.message || '',
    },
  },

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

  // ── Customer-cancelled booking → confirmation TO the customer ─────────────
  // Distinct from service_order_cancelled (shop-initiated) because the wording
  // must reflect that the customer cancelled, not the shop. Transactional so the
  // refund summary always lands even if the customer muted order updates.
  service_order_cancelled_by_customer: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: { title: 'Booking Cancelled', icon: 'cancelled', color: '#EF4444' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      title: () => 'Booking Cancelled',
      body: (m) =>
        `Your ${m.serviceName} booking at ${m.shopName} has been cancelled.` +
        (m.refundSummary ? ` Refund: ${m.refundSummary}` : ''),
    },
  },

  // ── Customer-cancelled booking → notification TO the shop ─────────────────
  // Lets the shop free the slot and see the refund/reason. Gated on the shop's
  // 'newOrders' preference (see NOTIFICATION_PREFERENCE_MAP), consistent with
  // service_booking_received.
  service_booking_cancelled: {
    channels: ['persist', 'ws', 'push'],
    display: { title: 'Booking Cancelled', icon: 'cancelled', color: '#EF4444' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      title: () => 'Booking Cancelled',
      body: (m) =>
        `${m.customerName} cancelled their ${m.serviceName} booking.`,
    },
  },

  // ── Appointment reminders (migrated from AppointmentReminderService) ──────
  booking_confirmed: {
    channels: ['persist', 'ws', 'push'],
    display: { title: 'Booking Confirmed', icon: 'calendar', color: '#3B82F6' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      body: (m) =>
        `Your ${m.serviceName} at ${m.shopName} is confirmed for ${m.bookingDateLabel} at ${m.bookingTimeLabel}`,
      imageUrl: (m) => m.imageUrl,
    },
  },
  appointment_reminder: {
    channels: ['persist', 'ws', 'push'],
    display: { title: 'Appointment Reminder', icon: 'alarm', color: '#8B5CF6' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      title: () => 'Appointment Tomorrow',
      body: (m) => `Reminder: ${m.serviceName} at ${m.shopName} at ${m.bookingTimeLabel}`,
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
  // Persist-only to PRESERVE existing behavior: MarketingService's WS broadcast
  // was dead code (its wsManager was never injected at any construction site),
  // so campaigns have only ever persisted. Enabling live broadcast is a
  // deliberate opt-in — add 'ws' here — not a silent side effect of migration.
  marketing_campaign: {
    channels: ['persist'],
    display: { title: (m) => m.campaignName || 'Campaign', icon: 'campaign', color: '#EC4899' },
  },
};
