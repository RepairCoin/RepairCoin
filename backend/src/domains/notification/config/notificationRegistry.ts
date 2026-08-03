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

export type DeliveryChannel = 'persist' | 'ws' | 'push' | 'sms';

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

/**
 * SMS payload builder. Required when `channels` includes 'sms'. The gateway
 * resolves the recipient's phone from their address, enforces opt-out + E.164,
 * and only sends when Twilio is configured — this just supplies the text.
 * Keep bodies short (ideally < 160 chars) and end with "Reply STOP to opt out".
 */
export interface NotificationSmsConfig {
  body: (metadata: Record<string, any>) => string;
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
  /** SMS payload builder. Required when `channels` includes 'sms'. */
  sms?: NotificationSmsConfig;
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

  // ── Shop nudge: a paid booking still hasn't been marked complete ─────────────
  // Sent TO the shop during the grace window. Transactional: this protects the shop's
  // own revenue — ignoring it is what sends the booking to the customer to resolve.
  booking_completion_nudge: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: {
      title: (m) => `Mark "${m.serviceName || 'a booking'}" complete?`,
      icon: 'appointments',
      color: '#F59E0B',
    },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: (m) => `Mark "${m.serviceName || 'a booking'}" complete?`,
      body: (m) =>
        `${m.customerName || 'A customer'}'s booking is still open. Confirm it so payment settles.`,
    },
  },

  // ── Customer reminder while a booking awaits their confirmation ──────────────
  booking_confirmation_reminder: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: {
      title: (m) => `Still need to know about your ${m.serviceName || 'booking'}`,
      icon: 'appointments',
      color: '#F59E0B',
    },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: (m) => `Still need to know about your ${m.serviceName || 'booking'}`,
      body: (m) =>
        `Tell us whether your booking at ${m.shopName || 'the shop'} went ahead so we can close it off.`,
    },
  },

  // ── Booking parked awaiting the customer's confirmation ──────────────────────
  // The shop's grace window closed without a completion. Transactional: the customer
  // has money sitting against an unresolved booking, and this is the prompt that lets
  // them close it off or report it never happened. Not something to let preferences mute.
  booking_awaiting_confirmation: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: {
      title: (m) => `Did your ${m.serviceName || 'booking'} go ahead?`,
      icon: 'appointments',
      color: '#F59E0B',
    },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: (m) => `Did your ${m.serviceName || 'booking'} go ahead?`,
      // Metadata only — push builders never receive the in-app `message`.
      body: (m) =>
        `${m.shopName || 'The shop'} hasn't confirmed it. Tell us whether it happened so we can close it off.`,
    },
  },

  // ── Follow shop: a shop a customer follows published a new service ───────────
  // Sent TO each follower. Not transactional — it's a marketing-style nudge the
  // customer can mute via preferences.
  shop_new_service: {
    channels: ['persist', 'ws', 'push'],
    display: {
      title: (m) => `${m.shopName || 'A shop you follow'} added a new service`,
      icon: 'campaign',
      color: '#FFCC00',
    },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: (m) => `${m.shopName || 'A shop you follow'} added a new service`,
      // Built from metadata, not the in-app `message` — push builders only ever
      // receive metadata, so naming the shop here keeps the banner as specific
      // as the in-app copy instead of falling back to generic text.
      body: (m) =>
        `${m.shopName || 'A shop you follow'} just added "${m.serviceName || 'a new service'}". Book before it fills up.`,
    },
  },
  // ── AI Usage Overage billing (T3.2) — shop-facing billing events ──────────
  ai_overage_started: {
    channels: ['persist', 'ws', 'push'],
    transactional: true, // a billing event must reach the shop regardless of preferences
    display: { title: 'AI Overage Active', icon: 'billing', color: '#FFCC00' },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: () => 'AI Usage Overage active',
      body: (m) => m.message || 'You passed your monthly AI allowance — overage is now billing at Usage ×3.',
    },
  },
  // ── Platform-issued refund (Payments Center, Slice A2) ────────────────────
  // FixFlow refunded a charge in the shop's own Stripe account. Direct charges, so this is
  // money leaving the MERCHANT's balance on someone else's instruction — transactional because
  // a debit the shop didn't make must never be silenced by a notification preference.
  payment_refunded_by_admin: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: { title: 'Refund issued by FixFlow', icon: 'billing', color: '#F97316' },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'high',
      title: () => 'FixFlow issued a refund',
      body: (m) =>
        `${m.amountLabel || 'A refund'} was refunded from your account by FixFlow.` +
        (m.note ? ` Reason: ${m.note}` : ''),
    },
  },

  // ── Custom Workflows: the notify_staff action ────────────────────────────
  // Raised BY the shop's own automation, TO the shop — "a no-show just happened", "stock is low".
  // Not transactional: the shop opted into this by building the workflow, so it should also be able
  // to mute it via preferences without deleting the automation.
  workflow_staff_alert: {
    channels: ['persist', 'ws', 'push'],
    display: {
      title: (m) => m.workflowName || 'Workflow alert',
      icon: 'campaign',
      color: '#FFCC00',
    },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'default',
      title: (m) => m.workflowName || 'Workflow alert',
      body: (m) => m.message || 'One of your automations needs attention.',
    },
  },

  ai_overage_payment_failed: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: { title: 'AI Overage Payment Failed', icon: 'alert', color: '#EF4444' },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'high',
      title: () => 'AI overage payment failed',
      body: (m) => m.message || 'We couldn’t charge your card for AI overage. We’ll retry — please check your payment method.',
    },
  },
  ai_overage_disabled: {
    channels: ['persist', 'ws', 'push'],
    transactional: true,
    display: { title: 'AI Overage Turned Off', icon: 'alert', color: '#EF4444' },
    push: {
      channelId: NotificationChannels.DEFAULT,
      priority: 'high',
      title: () => 'AI overage turned off',
      body: (m) => m.message || 'AI overage was turned off after a payment couldn’t be collected. Your AI still works on the included allowance.',
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
    channels: ['persist', 'ws', 'push', 'sms'],
    display: { title: 'Booking Confirmed', icon: 'calendar', color: '#3B82F6' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      body: (m) =>
        `Your ${m.serviceName} at ${m.shopName} is confirmed for ${m.bookingDateLabel} at ${m.bookingTimeLabel}`,
      imageUrl: (m) => m.imageUrl,
    },
    sms: {
      body: (m) =>
        `${m.shopName}: your ${m.serviceName} is booked for ${m.bookingDateLabel} at ${m.bookingTimeLabel}. Reply STOP to opt out.`,
    },
  },
  appointment_reminder: {
    channels: ['persist', 'ws', 'push', 'sms'],
    display: { title: 'Appointment Reminder', icon: 'alarm', color: '#8B5CF6' },
    push: {
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      title: () => 'Appointment Tomorrow',
      body: (m) => `Reminder: ${m.serviceName} at ${m.shopName} at ${m.bookingTimeLabel}`,
    },
    sms: {
      body: (m) =>
        `Reminder from ${m.shopName}: your ${m.serviceName} is tomorrow at ${m.bookingTimeLabel}. Reply STOP to opt out.`,
    },
  },
  // NOTE: the _2h and upcoming_* reminders were persist+ws only. SMS is added to
  // the customer-facing 2h reminder as an intentional new channel (the whole
  // point of SMS reminders); the shop-facing upcoming_* stay in-app only.
  appointment_reminder_2h: {
    channels: ['persist', 'ws', 'sms'],
    display: { title: 'Appointment Reminder', icon: 'alarm', color: '#8B5CF6' },
    sms: {
      body: (m) =>
        `Reminder from ${m.shopName}: your ${m.serviceName} is today at ${m.bookingTimeLabel}. See you soon! Reply STOP to opt out.`,
    },
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
