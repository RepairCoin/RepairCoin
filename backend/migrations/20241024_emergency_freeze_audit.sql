-- Emergency Freeze Audit Trail Table
CREATE TABLE IF NOT EXISTS emergency_freeze_audit (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('freeze', 'unfreeze')),
    reason TEXT NOT NULL,
    admin_address VARCHAR(42) NOT NULL,
    admin_email VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Status Table for tracking freeze state
CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    component VARCHAR(50) NOT NULL UNIQUE CHECK (component IN ('token_minting', 'shop_purchases', 'customer_rewards', 'token_transfers')),
    is_frozen BOOLEAN DEFAULT FALSE,
    frozen_at TIMESTAMP WITH TIME ZONE,
    frozen_by VARCHAR(42),
    freeze_reason TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initialize system status components
INSERT INTO system_status (component, is_frozen) VALUES 
    ('token_minting', FALSE),
    ('shop_purchases', FALSE),
    ('customer_rewards', FALSE),
    ('token_transfers', FALSE)
ON CONFLICT (component) DO NOTHING;

-- Administrator Alerts Table
CREATE TABLE IF NOT EXISTS admin_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    triggered_by VARCHAR(42),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(42),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(42),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emergency_freeze_audit_timestamp ON emergency_freeze_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_emergency_freeze_audit_admin ON emergency_freeze_audit(admin_address);
CREATE INDEX IF NOT EXISTS idx_system_status_component ON system_status(component);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON admin_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_acknowledged ON admin_alerts(acknowledged);