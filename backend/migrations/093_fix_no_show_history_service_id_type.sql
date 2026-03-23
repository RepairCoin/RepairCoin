-- Fix: no_show_history.service_id is UUID but service_orders.service_id is VARCHAR
-- with 'srv_' prefix (e.g. srv_0ad92072-...). This caused INSERT to silently fail,
-- breaking the entire no-show history and dispute system.
ALTER TABLE no_show_history ALTER COLUMN service_id TYPE VARCHAR(255);
