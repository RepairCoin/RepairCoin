-- Add suspension fields to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Add suspension fields to shops table
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verified_by VARCHAR(42);

-- Add unsuspend request table
CREATE TABLE IF NOT EXISTS unsuspend_requests (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('customer', 'shop')),
    entity_id VARCHAR(100) NOT NULL,
    request_reason TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(42),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_suspended_at ON customers(suspended_at);
CREATE INDEX IF NOT EXISTS idx_shops_suspended_at ON shops(suspended_at);
CREATE INDEX IF NOT EXISTS idx_unsuspend_requests_status ON unsuspend_requests(status);
CREATE INDEX IF NOT EXISTS idx_unsuspend_requests_entity ON unsuspend_requests(entity_type, entity_id);