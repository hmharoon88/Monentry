# Monentry

A simple daily expense and income tracker. Log in seconds, see totals by day and month, optional tags for type, method, and place.

## Features (MVP)

- **Today** — log expenses and income, see today's totals
- **Summary** — monthly income, expenses, net, and category breakdown
- **Me** — theme, account, subscriptions, cloud sync
- **Local storage** — SQLite on device (free tier)
- **Cloud sync** — Firebase + Firestore (Plus tier)
- **Subscriptions** — RevenueCat (Plus $1.99/mo, Family $4.99/mo planned)
- **Light + dark theme** — follows system by default

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 1 user, local only, no cloud sync |
| Plus | $1.99/mo | Firebase cloud sync, backup, all devices |
| Family | $4.99/mo | Plus + shared groups (up to 6, coming soon) |

## Run locally

```bash
cd ~/Desktop/Monentry
cp .env.example .env
# Add Firebase + RevenueCat keys
npm start
```

Then press `i` for iOS simulator, or use a native build for subscriptions:

```bash
npx expo run:ios
```

## Launch guides

| Guide | What it covers |
|-------|----------------|
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Master checklist — start here |
| [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) | Auth + Firestore cloud sync |
| [docs/REVENUECAT_SETUP.md](docs/REVENUECAT_SETUP.md) | Subscriptions + billing |
| [docs/APP_STORE.md](docs/APP_STORE.md) | Screenshots, listing, submission |

## Production build

```bash
npm install -g eas-cli
eas login
eas init
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## Project structure

```
app/                  # Expo Router screens
  (tabs)/             # Today, Summary, Me
  add-entry.tsx       # Add expense/income modal
  sign-in.tsx         # Account sign in / sign up
src/
  config/             # Firebase + RevenueCat init
  sync/               # Firestore merge + push/pull
  context/            # Theme, Auth, Subscription, Transactions
  storage/            # SQLite database
  components/         # UI components
  constants/          # Categories, subscription info
docs/                 # Setup guides + legal pages
eas.json              # EAS build profiles
firebase.json         # Firestore rules deploy config
```

## Tech stack

- Expo SDK 56 + TypeScript
- Expo Router (file-based navigation)
- expo-sqlite (local data)
- Firebase Auth + Firestore (cloud sync)
- RevenueCat (subscriptions)
- AsyncStorage (theme preference)
