#!/bin/bash
# Automate everything possible before TestFlight / App Store. Manual dashboard steps print at the end.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Monentry — prepare for App Store"
echo "================================="
echo ""

failures=0
warn() { echo "WARN: $*"; }
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }
ok() { echo "OK:   $*"; }

# --- Code checks ---
echo "1. TypeScript"
if npm run typecheck >/dev/null 2>&1; then
  ok "typecheck passed"
else
  fail "typecheck failed — run: npm run typecheck"
fi
echo ""

# --- Firestore rules ---
echo "2. Firestore security rules"
if grep -q 'allow read, write: if true' docs/firestore.rules 2>/dev/null; then
  fail "firestore.rules still wide open — fix before launch"
else
  ok "production rules present in docs/firestore.rules"
fi

if firebase projects:list >/dev/null 2>&1; then
  echo "     Deploying rules to monentry-app…"
  if firebase deploy --only firestore:rules --non-interactive; then
    ok "rules deployed to Firebase"
  else
    fail "firebase deploy failed — run: firebase deploy --only firestore:rules"
  fi
else
  warn "Not logged in to Firebase — run: firebase login"
  echo "     Then: firebase deploy --only firestore:rules"
fi
echo ""

# --- RevenueCat ---
echo "3. RevenueCat"
ENV_FILE="$ROOT/.env"
rc_key="$(grep -E "^EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
secret="$(grep -E "^REVENUECAT_SECRET_API_KEY=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"

if [[ -z "$rc_key" ]]; then
  fail "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY missing from .env"
elif [[ "$rc_key" =~ ^test_ ]]; then
  fail "Still using test_ RevenueCat key — paste appl_ key from RevenueCat → API keys (App Store app)"
else
  ok "appl_ RevenueCat public key in .env"
fi

if [[ -n "$secret" ]]; then
  if node scripts/diagnose-revenuecat.mjs 2>&1 | tee /tmp/monentry-rc-diag.txt | grep -q "Secret key: v2 OK"; then
    ok "RevenueCat V2 secret key — running configure-revenuecat"
    node scripts/configure-revenuecat.mjs || fail "configure-revenuecat failed"
  elif grep -q "legacy v1" /tmp/monentry-rc-diag.txt 2>/dev/null; then
    fail "REVENUECAT_SECRET_API_KEY is legacy v1 — create V2 key in RevenueCat dashboard"
  else
    node scripts/diagnose-revenuecat.mjs || true
  fi
else
  warn "REVENUECAT_SECRET_API_KEY not set — configure offering manually in RevenueCat dashboard"
  node scripts/diagnose-revenuecat.mjs 2>/dev/null || true
fi
echo ""

# --- Apple Sign In ---
echo "4. Sign in with Apple"
apple_enabled="$(grep -E "^EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [[ "$apple_enabled" == "true" ]]; then
  ok "Apple Sign In enabled in .env"
else
  warn "Set EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true after enabling capability on com.monentry.app in Apple Developer"
fi
if grep -q 'usesAppleSignIn' app.json; then
  ok "app.json configured for Apple Sign In"
fi
echo ""

# --- EAS ---
echo "5. EAS / TestFlight"
if npx eas-cli whoami >/dev/null 2>&1; then
  ok "Logged in to EAS as $(npx eas-cli whoami 2>/dev/null | tail -1)"
  if grep -q 'YOUR_EAS_PROJECT_ID' app.json; then
    fail "Run eas init — app.json still has YOUR_EAS_PROJECT_ID"
  fi
  if grep -q 'YOUR_APP_STORE_CONNECT_APP_ID' eas.json; then
    fail "Set ascAppId in eas.json from App Store Connect → App → Apple ID"
  fi
  if [[ "$rc_key" =~ ^appl_ ]]; then
    echo "     Syncing env to EAS…"
    bash scripts/sync-eas-env.sh || fail "sync-eas-env failed"
  fi
else
  warn "Not logged in to EAS — run: npx eas-cli login"
  echo "     Then: eas init && bash scripts/sync-eas-env.sh"
fi
echo ""

# --- Manual steps ---
echo "================================="
echo "Manual steps (browser — cannot automate)"
echo "================================="
echo ""
echo "App Store Connect (https://appstoreconnect.apple.com):"
echo "  • Create app Monentry (com.monentry.app) if not done"
echo "  • Subscriptions: monentry_plus_monthly (\$1.99), monentry_family_monthly (\$4.99)"
echo "  • Copy Apple ID → eas.json ascAppId"
echo "  • Sandbox testers for purchase testing"
echo ""
echo "RevenueCat (https://app.revenuecat.com):"
echo "  • Add iOS App Store app (bundle com.monentry.app)"
echo "  • Link App Store Connect (API key or shared secret)"
echo "  • Entitlements: plus → monentry_plus_monthly, family → monentry_family_monthly"
echo "  • Offering monentry_plans (Current) with both packages"
echo "  • Copy appl_ public key → .env → npm run sync-eas-env"
echo ""
echo "Apple Developer (https://developer.apple.com):"
echo "  • Identifiers → com.monentry.app → enable Sign In with Apple"
echo ""
echo "When all green:"
echo "  npm run testflight"
echo ""

if [[ "$failures" -gt 0 ]]; then
  echo "$failures blocker(s) above — fix those first."
  exit 1
fi

echo "Automated checks passed. Complete manual steps, then: npm run testflight"
exit 0
