-- Migration: Create import_jobs table for tracking service/customer import operations
-- Created: 2026-04-29
-- Purpose: Track import job status, validation results, and provide job history

CREATE TABLE IF NOT EXISTS import_jobs (
  job_id VARCHAR(100) PRIMARY KEY,
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('service', 'customer')),
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('add', 'merge', 'replace')),
  dry_run BOOLEAN DEFAULT false,

  -- File information
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(50) NOT NULL,

  -- Processing statistics
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  invalid_rows INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  deleted_count INTEGER DEFAULT 0,

  -- Validation results (JSONB for flexibility)
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Progress tracking
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  uploaded_by VARCHAR(42) NOT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time NUMERIC(10, 2), -- seconds

  -- Auto-cleanup (jobs expire after 24 hours)
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),

  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_shop_id ON import_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_expires_at ON import_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_entity_type ON import_jobs(entity_type);

-- Comments for documentation
COMMENT ON TABLE import_jobs IS 'Tracks import job status for services and customers';
COMMENT ON COLUMN import_jobs.job_id IS 'Unique job identifier in format: import_YYYYMMDD_HHMMSS_randomId';
COMMENT ON COLUMN import_jobs.entity_type IS 'Type of entity being imported: service or customer';
COMMENT ON COLUMN import_jobs.status IS 'Current job status: processing, completed, or failed';
COMMENT ON COLUMN import_jobs.mode IS 'Import mode: add (new only), merge (update existing + new), replace (delete all + import)';
COMMENT ON COLUMN import_jobs.dry_run IS 'If true, validation only without database modifications';
COMMENT ON COLUMN import_jobs.errors IS 'Array of validation errors with row, column, message, severity';
COMMENT ON COLUMN import_jobs.warnings IS 'Array of validation warnings (non-blocking issues)';
COMMENT ON COLUMN import_jobs.metadata IS 'Additional context like file format, options, user info';
COMMENT ON COLUMN import_jobs.expires_at IS 'Job data will be deleted after this timestamp (24 hours by default)';
