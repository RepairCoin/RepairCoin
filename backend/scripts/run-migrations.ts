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

// Known historical number-reuses on the shared staging/prod DB, where a version is
// recorded under a name that no longer matches the repo file at that number. These are
// benign (the underlying schema was verified present) so the collision gate ignores
// them. Do NOT add here to silence a NEW collision — renumber the file instead
// (npm run db:create-migration picks a free number). Key = version, value = DB name.
const KNOWN_DRIFT: Record<number, string> = {
  0: 'create_migration_tracking',   // staging recorded v0 before 000_base_schema existed
  53: 'add_shop_profile_enhancements',
  54: 'add_booking_approval_and_reschedule',
  118: 'create_inventory_v2_enhancements',
  // 206-209: staging recorded these with the full "NNN_" filename prefix instead of the
  // bare descriptive name extractName() derives. Same already-applied migrations (columns
  // verified present on staging), just a name-format mismatch — benign.
  206: '206_add_campaign_ai_outreach_mode',
  207: '207_add_lead_ai_paused',
  208: '208_add_lead_escalated_at',
  209: '209_add_service_import_fields',
};

// Legacy duplicate-numbered migration files (kept in sync with
// scripts/check-migration-numbers.js). On staging the shared number is recorded under
// ONE of each group's names, so the OTHER file(s) won't match — that's expected, not a
// new collision. The gate exempts these files. New collisions are NOT added here.
const GRANDFATHERED_DUP_FILES = new Set<string>([
  '095_add_category_check_constraint.sql',
  '095_create_calendar_integration.sql',
  '117_add_human_reply_baseline_to_ai_shop_settings.sql',
  '117_create_inventory_v2_enhancements.sql',
  '132_add_suspension_columns.sql',
  '132_create_ai_orchestrate_messages.sql',
  '132_fix_purchase_order_number_uniqueness.sql',
]);

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

      // Gate: refuse to run if any file's number is already claimed in the DB by a
      // DIFFERENT migration. On a shared dev/staging DB this is how two devs collide —
      // whoever runs second would otherwise have their migration silently skipped and
      // its change lost. Abort before applying anything (no partial state).
      this.assertNoNumberCollisions(appliedMigrations, migrationFiles);

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
      let baselineSkipCount = 0;
      for (const file of pendingMigrations) {
        const version = this.extractVersion(file);
        // The pending set is computed up-front. A migration run earlier in THIS pass —
        // notably the 000 baseline, which seeds schema_migrations for every version it
        // represents — may have recorded this version since then. Re-check and skip
        // instead of re-applying work the baseline already covers (which would fail on
        // non-idempotent statements like CREATE INDEX / ADD CONSTRAINT).
        if (version !== null && (await this.isApplied(version))) {
          baselineSkipCount++;
          continue;
        }
        try {
          await this.runMigration(file);
          successCount++;
        } catch (error: any) {
          failCount++;
          console.error(`   ⚠️ Skipping ${file} due to error: ${error.message}`);
          // Continue with next migration instead of stopping
        }
      }

      if (baselineSkipCount > 0) {
        console.log(`\nℹ️  ${baselineSkipCount} migration(s) skipped — already represented by the 000 baseline`);
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

  private async isApplied(version: number): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version]
    );
    return result.rows.length > 0;
  }

  private assertNoNumberCollisions(applied: MigrationRecord[], files: string[]): void {
    // Map applied version -> recorded name (only real names; the 000 baseline seeds many
    // rows as 'baselined_via_000', which legitimately won't match file names).
    const appliedName = new Map<number, string>();
    for (const m of applied) {
      if (m.name !== 'baselined_via_000') appliedName.set(m.version, m.name);
    }

    const collisions: Array<{ version: number; file: string; dbName: string }> = [];
    for (const file of files) {
      const version = this.extractVersion(file);
      if (version === null) continue;
      const dbName = appliedName.get(version);
      if (dbName === undefined) continue;                  // not applied (or baseline) → fine
      if (dbName === this.extractName(file)) continue;     // same migration, already applied → fine
      if (KNOWN_DRIFT[version] === dbName) continue;        // known historical drift → fine
      if (GRANDFATHERED_DUP_FILES.has(file)) continue;     // known legacy duplicate → fine
      collisions.push({ version, file, dbName });
    }

    if (collisions.length === 0) return;

    console.error('\n🛑 Migration number collision detected — refusing to run.\n');
    console.error('   These files share a number with a DIFFERENT migration already applied');
    console.error('   to this database. Running would silently skip the file and lose its change.\n');
    for (const c of collisions.sort((a, b) => a.version - b.version)) {
      console.error(`   [${String(c.version).padStart(3, '0')}] file "${c.file}" vs DB "${c.dbName}"`);
    }
    console.error('\n   Fix: renumber your file to a free number, then migrate again.');
    console.error('   Tip: `npm run db:create-migration <name>` picks a DB-aware free number.\n');

    if (process.env.MIGRATE_ALLOW_COLLISIONS === 'true') {
      console.error('   ⚠️  MIGRATE_ALLOW_COLLISIONS=true set — continuing despite collisions.\n');
      return;
    }
    // Hard stop. Exit non-zero directly (not via throw) so this is NOT swallowed by
    // run()'s "non-fatal, app continues" catch — a number collision is a repo error
    // that must block migrate/CI/deploy, unlike a normal migration failure.
    process.exit(1);
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
