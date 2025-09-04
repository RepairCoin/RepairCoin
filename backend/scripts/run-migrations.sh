#!/bin/bash
# Backend database migration runner

DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-repaircoin}
DB_NAME=${DB_NAME:-repaircoin}
DB_PASSWORD=${DB_PASSWORD:-repaircoin123}

echo "🔄 Running database migrations..."

# Check if running in Docker or local
if command -v docker &> /dev/null && docker ps | grep -q repaircoin-db; then
    echo "📦 Using Docker container for database"
    DB_COMMAND="docker exec -i repaircoin-db psql -U $DB_USER -d $DB_NAME"
else
    echo "💻 Using local PostgreSQL"
    DB_COMMAND="PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME"
fi

# Create migrations directory if it doesn't exist
MIGRATION_DIR="$(dirname "$0")/../migrations"
mkdir -p "$MIGRATION_DIR"

# Get all migration files in order
MIGRATIONS=$(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATIONS" ]; then
    echo "⚠️  No migration files found in $MIGRATION_DIR"
    exit 0
fi

# Apply each migration
for migration in $MIGRATIONS; do
    migration_name=$(basename "$migration")
    echo "📄 Applying migration: $migration_name"
    
    if $DB_COMMAND < "$migration"; then
        echo "✅ Successfully applied: $migration_name"
    else
        echo "❌ Failed to apply: $migration_name"
        exit 1
    fi
done

echo "✅ All migrations completed successfully!"

# Show current migration status
echo ""
echo "📊 Current migration status:"
$DB_COMMAND -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version" 2>/dev/null || echo "Migration tracking table not yet created"