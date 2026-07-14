#!/bin/bash
# Check local RevenueCat + subscription config before EAS build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
ok=true

echo "Monentry — RevenueCat preflight"
echo "================================"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: Missing .env"
  exit 1
fi

rc_key="$(grep -E "^EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [ -z "$rc_key" ]; then
  echo "FAIL: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is empty in .env"
  echo "      RevenueCat → Project → API keys → iOS public key (starts with appl_)"
  ok=false
elif [[ "$rc_key" =~ ^test_ ]]; then
  echo "FAIL: test_ key in .env — TestFlight/App Store need appl_ (RevenueCat → API keys → iOS public)"
  echo "      test_ keys only work in Debug. For dev, use: npx expo run:ios"
  ok=false
else
  echo "OK:   RevenueCat iOS public key present in .env (appl_…)"
fi

fb_key="$(grep -E "^EXPO_PUBLIC_FIREBASE_API_KEY=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [ -z "$fb_key" ]; then
  echo "FAIL: Firebase not configured in .env (needed after purchase to save tier)"
  ok=false
else
  echo "OK:   Firebase configured"
fi

echo ""
echo "App expects (match RevenueCat dashboard):"
echo "  Entitlement plus:   plus  OR  Monentry Pro (Test Store)"
echo "  Entitlement family: family  OR  Monentry Family"
echo "  Products:           monentry_plus_monthly, monentry_family_monthly"
echo "  Offering:           monentry_plans (marked Current)"
echo "  Bundle ID:          com.monentry.app"
echo ""

if npx eas-cli whoami >/dev/null 2>&1; then
  if npx eas-cli env:list --environment production 2>/dev/null | grep -q REVENUECAT; then
    echo "OK:   RevenueCat key found in EAS production env"
  else
    echo "FAIL: RevenueCat key NOT in EAS — TestFlight will show 'Billing not configured'"
    echo "      Run: npm run sync-eas-env"
    ok=false
  fi
else
  echo "SKIP: Not logged in to EAS (npx eas-cli login) — cannot verify cloud env"
  echo "      After login run: npm run sync-eas-env"
fi

echo ""
if [ "$ok" = true ]; then
  echo "Local checks passed. Complete RevenueCat dashboard + App Store Connect, then:"
  echo "  npm run testflight"
  exit 0
fi

echo "Fix the items above, then run this script again."
exit 1
