#!/bin/bash

# EAS Build pre-install hook
# Writes google-services.json from EAS secret (base64 encoded)

if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "Writing google-services.json from EAS secret..."
  echo "$GOOGLE_SERVICES_JSON" | base64 --decode > ./android/app/google-services.json
  echo "google-services.json created successfully"
  echo "File contents preview:"
  head -5 ./android/app/google-services.json
else
  echo "Warning: GOOGLE_SERVICES_JSON environment variable not set"
fi
