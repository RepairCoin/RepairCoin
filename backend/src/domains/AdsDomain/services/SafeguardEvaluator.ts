// backend/src/domains/AdsDomain/services/SafeguardEvaluator.ts
//
// STAGE 1 STUB. The nightly cron that auto-pauses campaigns burning budget with
// no leads/bookings ($400 soft alert / $800 hard pause — Plan B contract terms).
// Stage 0 ships the signature only so the skeleton is wired; the decision logic
// + NotificationDomain hookup + ads:campaign_paused_by_safeguard event land in
// Stage 1. See docs/tasks/strategy/ads-system/ (§Stage 1).

export interface SafeguardDecision {
  campaignId: string;
  action: 'none' | 'soft_alert' | 'hard_pause';
  reason?: string;
}

export class SafeguardEvaluator {
  /** Evaluate every active campaign; pause/alert where thresholds are breached. */
  async runNightly(): Promise<SafeguardDecision[]> {
    throw new Error('SafeguardEvaluator.runNightly not implemented — Stage 1');
  }
}
