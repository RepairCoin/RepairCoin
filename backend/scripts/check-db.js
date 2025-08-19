const { Pool } = require('pg');

async function checkDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        
        // Check current user and database
        const userResult = await pool.query('SELECT current_user, current_database(), current_schema()');
        console.log('Current user:', userResult.rows[0].current_user);
        console.log('Current database:', userResult.rows[0].current_database);
        console.log('Current schema:', userResult.rows[0].current_schema);
        
        // Check available schemas
        const schemasResult = await pool.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_owner = current_user
            ORDER BY schema_name
        `);
        console.log('\nSchemas owned by current user:');
        schemasResult.rows.forEach(row => {
            console.log(`  - ${row.schema_name}`);
        });
        
        // Check if we can see any tables
        const tablesResult = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        `);
        
        console.log('\nVisible tables:');
        if (tablesResult.rows.length === 0) {
            console.log('  No tables found');
        } else {
            tablesResult.rows.forEach(row => {
                console.log(`  - ${row.table_schema}.${row.table_name}`);
            });
        }
        
        // Check permissions on public schema
        const permissionsResult = await pool.query(`
            SELECT 
                has_schema_privilege(current_user, 'public', 'CREATE') as can_create,
                has_schema_privilege(current_user, 'public', 'USAGE') as can_use
        `);
        console.log('\nPermissions on public schema:');
        console.log('  Can CREATE:', permissionsResult.rows[0].can_create);
        console.log('  Can USE:', permissionsResult.rows[0].can_use);
        
        // Try to check if we have a different schema
        const searchPathResult = await pool.query('SHOW search_path');
        console.log('\nCurrent search_path:', searchPathResult.rows[0].search_path);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    checkDatabase();
}

module.exports = { checkDatabase };