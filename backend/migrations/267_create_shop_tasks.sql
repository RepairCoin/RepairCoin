-- Custom Workflows §9.2.1 — the `create_task` action.
--
-- The platform has no to-do list. `notify_staff` covers "tell me", and a notification is read once and
-- gone; this covers "remind me until it's done". That difference is the entire feature, and it is why
-- the row needs a status rather than just an existence.
--
-- Deliberately a SUPERSET of the two things the scope line asked for ("a task, or a flag on a
-- customer/booking"). A flag is a task that points at a record — nullable customer_address / order_id —
-- so the record view can later list tasks attached to it without a second table or a second concept.
--
-- Numbered 267 although this branch's migrations stop at 253: 254–266 are taken on other branches, and
-- a duplicate integer silently skips the SQL rather than failing, so the table would simply never
-- exist.
--
-- Two traps here, both hit while writing this file. `npm run db:create-migration` reads local files and
-- schema_migrations only, so it proposes 254 — it cannot see other branches. And a `git ls-tree` scan
-- across branches is only as fresh as your last fetch: this was first numbered 265, which CI rejected
-- because 265 had landed elsewhere in the meantime. **Fetch, then scan every ref.**

CREATE TABLE IF NOT EXISTS shop_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         VARCHAR(100) NOT NULL,

  title           VARCHAR(200) NOT NULL,
  body            TEXT,

  -- 'workflow' when an automation created it, 'manual' when a person did. Kept apart because they age
  -- differently: an ignored machine-proposed task is noise, an ignored hand-written one is somebody's
  -- intent. The same asymmetry that decided the campaign-draft sweep.
  source          VARCHAR(20) NOT NULL DEFAULT 'workflow'
                    CHECK (source IN ('workflow', 'manual')),
  -- Which rule made it. Also the dedup key, so a recurring trigger cannot stack ten copies.
  source_rule_id  UUID,

  -- What it is ABOUT, when it is about something. Both nullable: "order a new heat gun" is about
  -- nothing in particular, and that is a legitimate task rather than a degenerate one.
  customer_address VARCHAR(255),
  order_id        VARCHAR(100),

  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'done', 'dismissed')),
  due_at          TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  completed_by_member_id UUID
);

-- The list view: this shop's open tasks, newest first. Every read the Tasks card makes.
CREATE INDEX IF NOT EXISTS idx_shop_tasks_shop_status
  ON shop_tasks (shop_id, status, created_at DESC);

-- The dedup lookup, and the "what did this workflow produce" question behind per-rule counts.
CREATE INDEX IF NOT EXISTS idx_shop_tasks_rule_open
  ON shop_tasks (source_rule_id, status)
  WHERE source_rule_id IS NOT NULL;

-- Attached tasks, for showing a flag when a customer or order record is opened.
CREATE INDEX IF NOT EXISTS idx_shop_tasks_customer
  ON shop_tasks (shop_id, customer_address)
  WHERE customer_address IS NOT NULL;

COMMENT ON TABLE shop_tasks IS
  'Shop to-do items. Created by the create_task workflow action or by hand. A task with a customer_address or order_id acts as a flag on that record.';
