-- 200 — Fix the ad_campaign_requests.goal CHECK constraint to include 'leads'. The app (briefValidation
-- parseBrief) accepts goal 'leads' (the "More leads / inquiries" option), but the DB constraint only
-- allowed more_bookings/awareness/promote_service, so submitting a leads campaign threw a 500
-- ("Failed to submit request"). Drop-then-add (Postgres has no ADD CONSTRAINT IF NOT EXISTS) keeps it
-- idempotent.
ALTER TABLE ad_campaign_requests DROP CONSTRAINT IF EXISTS ad_campaign_requests_goal_check;
ALTER TABLE ad_campaign_requests ADD CONSTRAINT ad_campaign_requests_goal_check
  CHECK (goal IS NULL OR goal = ANY (ARRAY['more_bookings', 'leads', 'awareness', 'promote_service']));
