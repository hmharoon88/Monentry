# Monentry

A simple daily expense and income tracker. Log in seconds, see totals by day and month, optional tags for type, method, and place.

## Features (MVP)

- **Today** — log expenses and income, see today's totals
- **Summary** — monthly income, expenses, net, and category breakdown
- **Me** — theme (system / light / dark), plan info, upgrade placeholders
- **Local storage** — SQLite on device (free tier, no cloud)
- **Light + dark theme** — follows system by default

## Pricing (planned)

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 1 user, local only, no cloud sync |
| Plus | $1.99/mo | Firebase cloud sync, backup, all devices |
| Family | $4.99/mo | Plus + shared groups (up to 6) |

## Run locally

```bash
cd ~/Desktop/Monentry
npm start
```

Then press `i` for iOS simulator, `a` for Android, or scan the QR code with Expo Go.

## Project structure

```
app/                  # Expo Router screens
  (tabs)/             # Today, Summary, Me
  add-entry.tsx       # Add expense/income modal
src/
  theme/              # Light/dark color tokens
  storage/            # SQLite database
  context/            # Theme + transactions
  components/         # UI components
  constants/          # Categories, subscription info
  types/              # TypeScript types
  utils/              # Formatting, dates
```

## Next steps

- [ ] Firebase Auth + Firestore sync (Plus tier)
- [ ] Family groups + invites (Family tier)
- [ ] RevenueCat subscriptions
- [ ] Custom app icon
- [ ] Filter by method and place on Summary

## Tech stack

- Expo SDK 56 + TypeScript
- Expo Router (file-based navigation)
- expo-sqlite (local data)
- AsyncStorage (theme preference)
