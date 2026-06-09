# Monentry — App Store submission guide

Step-by-step guide to ship Monentry v1.0 on the iOS App Store.

## Prerequisites

- [x] Apple Developer account
- [x] App icon (1024×1024 in `assets/icon.png`)
- [x] Privacy policy live: https://hmharoon88.github.io/Monentry/privacy.html
- [x] Support page live: https://hmharoon88.github.io/Monentry/support.html
- [ ] Firebase project configured — see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- [ ] RevenueCat + App Store subscriptions — see [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md)
- [ ] EAS account — https://expo.dev

---

## Step 1 — Expo / EAS project

```bash
npm install -g eas-cli
eas login
eas init
```

Update `app.json`:

- Replace `YOUR_EAS_PROJECT_ID` with the ID from `eas init`
- Replace `YOUR_EXPO_ACCOUNT` with your Expo username

---

## Step 2 — Environment secrets for production

Add secrets to EAS (not committed to git):

```bash
eas secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..." --scope project
eas secret:create --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "..." --scope project
eas secret:create --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "..." --scope project
eas secret:create --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "..." --scope project
eas secret:create --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "..." --scope project
eas secret:create --name EXPO_PUBLIC_FIREBASE_APP_ID --value "..." --scope project
eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "..." --scope project
```

Or use the EAS dashboard: Project → Environment variables.

---

## Step 3 — Production iOS build

```bash
eas build --platform ios --profile production
```

When the build finishes, download the `.ipa` or submit directly:

```bash
eas submit --platform ios --profile production
```

Update `eas.json` submit section with your:

- `appleTeamId` — Apple Developer → Membership
- `ascAppId` — App Store Connect → App → General → Apple ID

---

## Step 4 — App Store Connect listing

Create a new app in [App Store Connect](https://appstoreconnect.apple.com):

| Field | Suggested value |
|-------|-----------------|
| **Name** | Monentry |
| **Subtitle** | Simple daily expense tracker |
| **Bundle ID** | `com.monentry.app` |
| **SKU** | `monentry-ios-001` |
| **Primary category** | Finance |
| **Secondary category** | Productivity |

### Description (copy-paste starter)

```
Monentry is a simple daily expense and income tracker. Log in seconds, see today's totals, and review your month at a glance.

FREE
• Track expenses and income locally on your device
• Optional tags: category, payment method, place
• Light and dark theme
• No account required

MONENTRY PLUS ($1.99/mo)
• Cloud backup and sync across devices
• Sign in with email to keep your data safe

Perfect if you want something simpler than YNAB but more useful than a basic notes app.
```

### Keywords

```
expense,budget,tracker,money,income,spending,daily,finance,simple
```

### URLs

| Field | URL |
|-------|-----|
| Privacy Policy | https://hmharoon88.github.io/Monentry/privacy.html |
| Support URL | https://hmharoon88.github.io/Monentry/support.html |

### Age rating

Complete the questionnaire. Monentry has no user-generated content sharing, no gambling, no unrestricted web access → typically **4+**.

### Export compliance

App uses standard HTTPS only. Answer **No** to custom encryption (already set in `app.json` via `ITSAppUsesNonExemptEncryption: false`).

---

## Step 5 — Screenshots

Required sizes (use iPhone 15 Pro Max simulator or real device):

| Display | Size | Device |
|---------|------|--------|
| 6.7" | 1290 × 2796 | iPhone 15 Pro Max |
| 6.5" | 1284 × 2778 | iPhone 14 Plus |
| 5.5" | 1242 × 2208 | iPhone 8 Plus (optional) |

Capture these screens:

1. **Today** — totals + a few entries
2. **Add entry** — keypad + category chips
3. **Summary** — monthly totals + category bars
4. **Me** — plan + theme (free tier is fine for v1.0 screenshots)

Tip: Simulator → File → Save Screen (⌘S), or use `xcrun simctl io booted screenshot shot.png`.

---

## Step 6 — TestFlight

1. Upload build via `eas submit` or Transporter
2. App Store Connect → TestFlight → add internal testers
3. Install on a real iPhone
4. Test checklist:
   - [ ] Add expense / income
   - [ ] Delete entry (long-press)
   - [ ] Summary totals update
   - [ ] Theme switch works
   - [ ] Sign up / sign in
   - [ ] Subscribe to Plus (sandbox)
   - [ ] Cloud sync after Plus purchase
   - [ ] Restore purchases
   - [ ] Privacy + Support links open
   - [ ] Clear all data

---

## Step 7 — Submit for review

1. App Store Connect → your app → **Prepare for Submission**
2. Select the TestFlight build
3. Fill in review notes:

```
Monentry is a local-first expense tracker. The free tier works fully offline with no account.

To test Plus cloud sync:
1. Create an account (Me → Sign in)
2. Subscribe to Monentry Plus (sandbox subscription)
3. Add an entry — it syncs to Firebase

Demo account (optional — create one and add here):
Email: ...
Password: ...
```

4. Submit for review (typically 1–3 days)

---

## Step 8 — After approval

- [ ] Push any pending doc updates to GitHub Pages
- [ ] Monitor Firebase usage and Firestore costs
- [ ] Monitor RevenueCat dashboard for subscriptions
- [ ] Respond to App Store reviews

---

## Common rejection reasons (avoid these)

| Issue | Fix |
|-------|-----|
| Missing privacy policy URL | Already hosted — link in App Store Connect |
| Advertised features don't work | Plus sync must work in review build |
| Missing restore purchases | Me tab → Restore purchases button |
| Missing sign-in for paid features | Sign in required before subscribe |
| Crash on launch | Test release build on device before submit |

---

## Useful commands

```bash
# Local dev
npm start

# iOS simulator (native)
npx expo run:ios

# Production build
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --profile production

# Deploy Firestore rules
firebase deploy --only firestore:rules
```
