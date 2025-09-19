#!/bin/bash
# Script to apply schema to production database

echo "This script will apply the complete schema to production database"
echo "WARNING: This should only be run after careful review!"
echo ""
echo "To apply to production, run:"
echo "Set DATABASE_URL environment variable and run:"
echo "psql \"\$DATABASE_URL\" -f complete-schema-2025-09-19.sql"
