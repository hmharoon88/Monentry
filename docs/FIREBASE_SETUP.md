# Firebase setup for Monentry

Monentry uses **Firebase Auth** (email/password) and **Cloud Firestore** for Plus-tier cloud sync.

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project (e.g. `monentry-app`)
3. Add an **iOS app** with bundle ID `com.monentry.app`
4. Add a **Web app** (needed for Expo config keys)

## 2. Enable Authentication

1. Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Email/Password**

## 3. Create Firestore database

1. Firebase Console → **Firestore Database** → **Create database**
2. Start in **production mode**
3. Deploy rules from this repo:

```bash
firebase deploy --only firestore:rules
```

Or paste `docs/firestore.rules` into the Firebase Console rules editor.

## 4. Add env vars locally

Copy `.env.example` to `.env` and fill in your Web app config:

```bash
cp .env.example .env
```

Restart Metro after changing env vars:

```bash
npm start
```

## 5. Enable cloud sync

Cloud sync activates automatically when a user has an active **Plus** or **Family** subscription (via RevenueCat). See [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md).

For manual testing without a purchase:

1. Sign up in the app (Me → Sign in)
2. Firebase Console → **Firestore** → `users/{uid}`
3. Set field `tier` to `"plus"` or `"family"`
4. Reopen the app or tap **Sync now** on the Me tab

Sync runs when:

- User is signed in
- User profile `tier` is `plus` or `family`

## 6. Data model

```
users/{uid}
  email: string
  tier: "free" | "plus" | "family"
  createdAt: string (ISO)
  updatedAt: string (ISO)

users/{uid}/transactions/{transactionId}
  id, type, amount, category, method, place, who, note
  date, createdAt, updatedAt
  deletedAt: string | null   // soft delete for sync
```

## 7. How sync works

- **Local-first:** SQLite remains the UI source of truth
- **On sign-in (Plus):** merge remote + local, last-write-wins by `updatedAt`
- **On add/delete:** write locally, then push to Firestore
- **Real-time:** Firestore listener triggers merge when data changes on another device

## 8. Production checklist

- [ ] Deploy Firestore security rules
- [ ] Add Firebase keys to EAS secrets for production builds
- [ ] Configure RevenueCat — see [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md)
- [ ] Privacy policy mentions Firebase — already updated in `docs/privacy.html`
