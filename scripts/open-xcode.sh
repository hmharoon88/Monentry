#!/bin/bash
set -euo pipefail

XCODE_26="/Users/haroon/Downloads/Xcode.app"
WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)/ios/Monentry.xcworkspace"

if [ ! -d "$XCODE_26" ]; then
  echo "Xcode 26.5 not found at $XCODE_26"
  echo "Install Xcode 26.4+ or update the path in scripts/open-xcode.sh"
  exit 1
fi

open -a "$XCODE_26" "$WORKSPACE"
