#!/bin/bash

# RepairCoin Mobile Deployment Script
# Usage: ./scripts/deploy.sh [preview|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"

# Function to deploy preview (staging)
deploy_preview() {
    echo -e "${GREEN}Deploying to PREVIEW (com.repaircoin.staging)...${NC}"
    eas build --profile preview --platform ios
    echo ""
    echo -e "${YELLOW}After build completes, run:${NC}"
    echo "  eas submit --profile preview --platform ios"
}

# Function to deploy production
deploy_production() {
    echo -e "${GREEN}Deploying to PRODUCTION (com.repaircoin.app)...${NC}"
    eas build --profile production --platform ios
    echo ""
    echo -e "${YELLOW}After build completes, run:${NC}"
    echo "  eas submit --profile production --platform ios"
}

# Function for auto-deploy based on branch
auto_deploy() {
    case $CURRENT_BRANCH in
        main|master)
            echo -e "${YELLOW}On main branch - deploying to PREVIEW${NC}"
            deploy_preview
            ;;
        prod|production)
            echo -e "${YELLOW}On prod branch - deploying to PRODUCTION${NC}"
            deploy_production
            ;;
        *)
            echo -e "${RED}Error: Auto-deploy only works on 'main' or 'prod' branches${NC}"
            echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"
            echo ""
            echo "Options:"
            echo "  npm run deploy:ios:preview     - Deploy to preview (staging)"
            echo "  npm run deploy:ios:production   - Deploy to production"
            exit 1
            ;;
    esac
}

# Parse command line arguments
case "${1:-auto}" in
    preview|staging)
        deploy_preview
        ;;
    production|prod)
        if [ "$CURRENT_BRANCH" != "prod" ] && [ "$CURRENT_BRANCH" != "production" ]; then
            echo -e "${RED}Warning: You are not on the prod branch!${NC}"
            read -p "Are you sure you want to deploy to production? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Deployment cancelled."
                exit 1
            fi
        fi
        deploy_production
        ;;
    auto)
        auto_deploy
        ;;
    *)
        echo "Usage: ./scripts/deploy.sh [preview|production|auto]"
        echo ""
        echo "Commands:"
        echo "  preview     - Build for preview/staging (TestFlight)"
        echo "  production  - Build for App Store (requires prod branch)"
        echo "  auto        - Auto-detect based on current branch (default)"
        exit 1
        ;;
esac
