import { Router } from 'express';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const router = Router();

// One-time setup endpoint - REMOVE THIS AFTER USE
router.post('/init-database/:secret', async (req, res) => {
    // Simple security check
    if (req.params.secret !== 'temp-setup-2024') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // First, let's check what tables already exist
        const existingTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const existing = existingTables.rows.map(r => r.table_name);
        
        // Create tables one by one
        const tables = [];
        
        // Customers table
        if (!existing.includes('customers')) {
            await pool.query(`
                CREATE TABLE customers (
                    address VARCHAR(42) PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(20),
                    wallet_address VARCHAR(42) NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    lifetime_earnings NUMERIC(20, 8) DEFAULT 0,
                    tier VARCHAR(20) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD')),
                    daily_earnings NUMERIC(20, 8) DEFAULT 0,
                    monthly_earnings NUMERIC(20, 8) DEFAULT 0,
                    last_earned_date DATE DEFAULT CURRENT_DATE,
                    referral_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            tables.push('customers');
        }

        // Shops table
        if (!existing.includes('shops')) {
            await pool.query(`
                CREATE TABLE shops (
                    shop_id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    address TEXT NOT NULL,
                    phone VARCHAR(20),
                    email VARCHAR(255),
                    wallet_address VARCHAR(42) NOT NULL,
                    reimbursement_address VARCHAR(42),
                    verified BOOLEAN DEFAULT false,
                    active BOOLEAN DEFAULT true,
                    cross_shop_enabled BOOLEAN DEFAULT false,
                    total_tokens_issued NUMERIC(20, 8) DEFAULT 0,
                    total_redemptions NUMERIC(20, 8) DEFAULT 0,
                    total_reimbursements NUMERIC(20, 8) DEFAULT 0,
                    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fixflow_shop_id VARCHAR(100),
                    location_lat NUMERIC(10, 8),
                    location_lng NUMERIC(11, 8),
                    location_city VARCHAR(100),
                    location_state VARCHAR(100),
                    location_zip_code VARCHAR(20),
                    purchased_rcn_balance NUMERIC(20, 8) DEFAULT 0,
                    total_rcn_purchased NUMERIC(20, 8) DEFAULT 0,
                    last_purchase_date TIMESTAMP,
                    minimum_balance_alert NUMERIC(20, 8) DEFAULT 50,
                    auto_purchase_enabled BOOLEAN DEFAULT false,
                    auto_purchase_amount NUMERIC(20, 8) DEFAULT 100,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            tables.push('shops');
        }

        // Transactions table
        if (!existing.includes('transactions')) {
            await pool.query(`
                CREATE TABLE transactions (
                    id VARCHAR(100) PRIMARY KEY,
                    type VARCHAR(20) NOT NULL CHECK (type IN ('mint', 'redeem', 'transfer', 'tier_bonus', 'shop_purchase')),
                    customer_address VARCHAR(42) NOT NULL,
                    shop_id VARCHAR(100) NOT NULL,
                    amount NUMERIC(20, 8) NOT NULL,
                    reason TEXT,
                    transaction_hash VARCHAR(66) NOT NULL,
                    block_number BIGINT,
                    timestamp TIMESTAMP NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
                    metadata JSONB DEFAULT '{}',
                    token_source VARCHAR(20) DEFAULT 'earned' CHECK (token_source IN ('earned', 'purchased', 'tier_bonus')),
                    is_cross_shop BOOLEAN DEFAULT false,
                    redemption_shop_id VARCHAR(100),
                    tier_bonus_amount NUMERIC(20, 8) DEFAULT 0,
                    base_amount NUMERIC(20, 8),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    confirmed_at TIMESTAMP,
                    FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE,
                    FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
                )
            `);
            tables.push('transactions');
        }

        // Webhook logs table
        if (!existing.includes('webhook_logs')) {
            await pool.query(`
                CREATE TABLE webhook_logs (
                    id VARCHAR(100) PRIMARY KEY,
                    source VARCHAR(20) NOT NULL CHECK (source IN ('fixflow', 'admin', 'customer')),
                    event VARCHAR(100) NOT NULL,
                    payload JSONB NOT NULL,
                    processed BOOLEAN DEFAULT false,
                    processing_time INTEGER,
                    result JSONB DEFAULT '{}',
                    timestamp TIMESTAMP NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP
                )
            `);
            tables.push('webhook_logs');
        }

        // Admin treasury table
        if (!existing.includes('admin_treasury')) {
            await pool.query(`
                CREATE TABLE admin_treasury (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    total_supply NUMERIC(20, 8) DEFAULT 1000000000,
                    available_supply NUMERIC(20, 8) DEFAULT 1000000000,
                    total_sold NUMERIC(20, 8) DEFAULT 0,
                    total_revenue NUMERIC(20, 8) DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CHECK (id = 1)
                )
            `);
            
            await pool.query(`
                INSERT INTO admin_treasury (id, total_supply, available_supply, total_sold, total_revenue)
                VALUES (1, 0, 0, 0, 0)
                ON CONFLICT (id) DO NOTHING
            `);
            tables.push('admin_treasury');
        }

        // Referrals table
        if (!existing.includes('referrals')) {
            await pool.query(`
                CREATE TABLE referrals (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    referral_code VARCHAR(20) UNIQUE NOT NULL,
                    referrer_address VARCHAR(42) NOT NULL REFERENCES customers(address),
                    referee_address VARCHAR(42) REFERENCES customers(address),
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
                    reward_transaction_id VARCHAR(100),
                    metadata JSONB DEFAULT '{}'
                )
            `);
            tables.push('referrals');
        }

        // Redemption sessions table
        if (!existing.includes('redemption_sessions')) {
            await pool.query(`
                CREATE TABLE redemption_sessions (
                    session_id VARCHAR(255) PRIMARY KEY,
                    customer_address VARCHAR(42) NOT NULL,
                    shop_id VARCHAR(100) NOT NULL,
                    max_amount DECIMAL(20, 2) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    approved_at TIMESTAMP WITH TIME ZONE,
                    used_at TIMESTAMP WITH TIME ZONE,
                    qr_code TEXT,
                    signature TEXT,
                    metadata JSONB DEFAULT '{}'
                )
            `);
            tables.push('redemption_sessions');
        }

        // Get final list of tables
        const finalTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        res.json({
            success: true,
            message: 'Database initialization completed',
            tablesCreated: tables,
            allTables: finalTables.rows.map(r => r.table_name),
            existingBefore: existing
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            detail: error.detail
        });
    } finally {
        await pool.end();
    }
});

export default router;