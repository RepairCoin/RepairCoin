-- Admin activity logs table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id SERIAL PRIMARY KEY,
    admin_address VARCHAR(42) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    action_description TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_admin_logs_admin ON admin_activity_logs(admin_address);
CREATE INDEX idx_admin_logs_action ON admin_activity_logs(action_type);
CREATE INDEX idx_admin_logs_created ON admin_activity_logs(created_at);
CREATE INDEX idx_admin_logs_entity ON admin_activity_logs(entity_type, entity_id);

-- Admin alerts table for automated monitoring
CREATE TABLE IF NOT EXISTS admin_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_unread ON admin_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_alerts_severity ON admin_alerts(severity);
CREATE INDEX idx_alerts_created ON admin_alerts(created_at);
EOF < /dev/null