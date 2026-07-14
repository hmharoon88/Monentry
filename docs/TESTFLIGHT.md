# TestFlight — use Monentry with your partner

This gets a build on TestFlight so you and your partner install the same app (no Metro cable, no Xcode on their phone).

## One-time setup (you)

### 1. EAS + Expo project

```bash
cd /Users/haroon/Desktop/Monentry
npm install
npm install -g eas-cli    # or: npx eas-cli …
eas login
eas init                  # links project → updates app.json projectId
```

### 2. Push secrets to EAS

Your local `.env` is **not** uploaded with the build. Sync it once:

```bash
bash scripts/sync-eas-env.sh
```

Required in `.env`: all `EXPO_PUBLIC_FIREBASE_*`, Google client IDs, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.

### 3. App Store Connect app

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → New App  
2. Name: **Monentry**, Bundle ID: **com.monentry.app**, SKU: `monentry-ios-001`  
3. Copy the **Apple ID** (numeric) from App Information → paste into `eas.json`:

```json
"ascAppId": "1234567890"
```

(in both `submit.testflight` and `submit.production`)

### 4. Subscriptions (for partner sharing)

Partner groups require **Plus**. In App Store Connect → Subscriptions, create:

| Product ID | Price |
|------------|-------|
| `monentry_plus_monthly` | $1.99/mo |

Link in [RevenueCat](https://app.revenuecat.com) → entitlements `plus` → offering **default**.  
See [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md).

Create a **Sandbox** tester (App Store Connect → Users and Access → Sandbox).

### 5. Build + upload to TestFlight

```bash
npm run testflight
```

Or step by step:

```bash
eas build --platform ios --profile testflight
eas submit --platform ios --profile testflight --latest
```

First build takes ~15–25 minutes on EAS servers.

---

## Invite your partner

### Option A — External TestFlight (easiest for a partner)

1. App Store Connect → your app → **TestFlight**  
2. After the build processes, add **External Testing** group  
3. Add partner’s **email** → they get an invite  
4. They install **TestFlight** from the App Store, then install Monentry  

*(First external group may need a short Beta App Review — usually 24–48h.)*

### Option B — Internal testing (instant, max 100 users)

Add partner as **App Store Connect user** (Users and Access → **+** → Developer or App Manager).  
They appear under TestFlight → **Internal Testing**.

---

## Using partner sharing (both phones)

1. **Both** create a Monentry account (Me → Sign in).  
2. **You** subscribe to **Plus** (Me → Subscribe) — use **Sandbox** Apple ID when prompted in TestFlight.  
3. **You**: Me → **Partner & family** → **Start partner group** → **Show QR code** or share invite code.  
4. **Partner**: Me → **Scan QR code** or enter code → joins group.  
5. Expenses/income sync to the shared household in Firebase.

**Settle** (lend & borrow tab): both need Plus; invite from Settle tab.

---

## Quick test without RevenueCat (temporary)

Firebase Console → Firestore → `users/{your-uid}` → set field:

```json
"tier": "plus"
```

Reload app. Partner sharing works without a sandbox purchase. Remove before App Store launch.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on EAS | Run `npm run typecheck` locally; check EAS build logs |
| “Billing not configured” | Add RevenueCat key to `.env` + `sync-eas-env.sh` + rebuild |
| Partner can’t join | Partner must be signed in; you must have Plus |
| QR scan crash | TestFlight build includes camera — reinstall latest build |
| Old build on phone | Delete app → reinstall from TestFlight |

---

## Commands

```bash
npm run testflight          # build + submit to TestFlight
npm run build:preview       # ad-hoc internal (registered devices only)
npm run typecheck
firebase deploy --only firestore:rules
```
