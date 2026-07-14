# Firebase setup for Monentry

Monentry uses **Firebase Auth** (email, Google, Apple) and **Cloud Firestore** for cloud backup. All signed-in users get sync across devices.

## Monentry project (already created)

| Item | Value |
|------|--------|
| **Project ID** | `monentry-app` |
| **Console** | [firebase.google.com/project/monentry-app](https://console.firebase.google.com/project/monentry-app/overview) |
| **iOS app** | `com.monentry.app` |
| **Firestore** | Created (`nam5`) + security rules deployed |
| **Local `.env`** | Created with Web app keys |

### One manual step left: turn on Authentication

Firebase Auth must be started once in the console (free — no billing required):

1. Open **[Authentication → Sign-in method](https://console.firebase.google.com/project/monentry-app/authentication/providers)**
2. Click **Get started** (if shown)
3. Enable **Email/Password**
4. Enable **Google** (optional but recommended)
5. Copy the **Web client ID** from the Google provider into `.env`:
   ```bash
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=....apps.googleusercontent.com
   ```
6. Restart Metro: `npm start`, then reload the app (**⌘R**)

### Show “Monentry” instead of `project-839435839292` on Google sign-in

Google emails and the sign-in prompt use the **OAuth app name**, not `app.json`. Update it in two places:

1. **Firebase** → Authentication → Google (pencil) → **Public-facing name** → `Monentry` → Save
2. **Google Cloud** → [Auth Platform → Branding](https://console.cloud.google.com/auth/branding?project=monentry-app) → **App name** → `Monentry` → Save

The Firebase project display name is already set to **Monentry**. Future sign-ins will use the new name after you save the branding above.

After that, sign in works in the app via **Me → Sign in**.

---

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project (e.g. `monentry-app`)
3. Add an **iOS app** with bundle ID `com.monentry.app`
4. Add a **Web app** (needed for Expo config keys)

## 2. Enable Authentication

Firebase Console → **Authentication** → **Sign-in method**:

| Provider | Used for |
|----------|----------|
| **Email/Password** | Gmail, iCloud, Hotmail, Outlook, any email |
| **Google** | Continue with Google button |
| **Apple** | Sign in with Apple (required on iOS if Google is offered) |

### Google Sign-In

1. Enable **Google** in Firebase Authentication
2. Copy the **Web client ID** from Firebase → Project settings → Your apps → Web app
3. Add to `.env`:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

The iOS client ID is in `GoogleService-Info.plist` or Google Cloud Console → Credentials → iOS client for `com.monentry.app`.

### Apple Sign-In

1. Enable **Apple** in Firebase Authentication
2. Apple Developer → Identifiers → `com.monentry.app` → enable **Sign in with Apple**
3. Rebuild the native app (`npx expo run:ios` or EAS build) — Apple Sign In does not work in Expo Go

## 3. Create Firestore database

1. Firebase Console → **Firestore Database** → **Create database**
2. Start in **production mode**
3. Deploy rules from this repo:

```bash
firebase deploy --only firestore:rules
```

Or paste `docs/firestore.rules` into the Firebase Console rules editor.

## 4. Add env vars locally

```bash
cp .env.example .env
```

Fill in Firebase keys + Google client IDs. Restart Metro:

```bash
npm start
```

## 5. Cloud backup (all signed-in users)

When a user signs in (email, Google, or Apple):

- Entries sync to Firestore automatically
- On a new phone, sign in with the same account to restore everything

No subscription required for backup. See [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md) for optional Plus/Family payments.

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
- **On sign-in:** merge remote + local, last-write-wins by `updatedAt`
- **On add/delete:** write locally, then push to Firestore
- **Real-time:** Firestore listener triggers merge when data changes on another device

## 8. Production checklist

- [ ] Deploy Firestore security rules
- [ ] Enable Email, Google, and Apple in Firebase Auth
- [ ] Add Firebase + Google keys to EAS secrets for production builds
- [ ] Configure RevenueCat for payments — see [REVENUECAT_SETUP.md](./REVENUECAT_SETUP.md)
- [ ] Privacy policy mentions Firebase — already updated in `docs/privacy.html`
