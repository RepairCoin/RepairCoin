#!/bin/bash

# EAS Build pre-install hook
# Verifies google-services.json exists (should be tracked in git)

echo "=== EAS Build Pre-install Hook ==="
echo "Current directory: $(pwd)"

# Check if google-services.json exists (should be tracked in git)
if [ -f "./google-services.json" ]; then
  echo "google-services.json found in project root"
  echo "File size: $(wc -c < ./google-services.json) bytes"
else
  echo "WARNING: google-services.json not found in project root"

  # Try to use EAS secret as fallback
  if [ -n "$GOOGLE_SERVICES_JSON" ]; then
    echo "Using GOOGLE_SERVICES_JSON secret as fallback..."
    echo "$GOOGLE_SERVICES_JSON" | base64 -d > ./google-services.json
    echo "Created google-services.json from secret"
  else
    echo "ERROR: No google-services.json found and no secret available"
    exit 1
  fi
fi

echo "=== Pre-install Hook Complete ==="
