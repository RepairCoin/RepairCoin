-- Create redemption_sessions table
CREATE TABLE IF NOT EXISTS redemption_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    customer_address VARCHAR(42) NOT NULL,
    shop_id VARCHAR(100) NOT NULL,
    max_amount DECIMAL(20, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, expired, used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    qr_code TEXT,
    signature TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX idx_redemption_sessions_customer ON redemption_sessions(customer_address);
CREATE INDEX idx_redemption_sessions_shop ON redemption_sessions(shop_id);
CREATE INDEX idx_redemption_sessions_status ON redemption_sessions(status);
CREATE INDEX idx_redemption_sessions_expires ON redemption_sessions(expires_at);

-- Create index for finding active sessions
CREATE INDEX idx_redemption_sessions_active 
    ON redemption_sessions(customer_address, status) 
    WHERE status IN ('pending', 'approved');

-- Add comment
COMMENT ON TABLE redemption_sessions IS 'Tracks redemption approval sessions between shops and customers';