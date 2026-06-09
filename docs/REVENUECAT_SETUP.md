# RevenueCat setup for Monentry

Monentry uses [RevenueCat](https://www.revenuecat.com/) to manage Plus ($1.99/mo) and Family ($4.99/mo) subscriptions. Purchases update the user's `tier` in Firestore, which enables cloud sync.

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

RevenueCat → **Offerings** → create **default** offering:

| Package | Product |
|---------|---------|
| `plus` (or `$rc_monthly`) | `monentry_plus_monthly` |
| `family` | `monentry_family_monthly` |

Mark this offering as **Current**.

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
