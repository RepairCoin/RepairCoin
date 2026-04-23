-- Migration 106: Update successful_appointments_since_tier3 column comment
-- Description: The counter was originally only used for deposit_required -> caution resets.
--              It now tracks successful appointments since the last tier drop across
--              deposit_required, caution, and warning tiers (cascade reset feature).
--              Column name kept for backwards compatibility with existing SELECT statements.
-- Date: 2026-04-24

COMMENT ON COLUMN customers.successful_appointments_since_tier3 IS 'Counter for successful appointments since last tier drop; cascades deposit_required -> caution -> warning -> normal';
