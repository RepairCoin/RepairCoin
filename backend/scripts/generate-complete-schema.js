#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'repaircoin',
  password: 'repaircoin123',
  database: 'repaircoin'
};

async function generateCompleteSchema() {
  const client = new Client(dbConfig);
  const timestamp = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '..', 'migrations', 'generated');
  const outputFile = path.join(outputDir, `complete-schema-${timestamp}.sql`);
  
  try {
    await client.connect();
    console.log('✅ Connected to local database\n');
    
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    let schemaSQL = `-- Complete RepairCoin Database Schema
-- Generated from local database on ${new Date().toISOString()}
-- This represents the current state of all tables, indexes, and constraints

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

    // 1. Get all sequences
    console.log('📋 Extracting sequences...');
    const sequences = await client.query(`
      SELECT 
        sequence_name,
        data_type,
        start_value,
        minimum_value,
        maximum_value,
        increment,
        cycle_option
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `);
    
    if (sequences.rows.length > 0) {
      schemaSQL += '-- Sequences\n';
      for (const seq of sequences.rows) {
        schemaSQL += `CREATE SEQUENCE IF NOT EXISTS ${seq.sequence_name}
  START WITH ${seq.start_value}
  INCREMENT BY ${seq.increment}
  ${seq.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE'};\n\n`;
      }
    }

    // 2. Get all tables with columns
    console.log('📋 Extracting tables and columns...');
    const tables = await client.query(`
      SELECT 
        t.table_name,
        array_agg(
          json_build_object(
            'column_name', c.column_name,
            'ordinal_position', c.ordinal_position,
            'column_default', c.column_default,
            'is_nullable', c.is_nullable,
            'data_type', c.data_type,
            'character_maximum_length', c.character_maximum_length,
            'numeric_precision', c.numeric_precision,
            'numeric_scale', c.numeric_scale,
            'udt_name', c.udt_name
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `);

    schemaSQL += '-- Tables\n';
    
    for (const table of tables.rows) {
      console.log(`   Processing table: ${table.table_name}`);
      schemaSQL += `\n-- Table: ${table.table_name}\n`;
      schemaSQL += `CREATE TABLE IF NOT EXISTS ${table.table_name} (\n`;
      
      const columnDefs = [];
      for (const col of table.columns) {
        let colDef = `  ${col.column_name} `;
        
        // Handle data types
        if (col.data_type === 'character varying') {
          colDef += `VARCHAR${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`;
        } else if (col.data_type === 'numeric') {
          colDef += `NUMERIC${col.numeric_precision ? `(${col.numeric_precision}${col.numeric_scale ? `,${col.numeric_scale}` : ''})` : ''}`;
        } else if (col.data_type === 'ARRAY') {
          colDef += `TEXT[]`; // Simplified array handling
        } else {
          colDef += col.udt_name.toUpperCase();
        }
        
        // Handle defaults
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        
        // Handle nullable
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        columnDefs.push(colDef);
      }
      
      schemaSQL += columnDefs.join(',\n') + '\n);\n';
    }

    // 3. Get all constraints (primary keys, foreign keys, unique, check)
    console.log('📋 Extracting constraints...');
    const constraints = await client.query(`
      WITH constraint_columns AS (
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
        GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
      ),
      foreign_columns AS (
        SELECT 
          rc.constraint_name,
          ccu.table_name as foreign_table_name,
          string_agg(ccu.column_name, ',') as foreign_columns
        FROM information_schema.referential_constraints rc
        JOIN information_schema.constraint_column_usage ccu 
          ON rc.unique_constraint_name = ccu.constraint_name
        WHERE rc.constraint_schema = 'public'
        GROUP BY rc.constraint_name, ccu.table_name
      )
      SELECT 
        cc.table_name,
        cc.constraint_name,
        cc.constraint_type,
        cc.columns,
        rc.match_option,
        rc.update_rule,
        rc.delete_rule,
        fc.foreign_table_name,
        fc.foreign_columns,
        chk.check_clause
      FROM constraint_columns cc
      LEFT JOIN information_schema.referential_constraints rc 
        ON cc.constraint_name = rc.constraint_name AND rc.constraint_schema = 'public'
      LEFT JOIN foreign_columns fc 
        ON cc.constraint_name = fc.constraint_name
      LEFT JOIN information_schema.check_constraints chk
        ON cc.constraint_name = chk.constraint_name AND chk.constraint_schema = 'public'
      WHERE cc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
      ORDER BY cc.table_name, cc.constraint_type, cc.constraint_name;
    `);

    schemaSQL += '\n-- Constraints\n';
    const constraintsByTable = {};
    
    for (const con of constraints.rows) {
      if (!constraintsByTable[con.table_name]) {
        constraintsByTable[con.table_name] = [];
      }
      
      let conSQL = `ALTER TABLE ${con.table_name} ADD CONSTRAINT ${con.constraint_name} `;
      
      if (con.constraint_type === 'PRIMARY KEY') {
        conSQL += `PRIMARY KEY (${con.columns})`;
      } else if (con.constraint_type === 'FOREIGN KEY') {
        conSQL += `FOREIGN KEY (${con.columns}) REFERENCES ${con.foreign_table_name}(${con.foreign_columns})`;
        if (con.update_rule !== 'NO ACTION') {
          conSQL += ` ON UPDATE ${con.update_rule}`;
        }
        if (con.delete_rule !== 'NO ACTION') {
          conSQL += ` ON DELETE ${con.delete_rule}`;
        }
      } else if (con.constraint_type === 'UNIQUE') {
        conSQL += `UNIQUE (${con.columns})`;
      } else if (con.constraint_type === 'CHECK') {
        conSQL += `CHECK ${con.check_clause}`;
      }
      
      constraintsByTable[con.table_name].push(conSQL + ';');
    }
    
    for (const [tableName, tableConstraints] of Object.entries(constraintsByTable)) {
      schemaSQL += `\n-- Constraints for ${tableName}\n`;
      schemaSQL += tableConstraints.join('\n') + '\n';
    }

    // 4. Get all indexes
    console.log('📋 Extracting indexes...');
    const indexes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE '%_key'
      ORDER BY tablename, indexname;
    `);

    if (indexes.rows.length > 0) {
      schemaSQL += '\n-- Indexes\n';
      for (const idx of indexes.rows) {
        schemaSQL += `${idx.indexdef};\n`;
      }
    }

    // 5. Get all views
    console.log('📋 Extracting views...');
    const views = await client.query(`
      SELECT 
        table_name as view_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (views.rows.length > 0) {
      schemaSQL += '\n-- Views\n';
      for (const view of views.rows) {
        schemaSQL += `CREATE OR REPLACE VIEW ${view.view_name} AS\n${view.view_definition};\n\n`;
      }
    }

    // 6. Get functions/procedures
    console.log('📋 Extracting functions...');
    const functions = await client.query(`
      SELECT 
        proname as function_name,
        pg_get_functiondef(oid) as function_def
      FROM pg_proc
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY proname;
    `);

    if (functions.rows.length > 0) {
      schemaSQL += '\n-- Functions\n';
      for (const func of functions.rows) {
        schemaSQL += `${func.function_def};\n\n`;
      }
    }

    // 7. Get triggers
    console.log('📋 Extracting triggers...');
    const triggers = await client.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_statement,
        action_orientation,
        action_timing,
        array_agg(event_manipulation) as events
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      GROUP BY trigger_name, event_object_table, action_statement, 
               action_orientation, action_timing
      ORDER BY event_object_table, trigger_name;
    `);

    if (triggers.rows.length > 0) {
      schemaSQL += '\n-- Triggers\n';
      for (const trig of triggers.rows) {
        schemaSQL += `-- Trigger: ${trig.trigger_name} on ${trig.event_object_table}\n`;
        schemaSQL += `-- Note: Trigger definitions need to be manually reconstructed\n`;
        schemaSQL += `-- Action: ${trig.action_statement}\n\n`;
      }
    }

    // Write to file
    await fs.writeFile(outputFile, schemaSQL);
    
    console.log(`\n✅ Schema generated successfully!`);
    console.log(`📄 Output file: ${outputFile}`);
    console.log(`📊 Summary:`);
    console.log(`   - Tables: ${tables.rows.length}`);
    console.log(`   - Constraints: ${constraints.rows.length}`);
    console.log(`   - Indexes: ${indexes.rows.length}`);
    console.log(`   - Views: ${views.rows.length}`);
    console.log(`   - Functions: ${functions.rows.length}`);
    console.log(`   - Triggers: ${triggers.rows.length}`);

    // Also create a migration file that can be applied to production
    const migrationFile = path.join(outputDir, `999_complete_schema_sync_${timestamp}.sql`);
    const migrationSQL = `-- Migration to sync production with local schema
-- Generated on ${new Date().toISOString()}

BEGIN;

${schemaSQL}

-- Record this migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (999, 'complete_schema_sync_${timestamp}', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
`;

    await fs.writeFile(migrationFile, migrationSQL);
    console.log(`\n📄 Migration file: ${migrationFile}`);

    // Create a comparison helper script
    const comparisonScript = `#!/bin/bash
# Script to apply schema to production database

echo "This script will apply the complete schema to production database"
echo "WARNING: This should only be run after careful review!"
echo ""
echo "To apply to production, set DATABASE_URL environment variable and run:"
echo "psql \"\\$DATABASE_URL\" -f ${migrationFile}"
`;

    const scriptFile = path.join(outputDir, `apply-to-production.sh`);
    await fs.writeFile(scriptFile, comparisonScript);
    await fs.chmod(scriptFile, '755');
    console.log(`\n📄 Helper script: ${scriptFile}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

generateCompleteSchema();