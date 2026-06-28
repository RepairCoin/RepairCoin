-- 184 — allow admin-scoped (global) customer imports to record a job. import_jobs.shop_id was
-- NOT NULL with a FK to shops, so an admin import (no shop) couldn't save its job: NULL failed the
-- NOT NULL, and a placeholder like 'admin' failed the FK (no such shop). Dropping NOT NULL lets us
-- store NULL for admin imports — the FK is not enforced on NULL, so it's satisfied. Shop imports
-- still pass a real shop_id. Idempotent.

ALTER TABLE import_jobs ALTER COLUMN shop_id DROP NOT NULL;
