// Custom Workflows A3 — repair-shop templates.
//
// The differentiator. GoHighLevel hands you a blank canvas because it has to serve every industry;
// FixFlow knows what a repair shop does, so it can hand you the flows a repair shop actually runs.
// A shop owner should be able to click "Post-repair follow-up" and be running an automation in under a
// minute, rather than reasoning about triggers and audiences from scratch.
//
// CONSTRAINT: every template below uses only triggers and actions that EXIST today —
// booking_completed / booking_cancelled / first_visit / inactive_30_days / low_bookings, and
// send_message / issue_reward. Templates for triggers we haven't built (low stock, review received,
// no-show) belong with W3, not here; shipping a template that cannot run would be worse than shipping
// none.

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
