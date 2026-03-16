/**
 * Database Migration Runner
 *
 * Automatically runs pending SQL migrations against the database.
 * Cross-platform compatible (Windows/Linux/Mac).
 *
 * Usage:
 *   npx ts-node scripts/run-migrations.ts
 *   npm run db:migrate
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationRecord {
  version: number;
  name: string;
  applied_at: Date;
}

class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;

  constructor() {
    // When running compiled JS from dist/scripts/, we need to go up to the project root
    // __dirname with ts-node: scripts/ → ../migrations works
    // __dirname compiled:     dist/scripts/ → ../../migrations needed
    const projectRoot = path.resolve(__dirname, '..');
    const candidate = path.join(projectRoot, 'migrations');
    if (fs.existsSync(candidate)) {
      this.migrationsDir = candidate;
    } else {
      this.migrationsDir = path.resolve(__dirname, '..', '..', 'migrations');
    }

    // Build connection config
    const host = process.env.DB_HOST || 'localhost';
    const sslEnabled = process.env.DB_SSL === 'true' || host.includes('digitalocean');

    const config: any = {
      host,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'repaircoin',
      user: process.env.DB_USER || 'repaircoin',
      password: process.env.DB_PASSWORD || 'repaircoin123',
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    };

    // Use DATABASE_URL if provided
    if (process.env.DATABASE_URL) {
      config.connectionString = process.env.DATABASE_URL;
      if (process.env.DATABASE_URL.includes('sslmode=require')) {
        config.ssl = { rejectUnauthorized: false };
      }
    }

    console.log(`\n🔌 Connecting to database: ${config.host}:${config.port}/${config.database}`);
    console.log(`   SSL: ${sslEnabled ? 'enabled' : 'disabled'}\n`);

    this.pool = new Pool(config);
  }

  async run(): Promise<void> {
    try {
      // Test connection
      await this.pool.query('SELECT 1');
      console.log('✅ Database connection successful\n');

      // Ensure schema_migrations table exists
      await this.ensureMigrationsTable();

      // Verify recorded migrations actually applied by checking key tables/columns
      // If a migration is recorded but its schema changes are missing, remove the stale record
      await this.cleanStaleRecords();

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      console.log(`📊 Found ${appliedMigrations.length} applied migrations\n`);

      // Get all migration files
      const migrationFiles = this.getMigrationFiles();
      console.log(`📁 Found ${migrationFiles.length} migration files\n`);

      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(file => {
        const version = this.extractVersion(file);
        return version !== null && !appliedMigrations.some(m => m.version === version);
      });

      if (pendingMigrations.length === 0) {
        console.log('✅ All migrations are up to date!\n');
        await this.showMigrationStatus();
        return;
      }

      console.log(`🔄 Running ${pendingMigrations.length} pending migration(s):\n`);

      // Run each pending migration
      for (const file of pendingMigrations) {
        await this.runMigration(file);
      }

      console.log('\n✅ All migrations completed successfully!\n');
      await this.showMigrationStatus();

    } catch (error) {
      console.error('\n⚠️ Migration error (non-fatal, app will continue):', error);
      // Don't exit - let the app start even if migrations fail
    } finally {
      await this.pool.end();
    }
  }

  private async cleanStaleRecords(): Promise<void> {
    // Check if key tables/columns from migrations 069-086 actually exist
    // If a migration is recorded but its changes are missing, delete the record
    const checks: { version: number; query: string; description: string }[] = [
      { version: 69, query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'general_notification_preferences' LIMIT 1", description: 'general_notification_preferences table' },
      { version: 72, query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_quick_replies' LIMIT 1", description: 'shop_quick_replies table' },
      { version: 73, query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'auto_messages' LIMIT 1", description: 'auto_messages table' },
      { version: 76, query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'device_push_tokens' LIMIT 1", description: 'device_push_tokens table' },
      { version: 79, query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' LIMIT 1", description: 'conversations table' },
      { version: 82, query: "SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_email_preferences' LIMIT 1", description: 'shop_email_preferences table' },
      { version: 85, query: "SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist' AND column_name = 'inquiry_type' LIMIT 1", description: 'waitlist.inquiry_type column' },
    ];

    let staleCount = 0;
    for (const check of checks) {
      // Is this migration recorded as applied?
      const recorded = await this.pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [check.version]);
      if (recorded.rows.length === 0) continue;

      // Does the expected schema change actually exist?
      const result = await this.pool.query(check.query);
      if (result.rows.length === 0) {
        console.log(`⚠️  Migration ${check.version} recorded but ${check.description} is missing — will re-run`);
        await this.pool.query('DELETE FROM schema_migrations WHERE version = $1', [check.version]);
        staleCount++;
      }
    }

    if (staleCount > 0) {
      // Clear all migrations 69-87 so they re-run in order (all use IF NOT EXISTS, safe to re-run)
      await this.pool.query('DELETE FROM schema_migrations WHERE version BETWEEN 69 AND 87');
      console.log(`🔧 Cleared stale migration records (69-87) — will re-apply all\n`);
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await this.pool.query(query);
  }

  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.pool.query(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    );
    return result.rows;
  }

  private getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(`⚠️  Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => {
        const versionA = this.extractVersion(a) || 0;
        const versionB = this.extractVersion(b) || 0;
        return versionA - versionB;
      });

    return files;
  }

  private extractVersion(filename: string): number | null {
    // Match patterns like "001_name.sql", "029_create_table.sql"
    const match = filename.match(/^(\d+)_/);
    return match ? parseInt(match[1], 10) : null;
  }

  private extractName(filename: string): string {
    // Remove version prefix and .sql extension
    return filename.replace(/^\d+_/, '').replace(/\.sql$/, '');
  }

  private async runMigration(filename: string): Promise<void> {
    const version = this.extractVersion(filename);
    const name = this.extractName(filename);
    const filePath = path.join(this.migrationsDir, filename);

    console.log(`   📄 Running: ${filename}`);

    try {
      const sql = fs.readFileSync(filePath, 'utf8');

      // Run migration in a transaction
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);

        // Record migration (only if not already recorded by the migration itself)
        const checkQuery = 'SELECT 1 FROM schema_migrations WHERE version = $1';
        const checkResult = await client.query(checkQuery, [version]);

        if (checkResult.rows.length === 0) {
          await client.query(
            'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
            [version, name]
          );
        }

        await client.query('COMMIT');
        console.log(`   ✅ Applied: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error(`   ❌ Failed: ${filename}`);
      console.error(`      Error: ${error.message}`);
      throw error;
    }
  }

  private async showMigrationStatus(): Promise<void> {
    console.log('📊 Migration Status:');
    console.log('─'.repeat(60));

    const migrations = await this.getAppliedMigrations();

    if (migrations.length === 0) {
      console.log('   No migrations applied yet.');
    } else {
      for (const m of migrations) {
        const date = new Date(m.applied_at).toISOString().split('T')[0];
        console.log(`   ${String(m.version).padStart(3, '0')} │ ${m.name.padEnd(40)} │ ${date}`);
      }
    }

    console.log('─'.repeat(60));
    console.log(`   Total: ${migrations.length} migrations\n`);
  }
}

// Run migrations
const runner = new MigrationRunner();
runner.run().catch(console.error);
