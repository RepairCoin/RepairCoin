-- Commitment Program Subscriptions Migration
-- Date: September 16, 2025
-- Purpose: Support $500/month commitment program for shops without RCG

-- Commitment Subscriptions table
CREATE TABLE IF NOT EXISTS commitment_subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    subscription_id VARCHAR(50) UNIQUE NOT NULL DEFAULT concat('COMMIT-', to_char(CURRENT_TIMESTAMP, 'YYYYMMDD-'), lpad(nextval('commitment_subscriptions_id_seq')::text, 6, '0')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, active, paused, cancelled, expired
    monthly_amount NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    billing_method VARCHAR(50) NOT NULL, -- credit_card, ach, wire
    billing_day INTEGER NOT NULL DEFAULT 1 CHECK (billing_day >= 1 AND billing_day <= 28),
    
    -- Payment tracking
    payments_made INTEGER DEFAULT 0,
    total_paid NUMERIC(12,2) DEFAULT 0,
    last_payment_date TIMESTAMP,
    next_payment_date TIMESTAMP,
    
    -- Subscription lifecycle
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    paused_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    expires_at TIMESTAMP, -- For fixed-term commitments
    
    -- Billing information
    billing_email VARCHAR(255),
    billing_contact VARCHAR(255),
    billing_phone VARCHAR(50),
    billing_address JSONB,
    
    -- Payment method details (encrypted in production)
    payment_details JSONB DEFAULT '{}',
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commitment Payment History
CREATE TABLE IF NOT EXISTS commitment_payments (
    id SERIAL PRIMARY KEY,
    subscription_id VARCHAR(50) NOT NULL REFERENCES commitment_subscriptions(subscription_id) ON DELETE CASCADE,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    payment_id VARCHAR(50) UNIQUE NOT NULL DEFAULT concat('PAY-', to_char(CURRENT_TIMESTAMP, 'YYYYMMDD-'), lpad(nextval('commitment_payments_id_seq')::text, 6, '0')),
    
    -- Payment details
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, refunded
    
    -- Transaction references
    external_payment_id VARCHAR(255), -- Stripe/payment processor ID
    transaction_reference VARCHAR(255),
    
    -- Dates
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    
    -- Failure tracking
    failure_reason TEXT,
    failure_code VARCHAR(100),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Retry Schedule
CREATE TABLE IF NOT EXISTS commitment_retry_schedule (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(50) NOT NULL REFERENCES commitment_payments(payment_id) ON DELETE CASCADE,
    retry_number INTEGER NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    attempted_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, attempted, succeeded, failed, cancelled
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commitment Benefits tracking (for audit)
CREATE TABLE IF NOT EXISTS commitment_benefits_log (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    subscription_id VARCHAR(50) NOT NULL REFERENCES commitment_subscriptions(subscription_id) ON DELETE CASCADE,
    benefit_type VARCHAR(100) NOT NULL, -- rcn_purchase, tier_bonus, support_priority
    benefit_value JSONB NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_commitment_subs_shop_id ON commitment_subscriptions(shop_id);
CREATE INDEX idx_commitment_subs_status ON commitment_subscriptions(status);
CREATE INDEX idx_commitment_subs_next_payment ON commitment_subscriptions(next_payment_date) WHERE status = 'active';

CREATE INDEX idx_commitment_payments_subscription ON commitment_payments(subscription_id);
CREATE INDEX idx_commitment_payments_shop_id ON commitment_payments(shop_id);
CREATE INDEX idx_commitment_payments_status ON commitment_payments(status);
CREATE INDEX idx_commitment_payments_due_date ON commitment_payments(due_date);
CREATE INDEX idx_commitment_payments_retry ON commitment_payments(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX idx_retry_schedule_payment ON commitment_retry_schedule(payment_id);
CREATE INDEX idx_retry_schedule_scheduled ON commitment_retry_schedule(scheduled_at) WHERE status = 'scheduled';

-- Update trigger for updated_at
CREATE TRIGGER update_commitment_subscriptions_updated_at 
    BEFORE UPDATE ON commitment_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commitment_payments_updated_at 
    BEFORE UPDATE ON commitment_payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update shop operational status when commitment is activated
CREATE OR REPLACE FUNCTION update_shop_status_on_commitment()
RETURNS TRIGGER AS $$
BEGIN
    -- When commitment becomes active, update shop status
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        UPDATE shops 
        SET operational_status = 'commitment_qualified',
            commitment_enrolled = TRUE
        WHERE shop_id = NEW.shop_id;
        
    -- When commitment is cancelled or expired, check if shop has RCG
    ELSIF NEW.status IN ('cancelled', 'expired', 'paused') AND OLD.status = 'active' THEN
        UPDATE shops 
        SET operational_status = CASE 
                WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
                ELSE 'not_qualified'
            END,
            commitment_enrolled = FALSE
        WHERE shop_id = NEW.shop_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shop_on_commitment_change
    AFTER INSERT OR UPDATE ON commitment_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_shop_status_on_commitment();

-- Function to calculate next payment date
CREATE OR REPLACE FUNCTION calculate_next_payment_date(billing_day INTEGER, from_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
DECLARE
    next_date DATE;
    temp_date DATE;
BEGIN
    -- Start with the current month
    temp_date := DATE_TRUNC('month', from_date) + (billing_day - 1) * INTERVAL '1 day';
    
    -- If the date has already passed this month, move to next month
    IF temp_date <= from_date THEN
        temp_date := DATE_TRUNC('month', from_date + INTERVAL '1 month') + (billing_day - 1) * INTERVAL '1 day';
    END IF;
    
    -- Handle months with fewer days than billing_day
    next_date := temp_date;
    WHILE EXTRACT(DAY FROM next_date) != billing_day AND EXTRACT(DAY FROM next_date) > 28 LOOP
        next_date := next_date - INTERVAL '1 day';
    END LOOP;
    
    RETURN next_date;
END;
$$ LANGUAGE plpgsql;

-- Commitment subscriptions system initialized successfully