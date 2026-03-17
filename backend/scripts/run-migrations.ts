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
    // Resolve migrations directory using multiple strategies:
    // 1. process.cwd()/migrations — works on production (cwd = /workspace/backend/) and local (cwd = backend/)
    // 2. __dirname/../migrations — works with ts-node (scripts/ → ../migrations)
    // 3. __dirname/../../migrations — works with compiled JS (dist/scripts/ → ../../migrations)
    const candidates = [
      path.join(process.cwd(), 'migrations'),
      path.resolve(__dirname, '..', 'migrations'),
      path.resolve(__dirname, '..', '..', 'migrations'),
      // DigitalOcean App Platform may use /workspace as root
      '/workspace/backend/migrations',
      '/workspace/migrations',
    ];

    console.log(`\n📂 Migration path resolution (DEBUG):`);
    console.log(`   __dirname:     ${__dirname}`);
    console.log(`   process.cwd(): ${process.cwd()}`);
    console.log(`   NODE_ENV:      ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   Platform:      ${process.platform}`);

    // Log every candidate path and whether it exists
    console.log(`   Candidates:`);
    for (const c of candidates) {
      const exists = fs.existsSync(c);
      console.log(`     ${exists ? '✅' : '❌'} ${c}`);
      if (exists) {
        try {
          const files = fs.readdirSync(c).filter(f => f.endsWith('.sql'));
          console.log(`        → ${files.length} SQL files`);
        } catch (e: any) {
          console.log(`        → readdir error: ${e.message}`);
        }
      }
    }

    // Also list what's in cwd and parent to understand container layout
    try {
      const cwdContents = fs.readdirSync(process.cwd());
      console.log(`   process.cwd() contents: ${cwdContents.slice(0, 20).join(', ')}`);
    } catch (e: any) {
      console.log(`   process.cwd() readdir error: ${e.message}`);
    }
    try {
      const parentContents = fs.readdirSync(path.resolve(process.cwd(), '..'));
      console.log(`   parent dir contents:    ${parentContents.slice(0, 20).join(', ')}`);
    } catch (e: any) {
      console.log(`   parent dir readdir error: ${e.message}`);
    }

    const resolved = candidates.find(c => fs.existsSync(c));
    this.migrationsDir = resolved || candidates[0];

    console.log(`   ✨ Using: ${this.migrationsDir} (exists: ${fs.existsSync(this.migrationsDir)})`);
    if (fs.existsSync(this.migrationsDir)) {
      const files = fs.readdirSync(this.migrationsDir).filter(f => f.endsWith('.sql'));
      console.log(`   SQL files: ${files.length}\n`);
    } else {
      console.log(`   ⚠️ NO MIGRATIONS DIRECTORY FOUND — migrations will be skipped\n`);
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

      // Run each pending migration — continue on error so one failure doesn't block the rest
      let successCount = 0;
      let failCount = 0;
      for (const file of pendingMigrations) {
        try {
          await this.runMigration(file);
          successCount++;
        } catch (error: any) {
          failCount++;
          console.error(`   ⚠️ Skipping ${file} due to error: ${error.message}`);
          // Continue with next migration instead of stopping
        }
      }

      if (failCount > 0) {
        console.log(`\n⚠️ Migrations completed with ${failCount} failure(s), ${successCount} succeeded\n`);
      } else {
        console.log(`\n✅ All ${successCount} migrations completed successfully!\n`);
      }
      await this.showMigrationStatus();

    } catch (error) {
      console.error('\n⚠️ Migration error (non-fatal, app will continue):', error);
      // Don't exit - let the app start even if migrations fail
    } finally {
      await this.pool.end();
    }
  }

  private async cleanStaleRecords(): Promise<void> {
    // DISABLED: The stale record cleanup was deleting migration records 69-87 on every deploy,
    // forcing them to re-run. This caused migration 072 to fail repeatedly because
    // CREATE TABLE with REFERENCES shops(shop_id) requires a unique constraint that
    // may not be detected correctly. The ensureCriticalSchema safety net in app.ts
    // handles missing schema objects directly.
    //
    // Individual stale records should only be cleaned manually when needed.
    console.log('ℹ️  Stale record cleanup disabled — using ensureCriticalSchema safety net');
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
