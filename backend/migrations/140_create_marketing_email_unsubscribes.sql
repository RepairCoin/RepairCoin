-- 140_create_marketing_email_unsubscribes.sql
--
-- Per-shop email opt-out list. The unsubscribe link in marketing/contact emails
-- records (shop_id, email) here; campaign audience and contact sends filter
-- against it. Email-keyed so it covers both customers and imported contacts.

CREATE TABLE IF NOT EXISTS marketing_email_unsubscribes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, email)
);

CREATE INDEX IF NOT EXISTS idx_marketing_email_unsubscribes_shop
  ON marketing_email_unsubscribes (shop_id);
