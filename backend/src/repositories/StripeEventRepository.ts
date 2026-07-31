import { BaseRepository } from './BaseRepository';

/**
 * Webhook idempotency store. Every incoming Stripe event id is claimed on arrival; a
 * re-delivered event that's already present is skipped so reconcile runs at most once.
 * (Payments & Invoicing Center, Phase 0.)
 */
export class StripeEventRepository extends BaseRepository {
  /**
   * Claim an event id. Returns true if this is the FIRST time we've seen it (caller should
   * process it), false if it was already recorded (caller should skip — a redelivery).
   */
  async claim(stripeEventId: string, type: string, accountId?: string | null): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO stripe_events (stripe_event_id, type, account_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING stripe_event_id`,
      [stripeEventId, type, accountId ?? null]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Stamp an event as fully processed (for observability / reconciliation audits). */
  async markProcessed(stripeEventId: string): Promise<void> {
    await this.pool.query(
      `UPDATE stripe_events SET processed_at = now() WHERE stripe_event_id = $1`,
      [stripeEventId]
    );
  }

  /**
   * Release a claim so a failed delivery can be reprocessed on Stripe's retry. Called when
   * processing throws AFTER claiming — without this, the retry would be deduped and the event
   * would be lost. Only releases claims that never completed (processed_at IS NULL).
   */
  async unclaim(stripeEventId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM stripe_events WHERE stripe_event_id = $1 AND processed_at IS NULL`,
      [stripeEventId]
    );
  }
}
