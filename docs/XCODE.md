# Xcode setup for Monentry

Expo SDK 56 requires **Xcode 26.4+** (Swift 6.2+).

## If you have Xcode 26.5 in Downloads

The project is configured to use:

```
/Users/haroon/Downloads/Xcode.app
```

Run iOS builds with:

```bash
npm run ios
```

Or set it system-wide (enter Mac password once):

```bash
sudo mv "/Users/haroon/Downloads/Xcode.app" /Applications/Xcode.app
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Sign in to Xcode (required for device / App Store builds)

Xcode 26.5 in Downloads starts with **no Apple account**. Add yours:

1. Open **Xcode 26.5** (from Downloads, not old 16.4)
2. **Xcode → Settings → Accounts**
3. Click **+** → **Apple ID** → sign in with `dr-haroon@hotmail.com`
4. Select team **Hafiz Muhammad Haroon Afzal** (`DTHF364HT2`)

Simulator builds skip Apple portal signing. Real device and TestFlight still need the account above.

## Verify

```bash
xcodebuild -version   # should show Xcode 26.4 or newer
```

## Build from Xcode

1. Open `ios/Monentry.xcworkspace` in Xcode 26.5 (not 16.4)
2. Start Metro: `npm start`
3. Press Run in Xcode
