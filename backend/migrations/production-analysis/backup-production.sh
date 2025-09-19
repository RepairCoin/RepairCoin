#!/bin/bash
# Backup production database before migration

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo "Creating production backup..."

pg_dump "$DATABASE_URL" > "production_backup_${TIMESTAMP}.sql"

echo "Backup completed: production_backup_${TIMESTAMP}.sql"
echo "To restore: psql \"$DATABASE_URL\" < production_backup_${TIMESTAMP}.sql"
