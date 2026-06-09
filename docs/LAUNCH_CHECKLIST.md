# Monentry launch checklist

Complete these steps in order to ship v1.0.

## Phase 1 — Backend setup

- [ ] **Firebase project** — [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
  - [ ] Create project + enable Email/Password auth
  - [ ] Create Firestore database
  - [ ] Deploy rules: `firebase deploy --only firestore:rules`
  - [ ] Copy Web app config to `.env`
- [ ] **RevenueCat** — [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md)
  - [ ] Create project + link iOS app
  - [ ] Create App Store subscription products
  - [ ] Create entitlements (`plus`, `family`) + default offering
  - [ ] Add iOS API key to `.env`
- [ ] **GitHub Pages** — push updated `docs/privacy.html` and `docs/support.html`

## Phase 2 — Local testing

```bash
cp .env.example .env
# Fill in Firebase + RevenueCat keys
npm start
```

- [ ] Free tier: add/delete entries, Summary, theme
- [ ] Sign up / sign in works
- [ ] Sandbox purchase → Plus tier activates
- [ ] Cloud sync works after Plus purchase
- [ ] Restore purchases works
- [ ] Privacy + Support links open from Me tab

> RevenueCat requires a native build (`npx expo run:ios` or EAS dev build), not Expo Go.

## Phase 3 — EAS build pipeline

- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Login: `eas login`
- [ ] Initialize: `eas init` → update `app.json` project ID
- [ ] Add env vars to EAS (Firebase + RevenueCat keys)
- [ ] Update `eas.json` with your Apple Team ID + ASC App ID

```bash
eas build --platform ios --profile production
```

## Phase 4 — App Store Connect

Follow [APP_STORE.md](./APP_STORE.md):

- [ ] Create app listing
- [ ] Upload screenshots (Today, Add entry, Summary, Me)
- [ ] Write description + keywords
- [ ] Set privacy policy + support URLs
- [ ] Complete age rating questionnaire
- [ ] Configure subscription products (if not done in Phase 1)

## Phase 5 — TestFlight

```bash
eas submit --platform ios --profile production
```

- [ ] Install on real iPhone via TestFlight
- [ ] Full test pass (see APP_STORE.md checklist)
- [ ] Fix any crashes or UX issues

## Phase 6 — Submit for review

- [ ] Select build in App Store Connect
- [ ] Add review notes (demo account if needed)
- [ ] Submit for review
- [ ] Respond to any Apple feedback

## Phase 7 — Post-launch

- [ ] Monitor Firebase usage
- [ ] Monitor RevenueCat subscriptions
- [ ] Watch for App Store reviews
- [ ] Plan v1.1: Family groups, Summary filters, multi-currency

---

## Quick reference

| Doc | Purpose |
|-----|---------|
| [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) | Auth + Firestore cloud sync |
| [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md) | Subscriptions + billing |
| [APP_STORE.md](./APP_STORE.md) | Screenshots, listing, submission |
| [firestore.rules](./firestore.rules) | Firestore security rules |

| URL | Live |
|-----|------|
| Privacy | https://hmharoon88.github.io/Monentry/privacy.html |
| Support | https://hmharoon88.github.io/Monentry/support.html |
| GitHub | https://github.com/hmharoon88/Monentry |
