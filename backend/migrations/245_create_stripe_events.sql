-- Migration: 245_create_stripe_events.sql
-- Author: Nico Regalado
-- Date: 2026-07-27
-- Description: Stripe webhook idempotency store (Payments & Invoicing Center, Phase 0).
--   Every Stripe event id is claimed on arrival (INSERT ... ON CONFLICT DO NOTHING); a
--   re-delivered event that's already present is skipped, so reconcile runs at most once.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 245) THEN

        CREATE TABLE IF NOT EXISTS stripe_events (
          stripe_event_id VARCHAR(255) PRIMARY KEY,
          type            VARCHAR(80)  NOT NULL,
          account_id      VARCHAR(255),           -- event.account for Connect events
          received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          processed_at    TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events (type, received_at DESC);

        INSERT INTO schema_migrations (version, name) VALUES (245, 'create_stripe_events');
        RAISE NOTICE 'Migration 245 (create_stripe_events) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 245 (create_stripe_events) already applied';
    END IF;
END $$;
