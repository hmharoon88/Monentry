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

Open the project in the **correct** Xcode (not the old 16.4 in Applications):

```bash
npm run xcode
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

Sign In with Apple is **required** when Google login is offered (App Store guideline 4.8). It is enabled by default in this project (`Monentry.entitlements` + `expo-apple-authentication`).

If Xcode shows provisioning errors for `com.apple.developer.applesignin`:

1. Go to [developer.apple.com](https://developer.apple.com) → **Identifiers** → `com.monentry.app`
2. Enable **Sign In with Apple**
3. In Xcode → Signing → click **Try Again**
4. Rebuild: `npm run testflight` or `npx expo run:ios`

To hide Apple Sign In locally only, set `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false` in `.env` (do not ship that to App Store if Google is enabled).

## Verify

```bash
xcodebuild -version   # should show Xcode 26.4 or newer
```

You currently have **two** Xcodes installed:

| Path | Version | Use for Monentry? |
|------|---------|-------------------|
| `/Applications/Xcode.app` | 16.4 | **No** — too old |
| `/Users/haroon/Downloads/Xcode.app` | 26.5 | **Yes** |

If `xcodebuild -version` shows 16.4, builds will fail.

## Build from Xcode

**Important:** `.xcworkspace` files may open in the old Xcode from Applications. Always use Xcode 26.5:

```bash
open -a "/Users/haroon/Downloads/Xcode.app" ~/Desktop/Monentry/ios/Monentry.xcworkspace
```

Then:

1. **Terminal 1** — start Metro first (required for Debug builds):
   ```bash
   cd ~/Desktop/Monentry && npm start
   ```
   Wait until you see `Waiting on http://localhost:8082`
2. **Terminal 2 / Xcode** — select an **iPhone Simulator**, press Run
3. If the app shows a red error screen, press **⌘R** in the simulator to reload

**Easier:** use one command that starts Metro and builds together:

```bash
cd ~/Desktop/Monentry && npm run ios
```

## Fix: `No script URL provided`

Debug builds do **not** embed JavaScript. The native app loads JS from **Metro** on port **8082** (Monentry default — leaves 8081 free for other projects).

If you see:

```
No script URL provided. Make sure the packager is running...
unsanitizedScriptURLString = (null)
```

**Fix:**

1. Start Metro in a terminal and leave it running:
   ```bash
   cd ~/Desktop/Monentry && npm start
   ```
2. Reload the app: **⌘R** in the simulator, or stop and Run again from Xcode
3. Confirm Metro is up: open [http://localhost:8082](http://localhost:8082) in your browser (should show Metro, not another project)

**Physical device (HiPhone):** Metro must listen on your LAN IP, not only localhost:

```bash
cd ~/Desktop/Monentry && npm start
```

(`npm start` uses `--host lan` and port **8082**.) Then run from Xcode or `npm run ios` — the app reads your Mac IP from `ip.txt` and connects to **8082**, not 8081.

## Fix: `PhaseScriptExecution failed with a nonzero exit code`

This is a generic Xcode wrapper. The real error is usually one line above it in the build log.

**Most common cause for Monentry:** building with **Xcode 16.4** instead of **26.5**. Look for:

```
package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.1.0
```

in the **Report navigator** (⌘9) → failed build → expand **ExpoModulesJSI** → **Build ExpoModulesJSI xcframework**.

**Fix:**

1. Quit Xcode completely (⌘Q)
2. Open the workspace with Xcode 26.5 (command above), **or** run `npm run ios` from Terminal
3. **Recommended one-time fix** — replace old Xcode in Applications:

```bash
sudo rm -rf /Applications/Xcode.app
sudo mv "/Users/haroon/Downloads/Xcode.app" /Applications/Xcode.app
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version   # must show 26.5
```

4. Clean build folder in Xcode: **Product → Clean Build Folder** (⇧⌘K), then Run again
