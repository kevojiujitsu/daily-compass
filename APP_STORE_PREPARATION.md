# Apple App Store preparation

Use this checklist to prepare and validate an iOS release. App Store Connect is
the source of truth for the current release status; do not store account
identifiers, contact details, signing credentials, or internal build records
in this guide.

## Build and validate

The iOS project uses the Capacitor toolchain and requires a compatible Node.js
and Xcode installation. From the project folder:

1. Install the project dependencies.
2. Run `bash scripts/prepare-ios-on-mac.sh` on a Mac to install dependencies,
   synchronize the native project, run static checks, and open Xcode.
3. In Xcode, select the app's registered bundle identifier and development
   team. Verify capabilities and permission descriptions against the features
   that are actually enabled.
4. Build and test on supported iPhone and iPad simulators, then validate
   device-only features on physical devices.

The repository includes manual simulator-build and signed TestFlight workflows.
Review their current configuration before use. Store signing material only in
the platform's encrypted secret store; never commit or share it in source,
build logs, or chat. Simulator builds are not installable on a physical device
or suitable for App Store upload.

## Release readiness

- Verify in-app purchases, restores, subscription status, refunds, revocations,
  and renewal notifications using the current store configuration. Do not
  enable purchases based only on client-provided data.
- Test local reminders and push delivery on supported devices. Confirm that
  notification permission, opt-out, cancellation, and token handling work.
- Verify health permissions, labels, and data handling on each supported
  platform. Keep health records on-device unless the product explicitly
  requires otherwise and its disclosures accurately describe that behavior.
- Obtain explicit consent before sending personal content for AI processing.
  Update the privacy policy and store privacy disclosures to match actual
  server and SDK behavior.
- Verify account deletion, community reporting and blocking, content filtering,
  moderator response handling, account recovery, and email verification.
- Complete age rating, availability, export-compliance answers, support and
  privacy links, reviewer instructions, and authentic screenshots using
  verified product information.

Do not advertise features until they are implemented and tested. Do not submit
for review while release-critical checks remain incomplete.

## Cloud build from Windows

If the repository's manual GitHub Actions workflows are enabled, use the
simulator workflow for compilation checks and the signed TestFlight workflow
for distribution. The simulator artifact cannot be installed on a device or
uploaded to the store. A signed build requires correctly configured signing
secrets and an authorized store account. Check the platform's current billing
and runner policies before starting cloud builds.

## App Store submission

1. Confirm the final app record, ownership, bundle identifier, version, and
   capabilities in App Store Connect.
2. Complete privacy, age-rating, availability, export-compliance, support, and
   reviewer information using current, verified facts.
3. Capture authentic screenshots from the final iOS build for every supported
   device family.
4. Archive and validate a release build, upload it, and test it through
   TestFlight before requesting review.
5. Provide reviewer access and concise notes for features that require
   sign-in, permissions, AI requests, community moderation, account deletion,
   or purchases.
6. Submit only a tested build whose listing and disclosures accurately
   describe the shipped app.

See Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/),
and [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).