// Custom Workflows A3 — repair-shop templates.
//
// The differentiator. GoHighLevel hands you a blank canvas because it has to serve every industry;
// FixFlow knows what a repair shop does, so it can hand you the flows a repair shop actually runs.
// A shop owner should be able to click "Post-repair follow-up" and be running an automation in under a
// minute, rather than reasoning about triggers and audiences from scratch.
//
// CONSTRAINT: every template below uses only triggers and actions that EXIST today. W3 added the
// operations triggers (no_show, review_received, low_rating), which is what let "Recover a no-show",
// "Make a bad review right" and "Thank a happy customer" join the list. Low-stock reorder is still
// absent: it is shop-scoped with no customer to message, so it needs a notify_staff action first.
// Shipping a template that cannot run would be worse than shipping none.

import type { AutoMessage } from "@/services/api/messaging";

/** Prefill for the builder. No `id`, so the modal opens in "create" mode. */
export type WorkflowTemplateDraft = Partial<AutoMessage>;

export interface WorkflowTemplate {
  id: string;
  name: string;
  /** One line the owner can judge in a glance. */
  description: string;
  /** Plain-language shape, shown on the card: "Booking completed → wait 3d → message → 10 RCN". */
  shape: string;
  draft: WorkflowTemplateDraft;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "post-repair-followup",
    name: "Post-repair follow-up",
    description: "Thank the customer after a repair, ask for a review, then reward them for coming back.",
    shape: "Booking completed → 1d: thank you → +2d: review request → +1d: 10 RCN",
    draft: {
      name: "Post-repair follow-up",
      triggerType: "event",
      eventType: "booking_completed",
      delayHours: 24,
      targetAudience: "all",
      maxSendsPerCustomer: 1,
      actionType: "send_message",
      stopOnBooking: false,
      steps: [
        {
          actionType: "send_message",
          messageTemplate:
            "Hi {{customerName}}, thanks for choosing {{shopName}}! Your repair is all done — if anything doesn't feel right, just reply here and we'll sort it out.",
          delayHours: 0,
        },
        {
          actionType: "send_message",
          messageTemplate:
            "Hi {{customerName}}, hope everything's still working well! If you have a minute, a quick review really helps a small shop like ours.",
          delayHours: 48,
        },
        {
          actionType: "issue_reward",
          actionPayload: { amountRcn: 10, reason: "Post-repair thank you" },
          delayHours: 24,
        },
      ],
    },
  },
  {
    id: "win-back-lapsed",
    name: "Win back lapsed customers",
    description: "Reach out to customers who haven't been in for a month, with RCN to bring them back.",
    shape: "Inactive 30 days → message → +2d: 25 RCN",
    draft: {
      name: "Win back lapsed customers",
      triggerType: "event",
      eventType: "inactive_30_days",
      delayHours: 0,
      targetAudience: "inactive_30d",
      maxSendsPerCustomer: 1,
      actionType: "send_message",
      stopOnBooking: true,
      steps: [
        {
          actionType: "send_message",
          messageTemplate:
            "Hi {{customerName}}, it's been a while! Everything still running smoothly? {{shopName}} is here whenever you need us.",
          delayHours: 0,
        },
        {
          actionType: "issue_reward",
          actionPayload: { amountRcn: 25, reason: "Win-back offer" },
          delayHours: 48,
        },
      ],
    },
  },
  {
    id: "welcome-new-customer",
    name: "Welcome a new customer",
    description: "Introduce the shop after a first visit and start their rewards balance.",
    shape: "First visit → welcome message → +1d: 15 RCN",
    draft: {
      name: "Welcome a new customer",
      triggerType: "event",
      eventType: "first_visit",
      delayHours: 2,
      targetAudience: "all",
      maxSendsPerCustomer: 1,
      actionType: "send_message",
      stopOnBooking: false,
      steps: [
        {
          actionType: "send_message",
          messageTemplate:
            "Welcome to {{shopName}}, {{customerName}}! Any questions about your repair, just reply here — you're talking to a real person.",
          delayHours: 0,
        },
        {
          actionType: "issue_reward",
          actionPayload: { amountRcn: 15, reason: "Welcome bonus" },
          delayHours: 24,
        },
      ],
    },
  },
  {
    id: "cancellation-save",
    name: "Rescue a cancelled booking",
    description: "Follow up shortly after a cancellation to offer an easy reschedule.",
    shape: "Booking cancelled → +2h: message",
    draft: {
      name: "Rescue a cancelled booking",
      triggerType: "event",
      eventType: "booking_cancelled",
      delayHours: 2,
      targetAudience: "all",
      maxSendsPerCustomer: 2,
      actionType: "send_message",
      messageTemplate:
        "Hi {{customerName}}, sorry that appointment didn't work out. Want us to find you another slot? Just reply with a day that suits and we'll sort it.",
      stopOnBooking: false,
      steps: null,
    },
  },
  {
    id: "no-show-recovery",
    name: "Recover a no-show",
    description: "Reach out after a missed appointment and make it easy to rebook.",
    shape: "No-show → +3h: message",
    draft: {
      name: "Recover a no-show",
      triggerType: "event",
      eventType: "no_show",
      delayHours: 3,
      targetAudience: "all",
      maxSendsPerCustomer: 2,
      actionType: "send_message",
      messageTemplate:
        "Hi {{customerName}}, we missed you today at {{shopName}} — no problem at all. Want us to find you another slot? Just reply with a day that works.",
      stopOnBooking: false,
      steps: null,
    },
  },
  {
    id: "bad-review-recovery",
    name: "Make a bad review right",
    description: "When someone leaves 1–2 stars, reach out personally before it hardens.",
    shape: "Low rating → +1h: message → +2d: 20 RCN",
    draft: {
      name: "Make a bad review right",
      triggerType: "event",
      eventType: "low_rating",
      delayHours: 1,
      targetAudience: "all",
      maxSendsPerCustomer: 1,
      actionType: "send_message",
      stopOnBooking: false,
      steps: [
        {
          actionType: "send_message",
          messageTemplate:
            "Hi {{customerName}}, I saw your review and I'm sorry we fell short. Tell me what went wrong and I'll put it right — you're talking to the shop directly here.",
          delayHours: 0,
        },
        {
          actionType: "issue_reward",
          actionPayload: { amountRcn: 20, reason: "Service recovery" },
          delayHours: 48,
        },
      ],
    },
  },
  {
    id: "thank-good-review",
    name: "Thank a happy customer",
    description: "Acknowledge every review that comes in, so customers know it was read.",
    shape: "Review received → +2h: thank you",
    draft: {
      name: "Thank a happy customer",
      triggerType: "event",
      eventType: "review_received",
      delayHours: 2,
      targetAudience: "all",
      maxSendsPerCustomer: 1,
      actionType: "send_message",
      messageTemplate:
        "Thanks for the review, {{customerName}} — it genuinely helps a small shop like {{shopName}}. See you next time!",
      stopOnBooking: false,
      steps: null,
    },
  },
  {
    id: "payment-recovery",
    name: "Recover a failed payment",
    description: "A card decline isn't a lost customer — offer to sort it out while they still want the service.",
    shape: "Payment failed → +1h: message → +1d: notify team",
    draft: {
      name: "Recover a failed payment",
      triggerType: "event",
      eventType: "payment_failed",
      delayHours: 1,
      targetAudience: "all",
      maxSendsPerCustomer: 2,
      actionType: "send_message",
      // Exits if they rebook — no point chasing someone who already sorted it.
      stopOnBooking: true,
      steps: [
        {
          actionType: "send_message",
          messageTemplate:
            "Hi {{customerName}}, your payment didn't go through for that booking at {{shopName}} — happens more than you'd think. Want to try again? Reply here and we'll sort it.",
          delayHours: 0,
        },
        {
          actionType: "notify_staff",
          actionPayload: { message: "Payment failed and the customer hasn't rebooked — worth a call." },
          delayHours: 24,
        },
      ],
    },
  },
  {
    id: "low-stock-alert",
    name: "Tell me when stock runs low",
    description: "Get an alert the moment a part drops below its reorder threshold.",
    shape: "Low stock → notify my team",
    draft: {
      name: "Low stock alert",
      triggerType: "event",
      eventType: "low_stock",
      delayHours: 0,
      targetAudience: "all",
      maxSendsPerCustomer: 1,
      // Shop-scoped: this happens to the shop, so there's no customer and no message.
      actionType: "notify_staff",
      actionPayload: { message: "Stock is running low — worth reordering before it runs out." },
      messageTemplate: null,
      stopOnBooking: false,
      steps: null,
    },
  },
  {
    id: "slow-week-promo",
    name: "Fill a slow week",
    description: "When bookings dip, nudge active customers with an offer.",
    shape: "Slow week → message to active customers",
    draft: {
      name: "Fill a slow week",
      triggerType: "event",
      eventType: "low_bookings",
      delayHours: 0,
      targetAudience: "active",
      maxSendsPerCustomer: 1,
      actionType: "send_message",
      messageTemplate:
        "Hi {{customerName}}, we've got space this week at {{shopName}}. Anything you've been putting off? Reply and we'll get you booked in.",
      stopOnBooking: false,
      steps: null,
    },
  },
];
