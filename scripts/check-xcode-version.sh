#!/bin/bash
# Fail early when Monentry is opened in Xcode 16.x instead of 26.4+.

REQUIRED_VERSION=2640

if [ -z "${XCODE_VERSION_ACTUAL:-}" ]; then
  echo "warning: XCODE_VERSION_ACTUAL is unset; skipping Xcode version check."
  exit 0
fi

if [ "${XCODE_VERSION_ACTUAL}" -lt "${REQUIRED_VERSION}" ]; then
  echo "error: Monentry requires Xcode 26.4+ (Swift 6.2+)."
  echo "error: This build is using Xcode ${XCODE_VERSION_ACTUAL} (likely 16.4 from /Applications)."
  echo "error:"
  echo "error: Quit Xcode, then run one of:"
  echo "error:   cd ~/Desktop/Monentry && npm run xcode"
  echo "error:   open -a \"/Users/haroon/Downloads/Xcode.app\" ~/Desktop/Monentry/ios/Monentry.xcworkspace"
  echo "error:"
  echo "error: Permanent fix:"
  echo "error:   sudo rm -rf /Applications/Xcode.app"
  echo "error:   sudo mv \"/Users/haroon/Downloads/Xcode.app\" /Applications/Xcode.app"
  echo "error:   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi
