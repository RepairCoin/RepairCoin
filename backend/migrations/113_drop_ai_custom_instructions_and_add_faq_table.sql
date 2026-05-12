-- Migration: Drop ai_custom_instructions column, add service_ai_faq_entries table
--
-- BACKGROUND
-- The ai_custom_instructions column was added in migration 108 alongside the
-- other AI Sales Assistant settings (tone, upsells, booking assistance). The
-- intent was "shop-authored imperative instructions the AI should HONOR" —
-- e.g., "always mention the 30-day warranty". The backend round-tripped the
-- field but no frontend form ever exposed it; that migration's column comment
-- explicitly acknowledged the gap. No shop has populated it.
--
-- A local-prompt B' test on 2026-05-12 confirmed that structured Q&A content
-- (FAQ pairs) is a stronger AI knowledge primitive than free-form imperative
-- instructions. The Q&A pattern matches how customers actually behave (they
-- ask questions; the AI's job is to answer them), gives Claude a clear
-- pattern to quote facts from, and removes the "what should I write?" blank-
-- page problem for shop owners (the dashboard ships starter Qs).
--
-- This migration:
--   1. Drops the unused ai_custom_instructions column.
--   2. Adds service_ai_faq_entries as a child table of shop_services.
--
-- Strategy doc: docs/tasks/strategy/ai-sales-agent/ai-knowledge-base-strategy.md

-- Step 1: Drop the unused column. No data loss: column was never populated.
ALTER TABLE shop_services
  DROP COLUMN IF EXISTS ai_custom_instructions;

-- Step 2: Create the FAQ entries table. One service has many entries; order
-- is preserved via display_order so the AI prompt + dashboard list render in
-- the shop owner's intended sequence (most-asked first, etc.).
--
-- Soft reference on service_id (no FOREIGN KEY): shop_services.service_id is
-- a VARCHAR without a UNIQUE/PRIMARY KEY constraint on staging+prod despite
-- migration 036 declaring it as UUID PRIMARY KEY (schema drift). Migration
-- 110 hit the same wall for ai_agent_messages.service_id and used the same
-- soft-reference pattern. Adding a real FK here would fail with "no unique
-- constraint matching given keys for referenced table". Cleanup on service
-- delete is handled application-side in ServiceManagementService — see
-- ServiceAIFaqRepository.deleteEntriesForService.
CREATE TABLE IF NOT EXISTS service_ai_faq_entries (
  faq_entry_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    VARCHAR NOT NULL,
  question      VARCHAR(300) NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Composite index supports the per-service ordered fetch that
-- ContextBuilder runs once per AI reply. Single-column (service_id) alone
-- would still work; including display_order means the index covers the
-- ORDER BY too.
CREATE INDEX IF NOT EXISTS idx_service_ai_faq_entries_service_id_order
  ON service_ai_faq_entries(service_id, display_order);

-- Step 4: Document the new table for future readers.
COMMENT ON TABLE service_ai_faq_entries IS
  'AI Sales Assistant FAQ entries per service. Q&A pairs the AI references when answering customer questions. Optional; empty rows mean the AI falls back to shop_services.description only. Strategy doc: docs/tasks/strategy/ai-sales-agent/ai-knowledge-base-strategy.md';
COMMENT ON COLUMN service_ai_faq_entries.question IS
  'The customer-facing question, headline-style. Capped at 300 chars at the DB level so the dashboard form has a clear ceiling.';
COMMENT ON COLUMN service_ai_faq_entries.answer IS
  'The factual answer. Plain text; rendered to Claude as a Q→A line. UI caps at 2000 chars; DB TEXT lets us lift later.';
COMMENT ON COLUMN service_ai_faq_entries.display_order IS
  'Lower numbers render first. Shop owner controls via up/down arrows in the dashboard. Ties broken by created_at (oldest first).';
