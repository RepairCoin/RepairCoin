// backend/src/domains/AdsDomain/events.ts
//
// EventBus event-type constants for the Ads domain. Stage 0 only publishes
// CAMPAIGN_CREATED; the rest are reserved for Stages 1-3 (no listeners yet).
// Publish via eventBus.publish(createDomainEvent(AdsEvents.X, payload)).

export const AdsEvents = {
  CAMPAIGN_CREATED: 'ads:campaign_created',
  CAMPAIGN_PAUSED_BY_SAFEGUARD: 'ads:campaign_paused_by_safeguard',
  LEAD_CAPTURED: 'ads:lead_captured',
  LEAD_CONVERTED_TO_CUSTOMER: 'ads:lead_converted_to_customer',
  LEAD_BOOKED: 'ads:lead_booked',
} as const;

export type AdsEventType = (typeof AdsEvents)[keyof typeof AdsEvents];
