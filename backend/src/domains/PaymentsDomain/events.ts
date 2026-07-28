// EventBus event types emitted by the Payments domain. Colon-namespaced, matching AdsEvents.
export const PaymentsEvents = {
  PAYMENT_RECORDED: 'payments:payment_recorded',
  PAYMENT_REFUNDED: 'payments:payment_refunded',
} as const;
