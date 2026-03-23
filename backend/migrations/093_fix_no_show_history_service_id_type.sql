-- Fix: no_show_history.service_id and order_id are UUID but service_orders uses VARCHAR
-- with prefixes (e.g. srv_xxx, ord_xxx). This caused INSERT to silently fail,
-- breaking the entire no-show history and dispute system.
ALTER TABLE no_show_history ALTER COLUMN service_id TYPE VARCHAR(255);
ALTER TABLE no_show_history ALTER COLUMN order_id TYPE VARCHAR(255);
