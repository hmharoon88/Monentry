#!/bin/bash
# Push .env variables to EAS (run once after eas init, from project root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EAS="npx eas-cli"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy .env.example and fill in Firebase + RevenueCat keys."
  exit 1
fi

if ! $EAS whoami >/dev/null 2>&1; then
  echo "Not logged in to EAS. Run:"
  echo "  npx eas-cli login"
  exit 1
fi

cd "$ROOT"

VARS=(
  EXPO_PUBLIC_FIREBASE_API_KEY
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  EXPO_PUBLIC_FIREBASE_PROJECT_ID
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  EXPO_PUBLIC_FIREBASE_APP_ID
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
)

upsert_env() {
  local name="$1"
  local value="$2"
  local env_name="$3"
  $EAS env:create --name "$name" --value "$value" --environment "$env_name" --visibility plaintext --force --non-interactive 2>/dev/null \
    || $EAS env:create --name "$name" --value "$value" --environment "$env_name" --visibility plaintext --non-interactive
}

echo "Syncing environment variables to EAS (production + preview)…"
for name in "${VARS[@]}"; do
  value="$(grep -E "^${name}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  if [ -z "$value" ]; then
    echo "  skip $name (empty)"
    continue
  fi
  echo "  set $name"
  upsert_env "$name" "$value" production
  upsert_env "$name" "$value" preview
  upsert_env "$name" "$value" testflight 2>/dev/null || upsert_env "$name" "$value" production
done

echo ""
echo "Done. Verify: npx eas-cli env:list --environment production"
echo "Then upload a new TestFlight build: npm run testflight"
