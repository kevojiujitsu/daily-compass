#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this script on a Mac with Xcode 26 or later."
  exit 1
fi
xcodebuild -version
node --version
npm install
npm run ios
npm run ios:check
open ios/App/App.xcodeproj
printf '\nSelect your Apple Developer team in Xcode, then finish the blockers listed in APP_STORE_PREPARATION.md before archiving.\n'
