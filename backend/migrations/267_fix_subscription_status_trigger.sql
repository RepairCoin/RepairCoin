-- Migration: 267_fix_subscription_status_trigger.sql
-- Author: Nico Regalado
-- Date: 2026-08-06
-- Description: Stop a database trigger writing an operational_status the application never uses.
--
--   `update_shop_operational_status_on_subscription` fires on every insert or update of
--   shop_subscriptions and sets shops.operational_status to 'commitment_qualified' whenever the row
--   is active. The name is a leftover: commitment enrollments were removed in September 2025, and
--   every reader in the codebase — the subscription guard, the dashboard, the onboarding banner,
--   the admin list — tests for 'subscription_qualified'.
--
--   So the trigger and the application disagreed about the same shop, and the trigger wins because
--   it fires last. Any code path that touches shop_subscriptions — a webhook sync, a plan change, a
--   support fix — silently relabelled the shop into a status nothing recognised, and the shop was
--   shown the free plan while paying. That is not hypothetical: two shops on staging were sitting in
--   'commitment_qualified' with active business subscriptions.
--
--   The trigger keeps its job. It just writes the status the rest of the system reads.
--
--   Existing rows are normalised only where a shop actually has an active subscription behind them,
--   so this cannot promote a shop whose cover has lapsed.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 267) THEN

        CREATE OR REPLACE FUNCTION public.update_shop_operational_status_on_subscription()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        BEGIN
          IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            UPDATE shops
            SET
              subscription_active = (NEW.status = 'active' AND NEW.is_active = true),
              subscription_id = CASE
                WHEN NEW.status = 'active' AND NEW.is_active = true THEN NEW.id
                ELSE NULL
              END,
              operational_status = CASE
                -- An admin pause is a deliberate block and outranks anything the billing rows say.
                WHEN operational_status = 'paused' THEN 'paused'
                WHEN NEW.status = 'active' AND NEW.is_active = true THEN 'subscription_qualified'
                WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
                ELSE 'not_qualified'
              END
            WHERE shop_id = NEW.shop_id;
          END IF;

          RETURN NEW;
        END;
        $function$;

        UPDATE shops sh
        SET operational_status = 'subscription_qualified',
            updated_at = NOW()
        FROM shop_subscriptions s
        WHERE s.shop_id = sh.shop_id
          AND sh.operational_status = 'commitment_qualified'
          AND s.status = 'active'
          AND s.is_active = true;

        INSERT INTO schema_migrations (version, name) VALUES (267, 'fix_subscription_status_trigger');
        RAISE NOTICE 'Migration 267 (fix_subscription_status_trigger) applied successfully';

    ELSE
        RAISE NOTICE 'Migration 267 (fix_subscription_status_trigger) already applied';
    END IF;
END $$;

-- Rollback (manual): restore the previous body, which wrote 'commitment_qualified' and had no
-- 'paused' guard. Shops normalised above keep 'subscription_qualified' — that is the correct value
-- either way, and reverting it would re-break the readers.
