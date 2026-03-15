#!/bin/bash

# Environment Switcher for RepairCoin Mobile
# Usage: ./scripts/switch-env.sh [local|staging|production]

ENV=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_usage() {
    echo ""
    echo -e "${BLUE}RepairCoin Environment Switcher${NC}"
    echo ""
    echo "Usage: npm run env:[environment]"
    echo ""
    echo "Available environments:"
    echo -e "  ${GREEN}local${NC}       - Local development (http://192.168.1.53:4000/api)"
    echo -e "  ${YELLOW}staging${NC}     - Staging server (https://api-staging.repaircoin.ai/api)"
    echo -e "  ${RED}production${NC}  - Production server (https://api.repaircoin.ai/api)"
    echo ""
    echo "Examples:"
    echo "  npm run env:local       # Switch to local environment"
    echo "  npm run env:staging     # Switch to staging environment"
    echo "  npm run env:production  # Switch to production environment"
    echo ""
}

show_current() {
    if [ -f "$MOBILE_DIR/.env" ]; then
        CURRENT_URL=$(grep "^EXPO_PUBLIC_API_URL=" "$MOBILE_DIR/.env" | cut -d '=' -f2)
        echo ""
        echo -e "${BLUE}Current API URL:${NC} $CURRENT_URL"
        echo ""
    fi
}

if [ -z "$ENV" ]; then
    show_usage
    show_current
    exit 0
fi

case $ENV in
    local)
        ENV_FILE="env.local"
        API_URL="http://192.168.1.53:4000/api"
        ;;
    staging)
        ENV_FILE="env.staging"
        API_URL="https://api-staging.repaircoin.ai/api"
        ;;
    production)
        ENV_FILE="env.production"
        API_URL="https://api.repaircoin.ai/api"
        ;;
    *)
        echo -e "${RED}Error: Unknown environment '$ENV'${NC}"
        show_usage
        exit 1
        ;;
esac

# Check if source file exists
if [ ! -f "$MOBILE_DIR/$ENV_FILE" ]; then
    echo -e "${RED}Error: $ENV_FILE not found${NC}"
    exit 1
fi

# Copy the environment file to .env
cp "$MOBILE_DIR/$ENV_FILE" "$MOBILE_DIR/.env"

echo ""
echo -e "${GREEN}✓ Switched to $ENV environment${NC}"
echo -e "${BLUE}  API URL:${NC} $API_URL"
echo ""
echo -e "${YELLOW}Note: Run 'npx expo start --clear' to apply changes${NC}"
echo ""
