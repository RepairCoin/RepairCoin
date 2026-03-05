#!/bin/bash

# EAS Build pre-install hook
# Writes google-services.json from EAS secret (base64 encoded)

set -e

echo "=== EAS Build Pre-install Hook ==="
echo "Current directory: $(pwd)"
echo "Checking for GOOGLE_SERVICES_JSON secret..."

if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "Secret found, writing google-services.json..."

  # Create directory if it doesn't exist
  mkdir -p ./android/app

  # Use -d flag for Linux compatibility (EAS build servers run Linux)
  echo "$GOOGLE_SERVICES_JSON" | base64 -d > ./android/app/google-services.json

  echo "google-services.json created successfully"
  echo "File size: $(wc -c < ./android/app/google-services.json) bytes"
  ls -la ./android/app/google-services.json
else
  echo "ERROR: GOOGLE_SERVICES_JSON environment variable not set!"
  echo "Available env vars:"
  env | grep -i google || echo "No GOOGLE vars found"
  exit 1
fi

echo "=== Pre-install Hook Complete ==="
