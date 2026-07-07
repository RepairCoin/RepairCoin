-- 209 — Service import provenance (Square + other third-party catalogs). Mirrors the customer import
-- fields (migration 183) for shop_services: import_source ('square'/'csv'/…) + external_ref (the
-- origin system's item id, e.g. a Square catalog Token). external_ref gives re-imports a stable
-- identity so the same catalog UPDATES rather than duplicating (name-only dedup breaks on renames).
-- See docs/tasks/strategy/service-import-square-scope.md. Idempotent.
ALTER TABLE shop_services
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS external_ref  TEXT;

-- Dedup lookup: a shop's item by its origin id. Partial (only imported rows carry external_ref).
CREATE INDEX IF NOT EXISTS idx_shop_services_external_ref
  ON shop_services (shop_id, external_ref) WHERE external_ref IS NOT NULL;
