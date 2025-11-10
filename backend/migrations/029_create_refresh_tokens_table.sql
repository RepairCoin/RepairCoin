-- Migration: 029_create_refresh_tokens_table.sql
-- Author: work2
-- Date: 2025-11-10
-- Description: create refresh tokens table

-- Check if migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 29) THEN
        
        -- ================================================
        -- Create refresh_tokens table for access/refresh token pattern
        -- ================================================

        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            token_id VARCHAR(255) UNIQUE NOT NULL,
            user_address VARCHAR(42) NOT NULL,
            user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('admin', 'shop', 'customer')),
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            revoked BOOLEAN DEFAULT FALSE,
            revoked_at TIMESTAMP WITH TIME ZONE,
            revoked_reason TEXT,
            user_agent TEXT,
            ip_address VARCHAR(45)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_address ON refresh_tokens(user_address);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked) WHERE NOT revoked;
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_shop_id ON refresh_tokens(shop_id) WHERE shop_id IS NOT NULL;

        -- Add comments
        COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for JWT authentication with access/refresh token pattern';
        COMMENT ON COLUMN refresh_tokens.id IS 'Primary key UUID';
        COMMENT ON COLUMN refresh_tokens.token_id IS 'Unique identifier embedded in refresh token JWT for revocation';
        COMMENT ON COLUMN refresh_tokens.user_address IS 'Wallet address of the token owner';
        COMMENT ON COLUMN refresh_tokens.user_role IS 'User role: admin, shop, or customer';
        COMMENT ON COLUMN refresh_tokens.shop_id IS 'Shop ID for shop users (NULL for admin/customer)';
        COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hash of the refresh token for validation';
        COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp (typically 7 days from creation)';
        COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Last time this refresh token was used to get new access token';
        COMMENT ON COLUMN refresh_tokens.revoked IS 'Whether token has been revoked (logout, security event)';
        COMMENT ON COLUMN refresh_tokens.revoked_at IS 'When token was revoked';
        COMMENT ON COLUMN refresh_tokens.revoked_reason IS 'Reason for revocation (e.g., logout, suspicious activity)';
        COMMENT ON COLUMN refresh_tokens.user_agent IS 'Browser/device user agent string for security tracking';
        COMMENT ON COLUMN refresh_tokens.ip_address IS 'IP address of token creation for security tracking';
        
        
        -- ================================================
        -- RECORD MIGRATION
        -- ================================================
        INSERT INTO schema_migrations (version, name) VALUES (29, 'create_refresh_tokens_table');
        
        RAISE NOTICE 'Migration 29 (create_refresh_tokens_table) applied successfully';
        
    ELSE
        RAISE NOTICE 'Migration 29 (create_refresh_tokens_table) already applied';
    END IF;
END $$;

-- ================================================
-- ROLLBACK SCRIPT (Optional - for manual use only)
-- ================================================
-- To rollback this migration, run:
-- BEGIN;
-- DROP TABLE IF EXISTS refresh_tokens CASCADE;
-- DELETE FROM schema_migrations WHERE version = 29;
-- COMMIT;
