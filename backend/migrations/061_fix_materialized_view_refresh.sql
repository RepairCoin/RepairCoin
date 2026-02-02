-- Fix materialized view refresh to handle missing unique index gracefully
-- This fixes PostgreSQL error 55000: "cannot refresh materialized view public.platform_statistics concurrently"

-- Drop and recreate the refresh function with better error handling
CREATE OR REPLACE FUNCTION refresh_platform_statistics()
RETURNS void AS $$
BEGIN
  -- Try concurrent refresh first (faster, but requires unique index)
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY platform_statistics;
    RETURN;
  EXCEPTION
    WHEN OTHERS THEN
      -- If concurrent refresh fails, fall back to regular refresh
      -- This handles cases where the unique index doesn't exist yet
      RAISE NOTICE 'Concurrent refresh failed, using regular refresh: %', SQLERRM;
      REFRESH MATERIALIZED VIEW platform_statistics;
  END;
END;
$$ LANGUAGE plpgsql;

-- Ensure the unique index exists for future concurrent refreshes
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_statistics_singleton
ON platform_statistics ((1));

-- Perform a test refresh to verify it works
SELECT refresh_platform_statistics();

COMMENT ON FUNCTION refresh_platform_statistics() IS
'Refreshes platform_statistics materialized view. Tries concurrent refresh first, falls back to regular refresh if needed.';
