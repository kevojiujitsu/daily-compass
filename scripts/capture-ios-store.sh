#!/bin/bash
set -euo pipefail
command -v xcodegen >/dev/null || brew install xcodegen
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath work/capture-app CODE_SIGNING_ALLOWED=NO CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM='' PROVISIONING_PROFILE_SPECIFIER='' build >work/capture-build.log 2>&1
xcodegen generate --spec ci/store-capture/project.yml
runtime=$(xcrun simctl list runtimes --json | python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and "iOS-26" in x["identifier"]]; print(sorted(r,key=lambda x:tuple(map(int,x["version"].split("."))))[-1]["identifier"])')
mkdir -p work/store-screenshots
for kind in iphone ipad; do
  if [ "$kind" = iphone ]; then needle='iPhone 16 Pro'; else needle='iPad Pro (13-inch)'; fi
  device_type=$(xcrun simctl list devicetypes --json | NEEDLE="$needle" python3 -c 'import json,sys,os; ds=json.load(sys.stdin)["devicetypes"]; print(next(d["identifier"] for d in ds if os.environ["NEEDLE"] in d["name"]))')
  device=$(xcrun simctl create "Daily Compass $kind captures" "$device_type" "$runtime")
  xcrun simctl boot "$device"
  xcrun simctl bootstatus "$device" -b
  xcrun simctl status_bar "$device" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
  xcrun simctl install "$device" work/capture-app/Build/Products/Debug-iphonesimulator/App.app
  capture_status=0
  xcodebuild -project ci/store-capture/DailyCompassStoreCapture.xcodeproj -scheme Capture -destination "platform=iOS Simulator,id=$device" -resultBundlePath "work/$kind-capture.xcresult" CODE_SIGNING_ALLOWED=NO test >"work/$kind-capture.log" 2>&1 || capture_status=$?
  xcrun xcresulttool export attachments --path "work/$kind-capture.xcresult" --output-path "work/store-screenshots/$kind"
  xcrun simctl shutdown "$device"
  if [ "$capture_status" -ne 0 ]; then exit "$capture_status"; fi
done
