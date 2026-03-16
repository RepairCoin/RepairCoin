-- Migration 089: Remove unused UTM columns from waitlist tables

ALTER TABLE waitlist DROP COLUMN IF EXISTS utm_campaign;
ALTER TABLE waitlist DROP COLUMN IF EXISTS utm_medium;
ALTER TABLE waitlist DROP COLUMN IF EXISTS utm_source;

ALTER TABLE waitlist_page_views DROP COLUMN IF EXISTS utm_campaign;
ALTER TABLE waitlist_page_views DROP COLUMN IF EXISTS utm_medium;
ALTER TABLE waitlist_page_views DROP COLUMN IF EXISTS utm_source;
