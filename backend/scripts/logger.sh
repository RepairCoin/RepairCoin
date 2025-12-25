#!/bin/bash
# Usage: ./scripts/logger.sh <filter>
# Example: ./scripts/logger.sh ReferralBusinessLogic

FILTER=${1:-""}
LOG_FILE="logs/combined.log"

if [ -z "$FILTER" ]; then
  echo "Usage: npm run logger -- <filter>"
  echo "Example: npm run logger -- ReferralBusinessLogic"
  exit 1
fi

echo "Tailing logs filtered by: \"fn\":\"$FILTER\""
echo "Press 'c' to clear screen, Ctrl+C to stop"
echo ""

# Start tail in background
tail -f "$LOG_FILE" | grep --line-buffered "\"fn\":\"$FILTER\"" | jq . &
TAIL_PID=$!

# Handle cleanup
trap "kill $TAIL_PID 2>/dev/null; exit" INT TERM

# Listen for 'c' key to clear screen
while true; do
  read -rsn1 key
  if [ "$key" = "c" ]; then
    clear
    echo "Tailing logs filtered by: \"fn\":\"$FILTER\""
    echo "Press 'c' to clear screen, Ctrl+C to stop"
    echo ""
  fi
done
