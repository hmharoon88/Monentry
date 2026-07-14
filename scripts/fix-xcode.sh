#!/bin/bash
# Reset Xcode caches and open Monentry with Xcode 26.5 + the CocoaPods workspace.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
XCODE_26="/Users/haroon/Downloads/Xcode.app"
WORKSPACE="$ROOT/ios/Monentry.xcworkspace"

if [ ! -d "$XCODE_26" ]; then
  echo "Xcode 26.5 not found at $XCODE_26"
  exit 1
fi

if [ ! -d "$WORKSPACE" ]; then
  echo "Missing workspace: $WORKSPACE"
  exit 1
fi

echo "Closing Xcode…"
killall Xcode 2>/dev/null || true
sleep 1

echo "Clearing DerivedData for Monentry…"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/Monentry-"*

echo "Clearing stale user workspace state…"
rm -rf "$ROOT/ios/Monentry.xcworkspace/xcuserdata"
rm -rf "$ROOT/ios/Monentry.xcodeproj/xcuserdata"

echo "Verifying project loads…"
DEVELOPER_DIR="$XCODE_26/Contents/Developer" xcodebuild -list -workspace "$WORKSPACE" | grep -q "Monentry" \
  || { echo "Project still fails to load — contact support or run: npx expo prebuild --platform ios"; exit 1; }

echo "Opening Monentry.xcworkspace in Xcode 26.5…"
open -a "$XCODE_26" "$WORKSPACE"

echo ""
echo "In Xcode, confirm top bar shows:"
echo "  Scheme: Monentry"
echo "  Destination: iPhone or simulator"
echo ""
echo "Start Metro in another terminal before Run:"
echo "  cd $ROOT && npm start -- --clear"
