-- Migration: 008_add_admins_table.sql
-- Author: Zeff
-- Date: 2025-09-04
-- Description: Create admins table for admin user management

-- Check if migration has already been applied
DO $$
DECLARE
    migration_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 8) INTO migration_exists;
    
    IF NOT migration_exists THEN
        
        -- Create admins table
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            wallet_address VARCHAR(42) NOT NULL UNIQUE,
            name VARCHAR(255),
            email VARCHAR(255),
            permissions JSONB DEFAULT '[]'::jsonb,
            is_active BOOLEAN DEFAULT true,
            is_super_admin BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by VARCHAR(42),
            last_login TIMESTAMP WITH TIME ZONE,
            metadata JSONB DEFAULT '{}'::jsonb
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_admins_wallet_address ON admins(LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);
        CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at DESC);

        -- Add check constraint for wallet address format
        ALTER TABLE admins ADD CONSTRAINT check_wallet_address_format 
            CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$');

        -- Create updated_at trigger function if not exists
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger
        CREATE TRIGGER update_admins_updated_at 
            BEFORE UPDATE ON admins 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        
        -- Record migration
        INSERT INTO schema_migrations (version, name) VALUES (8, 'add_admins_table');
        
    END IF;
END $$;