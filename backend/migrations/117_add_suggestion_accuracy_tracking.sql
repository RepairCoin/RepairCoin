-- Migration 117: Add Suggestion Accuracy Tracking
-- Created: 2026-05-26
-- Purpose: Track PO suggestion outcomes to improve future recommendations

-- Add accuracy tracking fields to purchase_order_suggestions
ALTER TABLE purchase_order_suggestions
  ADD COLUMN was_accurate BOOLEAN,
  ADD COLUMN actual_need_assessment_date TIMESTAMP,
  ADD COLUMN actual_need_assessment_notes TEXT,
  ADD COLUMN suggestion_accuracy_score INTEGER CHECK (suggestion_accuracy_score BETWEEN 0 AND 100);

COMMENT ON COLUMN purchase_order_suggestions.was_accurate IS 'Whether the suggestion correctly identified a need (true), was unnecessary (false), or unknown (null)';
COMMENT ON COLUMN purchase_order_suggestions.actual_need_assessment_date IS 'Date when accuracy was assessed (usually after PO received or suggestion expired)';
COMMENT ON COLUMN purchase_order_suggestions.actual_need_assessment_notes IS 'Notes explaining the accuracy assessment';
COMMENT ON COLUMN purchase_order_suggestions.suggestion_accuracy_score IS 'Calculated accuracy score: 100=perfect, 80=good, 50=mediocre, 0=poor';

-- Create suggestion accuracy metrics table for aggregate tracking
CREATE TABLE IF NOT EXISTS suggestion_accuracy_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_suggestions INTEGER DEFAULT 0,
  approved_suggestions INTEGER DEFAULT 0,
  rejected_suggestions INTEGER DEFAULT 0,
  expired_suggestions INTEGER DEFAULT 0,
  suggestions_with_po INTEGER DEFAULT 0,
  accurate_suggestions INTEGER DEFAULT 0,
  inaccurate_suggestions INTEGER DEFAULT 0,
  pending_assessment INTEGER DEFAULT 0,
  average_accuracy_score NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shop_id, period_start, period_end)
);

COMMENT ON TABLE suggestion_accuracy_metrics IS 'Weekly/monthly aggregate metrics for PO suggestion accuracy';

CREATE INDEX idx_suggestion_accuracy_metrics_shop ON suggestion_accuracy_metrics(shop_id);
CREATE INDEX idx_suggestion_accuracy_metrics_period ON suggestion_accuracy_metrics(period_start, period_end);

-- Add migration tracking
INSERT INTO migration_history (migration_number, migration_name, executed_at)
VALUES (117, '117_add_suggestion_accuracy_tracking.sql', CURRENT_TIMESTAMP);
