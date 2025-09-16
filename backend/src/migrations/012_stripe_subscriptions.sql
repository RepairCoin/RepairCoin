-- Stripe Subscriptions System Migration
-- Date: September 16, 2025
-- Purpose: Complete Stripe subscription management with retry logic

-- Stripe Customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stripe Subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_price_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, past_due, canceled, unpaid, incomplete
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP,
    ended_at TIMESTAMP,
    trial_end TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Methods table
CREATE TABLE IF NOT EXISTS stripe_payment_methods (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'card', -- card, bank_account, etc.
    is_default BOOLEAN DEFAULT FALSE,
    card_brand VARCHAR(50), -- visa, mastercard, amex, etc.
    card_last4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    billing_address JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Attempts and Retry Logic table
CREATE TABLE IF NOT EXISTS stripe_payment_attempts (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) NOT NULL REFERENCES stripe_subscriptions(stripe_subscription_id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL, -- succeeded, failed, requires_action, processing
    failure_code VARCHAR(100),
    failure_message TEXT,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_retry_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Subscription Events Log (for audit trail)
CREATE TABLE IF NOT EXISTS stripe_subscription_events (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) REFERENCES stripe_subscriptions(stripe_subscription_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- subscription.created, invoice.payment_failed, etc.
    stripe_event_id VARCHAR(255) UNIQUE,
    data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Log table
CREATE TABLE IF NOT EXISTS subscription_notifications (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- payment_failed, payment_retry, subscription_canceled
    channel VARCHAR(50) NOT NULL, -- email, sms, in_app
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    sent_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_stripe_customers_shop_id ON stripe_customers(shop_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

CREATE INDEX idx_stripe_subscriptions_shop_id ON stripe_subscriptions(shop_id);
CREATE INDEX idx_stripe_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX idx_stripe_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX idx_stripe_subscriptions_period_end ON stripe_subscriptions(current_period_end);

CREATE INDEX idx_stripe_payment_methods_shop_id ON stripe_payment_methods(shop_id);
CREATE INDEX idx_stripe_payment_methods_customer_id ON stripe_payment_methods(stripe_customer_id);
CREATE INDEX idx_stripe_payment_methods_default ON stripe_payment_methods(is_default) WHERE is_default = TRUE;

CREATE INDEX idx_stripe_payment_attempts_shop_id ON stripe_payment_attempts(shop_id);
CREATE INDEX idx_stripe_payment_attempts_subscription_id ON stripe_payment_attempts(stripe_subscription_id);
CREATE INDEX idx_stripe_payment_attempts_status ON stripe_payment_attempts(status);
CREATE INDEX idx_stripe_payment_attempts_next_retry ON stripe_payment_attempts(next_retry_at) WHERE next_retry_at IS NOT NULL;

CREATE INDEX idx_stripe_events_shop_id ON stripe_subscription_events(shop_id);
CREATE INDEX idx_stripe_events_type ON stripe_subscription_events(event_type);
CREATE INDEX idx_stripe_events_processed ON stripe_subscription_events(processed) WHERE processed = FALSE;

CREATE INDEX idx_notifications_shop_id ON subscription_notifications(shop_id);
CREATE INDEX idx_notifications_status ON subscription_notifications(status);
CREATE INDEX idx_notifications_type ON subscription_notifications(type);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stripe_customers_updated_at BEFORE UPDATE ON stripe_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stripe_subscriptions_updated_at BEFORE UPDATE ON stripe_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stripe_payment_methods_updated_at BEFORE UPDATE ON stripe_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default payment method per customer
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- Set all other payment methods for this customer to not default
        UPDATE stripe_payment_methods 
        SET is_default = FALSE 
        WHERE stripe_customer_id = NEW.stripe_customer_id 
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER ensure_single_default_payment_method_trigger 
    BEFORE INSERT OR UPDATE ON stripe_payment_methods 
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_payment_method();

-- Function to update shop operational status based on subscription
CREATE OR REPLACE FUNCTION update_shop_operational_status_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Update shop operational status based on subscription status
    IF NEW.status = 'active' THEN
        UPDATE shops 
        SET operational_status = 'commitment_qualified',
            commitment_enrolled = TRUE
        WHERE shop_id = NEW.shop_id;
    ELSIF NEW.status IN ('past_due', 'unpaid', 'canceled') THEN
        -- Check if shop has RCG qualification, otherwise set to not_qualified
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
$$ language 'plpgsql';

CREATE TRIGGER update_shop_operational_status_on_subscription_trigger 
    AFTER INSERT OR UPDATE ON stripe_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_shop_operational_status_on_subscription();

-- Stripe subscriptions system initialized successfully
-- Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_MONTHLY_PRICE_ID in .env