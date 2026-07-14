# RevenueCat setup for Monentry

Monentry uses [RevenueCat](https://www.revenuecat.com/) for Plus ($1.99/mo) and Family ($4.99/mo). Purchases update `users/{uid}.tier` in Firestore (enables partner sharing, Settle, etc.).

## Quick fix — “Billing not configured” on TestFlight

Your `.env` must contain the **iOS public** key (`appl_…`). Then push it to EAS and rebuild:

```bash
# 1. Paste key into .env (see step 6 below)
# 2. Verify
npm run verify-revenuecat

# 3. Log in and sync to EAS (TestFlight builds use production env)
npx eas-cli login
npm run sync-eas-env

# 4. New TestFlight build
npm run testflight
```

Local `.env` is **not** included in EAS builds automatically.

---

## 1. Create a RevenueCat project

1. Sign up at https://app.revenuecat.com
2. Create a project named **Monentry**
3. Add your **iOS app** with bundle ID `com.monentry.app`

## 2. App Store Connect subscriptions

In [App Store Connect](https://appstoreconnect.apple.com) → your app → **Subscriptions**:

### Subscription group

Create a group: **Monentry Plans**

### Products

| Product ID | Reference name | Price |
|------------|----------------|-------|
| `monentry_plus_monthly` | Monentry Plus | $1.99/mo |
| `monentry_family_monthly` | Monentry Family | $4.99/mo |

Add localized display names and descriptions for each.

### Sandbox testers

App Store Connect → Users and Access → **Sandbox** → create test accounts for purchase testing.

## 3. Link App Store Connect to RevenueCat

1. RevenueCat → Project → **Apps** → iOS app
2. Add App Store Connect shared secret (App Store Connect → App → App Information → App-Specific Shared Secret)
3. RevenueCat will sync your products automatically

## 4. Create entitlements

RevenueCat → **Entitlements**:

| Entitlement ID | Product |
|----------------|---------|
| `plus` | `monentry_plus_monthly` |
| `family` | `monentry_family_monthly` |

These IDs must match `src/constants/subscriptions.ts`.

## 5. Create an offering

RevenueCat → **Offerings** → **+ New** → create **`monentry_plans`** (leave old `default` alone):

| Package | Product |
|---------|---------|
| `plus` | `monentry_plus_monthly` |
| `family` | `monentry_family_monthly` |

Mark **`monentry_plans`** as **Current** (not `default`).

### Auto-configure (recommended)

If the Me tab shows **“plan not available yet”**, wire packages via the API:

1. RevenueCat → **Project settings** → **API keys** → **+ New**
2. Name: `Monentry configure` · **Version: V2** (legacy v1 `sk_` keys do **not** work)
3. Permissions: enable **project_configuration** read/write (products, entitlements, offerings, packages)
4. Add to `.env`: `REVENUECAT_SECRET_API_KEY=sk_…`
5. Run:

```bash
npm run configure-revenuecat
npm start -- --clear
```

## 6. Add API keys to `.env`

RevenueCat → Project → **API keys** → copy the **iOS public key**:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxxxxx
```

Restart Metro after updating `.env`.

## 7. How purchases flow in the app

1. User signs in (Firebase Auth)
2. User taps **Subscribe** on Me tab
3. RevenueCat handles App Store purchase
4. App reads active entitlements → updates Firestore `users/{uid}.tier`
5. Cloud sync starts automatically for Plus/Family

## 8. Testing purchases

RevenueCat purchases **do not work in Expo Go**. Use a development build:

```bash
eas build --platform ios --profile development
# or
npx expo run:ios
```

Sign in with a **Sandbox Apple ID** on your test device (Settings → App Store → Sandbox Account).

## 9. Restore purchases

The Me tab includes **Restore purchases**. Apple requires this for apps with subscriptions.

## 10. Production checklist

- [ ] Subscription products approved in App Store Connect
- [ ] Entitlements and offering configured in RevenueCat
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` in EAS secrets
- [ ] Test sandbox purchase end-to-end
- [ ] Test restore purchases
- [ ] Verify Firestore `tier` updates after purchase

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Subscriptions not configured" | Add RevenueCat API key to `.env` |
| No packages shown | Check RevenueCat offering is marked Current |
| Purchase succeeds but no sync | Verify entitlements named `plus` / `family` |
| Works in dev, not production | Add API key to EAS production env vars |
