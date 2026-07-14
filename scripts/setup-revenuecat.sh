#!/bin/bash
# Interactive RevenueCat setup — paste API key, verify, sync to EAS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EAS="npx eas-cli"

cd "$ROOT"

echo ""
echo "Monentry — RevenueCat setup"
echo "==========================="
echo ""
echo "Do these in the browser first (if not done yet):"
echo "  1. https://app.revenuecat.com — create project Monentry"
echo "  2. Add iOS app: bundle ID com.monentry.app"
echo "  3. App Store Connect: products monentry_plus_monthly, monentry_family_monthly"
echo "  4. RevenueCat: entitlements plus + family, offering default (Current)"
echo "  5. RevenueCat → Project → API keys → iOS public key (starts with appl_)"
echo ""

if command -v open >/dev/null 2>&1; then
  read -r -p "Open RevenueCat in browser? [Y/n] " open_rc
  if [[ ! "$open_rc" =~ ^[Nn]$ ]]; then
    open "https://app.revenuecat.com/overview"
  fi
fi

echo ""
read -r -p "Paste your iOS public key (appl_…): " RC_KEY
RC_KEY="$(echo "$RC_KEY" | tr -d '[:space:]')"

if [[ -z "$RC_KEY" ]]; then
  echo "No key entered. Aborting."
  exit 1
fi

if [[ ! "$RC_KEY" =~ ^(appl_|test_) ]]; then
  echo "Warning: key should start with appl_ (App Store) or test_ (RevenueCat Test Store)."
  read -r -p "Continue anyway? [y/N] " cont
  [[ "$cont" =~ ^[Yy]$ ]] || exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example — fill Firebase keys if needed."
fi

if grep -q "^EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" "$ENV_FILE"; then
  if [[ "$(uname)" == Darwin ]]; then
    sed -i '' "s|^EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=.*|EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${RC_KEY}|" "$ENV_FILE"
  else
    sed -i "s|^EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=.*|EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${RC_KEY}|" "$ENV_FILE"
  fi
else
  echo "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${RC_KEY}" >> "$ENV_FILE"
fi

echo "Saved public key to .env"
echo ""

read -r -p "Paste your RevenueCat SECRET key (sk_…) to auto-configure plans? [Y/n] " setup_secret
if [[ ! "$setup_secret" =~ ^[Nn]$ ]]; then
  echo ""
  echo "Use a V2 secret key (legacy v1 keys fail with API v2):"
  echo "  RevenueCat → Project settings → API keys → + New"
  echo "  Version: V2 · Permissions: project_configuration (read/write)"
  echo ""
  read -r -p "V2 secret key (sk_…): " SECRET_KEY
  SECRET_KEY="$(echo "$SECRET_KEY" | tr -d '[:space:]')"
  if [[ -z "$SECRET_KEY" ]]; then
    echo "No secret key entered — skip auto-configure."
  elif [[ ! "$SECRET_KEY" =~ ^sk_ ]]; then
    echo "Warning: secret key should start with sk_"
  else
    if grep -q "^REVENUECAT_SECRET_API_KEY=" "$ENV_FILE"; then
      if [[ "$(uname)" == Darwin ]]; then
        sed -i '' "s|^REVENUECAT_SECRET_API_KEY=.*|REVENUECAT_SECRET_API_KEY=${SECRET_KEY}|" "$ENV_FILE"
      else
        sed -i "s|^REVENUECAT_SECRET_API_KEY=.*|REVENUECAT_SECRET_API_KEY=${SECRET_KEY}|" "$ENV_FILE"
      fi
    else
      echo "REVENUECAT_SECRET_API_KEY=${SECRET_KEY}" >> "$ENV_FILE"
    fi
    echo "Running npm run configure-revenuecat …"
    npm run configure-revenuecat
    echo ""
    echo "Reload the app: npm start -- --clear, then force-quit Monentry."
  fi
fi

echo ""
bash scripts/verify-revenuecat.sh || true

echo ""
if ! $EAS whoami >/dev/null 2>&1; then
  echo "Log in to Expo to push secrets for TestFlight:"
  echo "  npx eas-cli login"
  echo "Then run:"
  echo "  npm run sync-eas-env"
  echo "  npm run testflight"
  exit 0
fi

read -r -p "Sync .env to EAS now? [Y/n] " sync_now
if [[ ! "$sync_now" =~ ^[Nn]$ ]]; then
  bash scripts/sync-eas-env.sh
  echo ""
  read -r -p "Start TestFlight build now? [y/N] " build_now
  if [[ "$build_now" =~ ^[Yy]$ ]]; then
    npm run testflight
  else
    echo "When ready: npm run testflight"
  fi
fi
