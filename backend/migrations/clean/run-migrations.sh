#!/bin/bash

# RepairCoin Database Migration Script
# This script runs all clean migrations in the correct order

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to run a migration
run_migration() {
    local file=$1
    local description=$2

    print_info "Running: $file - $description"

    if psql "$DATABASE_URL" -f "$file" > /dev/null 2>&1; then
        print_success "Migration completed: $description"
        return 0
    else
        print_error "Migration failed: $description"
        return 1
    fi
}

# Print banner
echo ""
echo "=========================================="
echo "  RepairCoin Database Migration Tool"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set"
    echo ""
    echo "Usage:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
    echo "  ./run-migrations.sh [fresh|update]"
    echo ""
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Parse command line argument
MODE=${1:-update}

if [ "$MODE" = "fresh" ]; then
    print_warning "FRESH DATABASE MODE"
    print_warning "This will run ALL migrations from scratch"
    echo ""
    read -p "Are you sure? This should only be used on a NEW database. (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Aborted by user"
        exit 0
    fi

    echo ""
    print_info "Starting fresh database setup..."
    echo ""

    # Run all migrations in order
    run_migration "$SCRIPT_DIR/001_initial_schema.sql" "Base schema (tables, sequences, indexes)" || exit 1
    run_migration "$SCRIPT_DIR/002_add_webhook_logs_and_archiving.sql" "Webhook logging and archiving infrastructure" || exit 1
    run_migration "$SCRIPT_DIR/003_add_stripe_and_purchase_improvements.sql" "Stripe and purchase tracking" || exit 1
    run_migration "$SCRIPT_DIR/004_remove_obsolete_columns.sql" "Remove deprecated columns" || exit 1
    run_migration "$SCRIPT_DIR/005_add_social_media_fields.sql" "Social media fields" || exit 1

elif [ "$MODE" = "update" ]; then
    print_info "UPDATE MODE (for existing databases)"
    print_info "This will only run migrations 002-005 (safe for existing data)"
    echo ""
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Aborted by user"
        exit 0
    fi

    echo ""
    print_info "Applying updates to existing database..."
    echo ""

    # Run only the new migrations (skip 001 as it already exists)
    run_migration "$SCRIPT_DIR/002_add_webhook_logs_and_archiving.sql" "Webhook logging and archiving infrastructure" || exit 1
    run_migration "$SCRIPT_DIR/003_add_stripe_and_purchase_improvements.sql" "Stripe and purchase tracking" || exit 1
    run_migration "$SCRIPT_DIR/004_remove_obsolete_columns.sql" "Remove deprecated columns" || exit 1
    run_migration "$SCRIPT_DIR/005_add_social_media_fields.sql" "Social media fields" || exit 1

else
    print_error "Invalid mode: $MODE"
    echo ""
    echo "Usage:"
    echo "  ./run-migrations.sh fresh   # Fresh database (runs all migrations)"
    echo "  ./run-migrations.sh update  # Existing database (runs only new migrations)"
    echo ""
    exit 1
fi

# Verify installation
echo ""
print_info "Verifying installation..."

# Check if tables were created
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
print_success "Database has $TABLE_COUNT tables"

# Check if webhook_logs table exists
WEBHOOK_TABLE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_logs';")
if [ "$WEBHOOK_TABLE" -eq 1 ]; then
    print_success "webhook_logs table created"
else
    print_warning "webhook_logs table not found"
fi

# Check if platform_statistics view exists
STATS_VIEW=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'platform_statistics';")
if [ "$STATS_VIEW" -eq 1 ]; then
    print_success "platform_statistics view created"
else
    print_warning "platform_statistics view not found"
fi

# Check if system_settings table exists
SETTINGS_TABLE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings';")
if [ "$SETTINGS_TABLE" -eq 1 ]; then
    print_success "system_settings table created"

    # Show default settings
    echo ""
    print_info "Default system settings:"
    psql "$DATABASE_URL" -c "SELECT key, value, description FROM system_settings WHERE category = 'cleanup' OR category = 'webhooks';"
else
    print_warning "system_settings table not found"
fi

echo ""
print_success "Migration completed successfully!"
echo ""
print_info "Next steps:"
echo "  1. Start your backend server: npm run dev"
echo "  2. Check webhook health: GET /api/webhooks/health"
echo "  3. View platform statistics via AdminRepository.getPlatformStatisticsFromView()"
echo ""
print_info "Scheduled jobs will run automatically:"
echo "  • Cleanup service: Daily"
echo "  • Statistics refresh: Every 5 minutes"
echo ""
