-- Migration: Create admins table
-- Description: Create table for storing admin users with permissions and management capabilities
-- Date: 2025-01-04

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255),
    permissions JSONB DEFAULT '[]'::jsonb, -- Array of permission strings as JSONB
    is_active BOOLEAN DEFAULT true,
    is_super_admin BOOLEAN DEFAULT false,
    created_by VARCHAR(42), -- Wallet address of admin who created this admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb -- Additional metadata storage
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_wallet_address ON admins(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admins_is_super_admin ON admins(is_super_admin) WHERE is_super_admin = true;
CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at);

-- Add comments for documentation
COMMENT ON TABLE admins IS 'Table for storing admin users with their permissions and access levels';
COMMENT ON COLUMN admins.wallet_address IS 'Ethereum wallet address of the admin';
COMMENT ON COLUMN admins.name IS 'Display name of the admin';
COMMENT ON COLUMN admins.email IS 'Contact email address of the admin';
COMMENT ON COLUMN admins.permissions IS 'JSONB array of permission strings (e.g., ["manage_shops", "manage_customers", "manage_treasury"])';
COMMENT ON COLUMN admins.is_active IS 'Whether the admin account is active';
COMMENT ON COLUMN admins.is_super_admin IS 'Whether the admin has super admin privileges';
COMMENT ON COLUMN admins.created_by IS 'Wallet address of the admin who created this admin account';
COMMENT ON COLUMN admins.last_login IS 'Timestamp of the last successful login';

-- Insert default super admin from environment variable (optional - can be done manually)
-- This is commented out as it should be done programmatically with proper environment variable handling
-- INSERT INTO admins (wallet_address, name, is_active, is_super_admin, permissions)
-- SELECT 
--     LOWER('0x...'), -- Replace with actual admin address
--     'Super Admin',
--     true,
--     true,
--     ARRAY['*'] -- All permissions
-- WHERE NOT EXISTS (
--     SELECT 1 FROM admins WHERE is_super_admin = true
-- );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admins_updated_at_trigger
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_admins_updated_at();