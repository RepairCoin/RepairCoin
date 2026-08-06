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
-- Numbered 268 although this branch's migrations stop at 253. Getting here took three attempts, and
-- each failure was a different authority nobody checks together:
--
--   265 — rejected by CI. A FILE on another branch already claimed it.
--   267 — passed CI, deployed, and silently did nothing. No file claimed it, but staging's
--         schema_migrations already had 267 = fix_subscription_status_trigger, so the runner saw the
--         version as applied and skipped this SQL entirely. The table was never created and every task
--         write would have failed against a missing relation.
--   268 — free in BOTH.
--
-- So a free number must be free in three places, and no single tool checks all of them:
--   * local files              — `npm run db:create-migration` sees only these (it proposed 254)
--   * files on every other ref — `git ls-tree` across refs, and only as fresh as your last fetch
--   * schema_migrations on the target database — the one that actually decides whether SQL runs
--
-- CI's `db:check-migrations` covers the first two and cannot see the third. That is why 267 went green
-- and still did nothing: a duplicate version does not fail, it is skipped.

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
