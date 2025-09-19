#!/usr/bin/env node

const { Client } = require('pg');

// Database configurations
const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'repaircoin',
  password: 'repaircoin123',
  database: 'repaircoin'
};

const prodConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@host:port/database',
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
};

// Query to get table and column information
const schemaQuery = `
SELECT 
    t.table_name,
    array_agg(
        json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default,
            'character_maximum_length', c.character_maximum_length
        ) ORDER BY c.ordinal_position
    ) as columns
FROM 
    information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE 
    t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
GROUP BY 
    t.table_name
ORDER BY 
    t.table_name;
`;

async function getSchema(config, name) {
  const client = new Client(config);
  try {
    await client.connect();
    const result = await client.query(schemaQuery);
    return result.rows;
  } catch (error) {
    console.error(`Error connecting to ${name} database:`, error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function compareSchemas() {
  console.log('🔍 Comparing database schemas...\n');
  
  try {
    // Get schemas
    console.log('📊 Fetching local database schema...');
    const localSchema = await getSchema(localConfig, 'local');
    console.log(`✅ Local database: ${localSchema.length} tables found\n`);
    
    console.log('📊 Fetching production database schema...');
    const prodSchema = await getSchema(prodConfig, 'production');
    console.log(`✅ Production database: ${prodSchema.length} tables found\n`);
    
    // Create maps for easier comparison
    const localMap = new Map(localSchema.map(table => [table.table_name, table]));
    const prodMap = new Map(prodSchema.map(table => [table.table_name, table]));
    
    // Find differences
    const localOnly = [];
    const prodOnly = [];
    const different = [];
    
    // Check tables in local but not in prod
    for (const [tableName, table] of localMap) {
      if (!prodMap.has(tableName)) {
        localOnly.push(tableName);
      } else {
        // Compare columns
        const localCols = JSON.stringify(table.columns.sort((a, b) => a.column_name.localeCompare(b.column_name)));
        const prodCols = JSON.stringify(prodMap.get(tableName).columns.sort((a, b) => a.column_name.localeCompare(b.column_name)));
        
        if (localCols !== prodCols) {
          different.push({
            table: tableName,
            local: table.columns,
            prod: prodMap.get(tableName).columns
          });
        }
      }
    }
    
    // Check tables in prod but not in local
    for (const [tableName] of prodMap) {
      if (!localMap.has(tableName)) {
        prodOnly.push(tableName);
      }
    }
    
    // Report results
    console.log('📋 SCHEMA COMPARISON RESULTS:');
    console.log('=' .repeat(50));
    
    if (localOnly.length === 0 && prodOnly.length === 0 && different.length === 0) {
      console.log('\n✅ Databases are in sync! No differences found.\n');
    } else {
      if (localOnly.length > 0) {
        console.log('\n❌ Tables only in LOCAL database:');
        localOnly.forEach(table => console.log(`   - ${table}`));
      }
      
      if (prodOnly.length > 0) {
        console.log('\n❌ Tables only in PRODUCTION database:');
        prodOnly.forEach(table => console.log(`   - ${table}`));
      }
      
      if (different.length > 0) {
        console.log('\n⚠️  Tables with different schemas:');
        different.forEach(diff => {
          console.log(`\n   Table: ${diff.table}`);
          
          // Find column differences
          const localColMap = new Map(diff.local.map(col => [col.column_name, col]));
          const prodColMap = new Map(diff.prod.map(col => [col.column_name, col]));
          
          // Columns only in local
          const localOnlyCols = diff.local.filter(col => !prodColMap.has(col.column_name));
          if (localOnlyCols.length > 0) {
            console.log('   Local only columns:');
            localOnlyCols.forEach(col => console.log(`     - ${col.column_name} (${col.data_type})`));
          }
          
          // Columns only in prod
          const prodOnlyCols = diff.prod.filter(col => !localColMap.has(col.column_name));
          if (prodOnlyCols.length > 0) {
            console.log('   Production only columns:');
            prodOnlyCols.forEach(col => console.log(`     - ${col.column_name} (${col.data_type})`));
          }
          
          // Columns with different types
          diff.local.forEach(localCol => {
            const prodCol = prodColMap.get(localCol.column_name);
            if (prodCol && JSON.stringify(localCol) !== JSON.stringify(prodCol)) {
              console.log(`   Column "${localCol.column_name}" differs:`);
              console.log(`     Local: ${localCol.data_type}${localCol.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
              console.log(`     Prod:  ${prodCol.data_type}${prodCol.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
            }
          });
        });
      }
    }
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 SUMMARY:');
    console.log(`   Local tables: ${localSchema.length}`);
    console.log(`   Production tables: ${prodSchema.length}`);
    console.log(`   Tables only in local: ${localOnly.length}`);
    console.log(`   Tables only in production: ${prodOnly.length}`);
    console.log(`   Tables with differences: ${different.length}`);
    console.log('=' .repeat(50) + '\n');
    
  } catch (error) {
    console.error('❌ Error during comparison:', error.message);
    process.exit(1);
  }
}

// Run the comparison
compareSchemas();