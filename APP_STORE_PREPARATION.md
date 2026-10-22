## Latest progress — October 22, 2026

Build 2 is prepared with iPhone/iPad Apple purchase UI, signed transaction verification using Apple’s official server library and root certificates, renewal/refund notifications, per-request AI consent, iOS local reminders, Apple Health labels and heart-rate response parsing, a privacy manifest, and updated privacy disclosures. The unused crypto-js dependency is removed from mobile assets; the app uses platform encryption and declares no non-exempt encryption in Info.plist.

Compass Plus product `compass_plus_monthly` (Apple ID 6825659732), group 22502959, is created for one month at US$1.99 with Apple’s regional equivalents and all 175 supported storefronts selected. English display text is saved. The Paid Apps Agreement is still New and EU trader compliance is incomplete. The owner must finish the agreement, tax/banking and trader requirements. Purchases remain disabled by the backend until setup is ready.

Passed: Apple purchase business-rule and forged-signature tests, actual local API authorization/rejection tests, existing notification tests, browser integration tests at iPhone 390×844 and iPad 820×1180 with mocked native plugins, Capacitor sync and static iOS checks. Browser test screenshots are fixtures, not native App Store screenshots. Real StoreKit sandbox, refund/renewal delivery and physical-device testing remain.

Configure Render `APPLE_BILLING_ENABLED=true` only after the product/account setup is ready, and `APPLE_SANDBOX_EMAILS` for the actual Daily Compass tester account emails. In App Store Connect App Information, set production and sandbox Server Notifications V2 URL to `https://daily-compass-api.onrender.com/api/billing/apple/notifications`. No signing/upload key is needed by this endpoint; it verifies Apple signatures. Family Sharing is off and billing grace period is not enabled.

Other public-release work: final App Privacy and age-rating declarations, reviewer sign-in account, authentic iPhone/iPad screenshots, community content-filtering audit, account recovery, and device validation. Do not submit for App Review until these are complete.

---

# Daily Compass — Apple App Store preparation

Prepared October 22, 2026. Version 1.2.1, initial iOS build 1.

**Status: source prepared; not yet ready to submit to Apple.** Version 1.2.1 build 1 has been signed, archived, exported, and uploaded to App Store Connect successfully. The App Store Connect draft has been created: https://appstoreconnect.apple.com/apps/6825649471/distribution The Android release and live web deployment have not been changed by this preparation. Work is on the local `ios-app-store-prep` branch.

## Current setup

Apple Developer membership is active. Builds use GitHub’s cloud Mac with Xcode 26.2, so a personal Mac is not required. The total authorized cloud-build budget is US$5. Signing credentials are encrypted GitHub secrets; retain a secure personal backup of the one-time-download API key.

Apple's current [upload requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) require Xcode 26+ with an iOS 26+ SDK. The project's [Capacitor 8 toolchain](https://capacitorjs.com/docs/getting-started/environment-setup) also requires Xcode 26+.

## Prepared source

- Bundle ID aligned with Capacitor: `com.kevthedev.dailycompass.mobile` (registered in your Apple account).
- Marketing version 1.2.1 and iOS build 1.
- Current home design, bottom navigation, and removed music player copied into the iOS web assets.
- Swift Package Manager wiring synchronized for health, local notifications, push notifications, and native purchases.
- HealthKit entitlement added, with purpose strings for health, camera, and photo access. No background health or write permissions were enabled.
- Opaque 1024 × 1024 app icon and matching dark launch images created from the existing Daily Compass vector logo.
- `npm run ios`, `npm run ios:open`, and `npm run ios:check` added.
- `scripts/prepare-ios-on-mac.sh` installs dependencies, synchronizes iOS, runs static checks, and opens Xcode. It does not submit a release.

Passed: Capacitor iOS synchronization, Xcode project syntax parsing, permission/entitlement checks, plugin wiring, matching bundle IDs, version settings, and icon dimensions/opacity. **Now passed:** Xcode 26.2 Swift compilation and iPhone simulator launch. **Now passed:** distribution signing, archive/export, and App Store Connect upload. **Not run:** physical-device feature tests or StoreKit sandbox tests. Apple processing and TestFlight configuration remain.

## Engineering blockers before public release

### Apple purchases

The current Plus screen and backend purchase-verification route support Google Play. Install-time inclusion of the native purchases plugin does not implement Apple billing. Before offering Plus on iPhone:

- Create the Compass Plus subscription and subscription group in App Store Connect; confirm product identifier, price, and renewal period.
- Implement the iOS product lookup, purchase, restore, cancellation handling, and manage-subscription screen.
- Add server-side Apple transaction verification and account binding; handle expiry, refunds, revocation, and renewal notifications. Never enable Plus solely from a client assertion.
- Provide the price/period, renewal information, Privacy Policy, and Terms of Use on the subscription screen.
- Test with StoreKit and Apple's sandbox. Do not ship the present Android-only purchase message on iPhone.

See [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), section 3.1.

### Reminders and announcements

`notifications.js` currently gates native notification behavior to Android and creates Android channels. Add an iOS path for local reminders, including the iOS pending-notification limit and opt-out/cancellation tests. Do not invoke Android-only channel APIs on iOS.

Announcement delivery currently uses Firebase registration tokens. The iOS Capacitor push plugin supplies APNs tokens; these must not be sent to the existing FCM-only server route. Choose and implement an APNs delivery path or a compatible Firebase Messaging bridge, configure the Apple push capability and credentials, and test on a physical iPhone. No Apple push credentials have been created.

### Apple Health

The health plugin supports iOS, but the current UI describes Android Health Connect. Adapt those labels and permission messages for Apple Health. Test steps, calories burned, and heart rate on an iPhone; handle missing data and denied access gracefully. Keep native health records on-device. The new entitlement and purpose strings are configuration preparation, not proof of a working HealthKit integration.

### AI consent, privacy, and community

- Add an explicit permission step before sending notes, moods, tasks, or personal preferences through the Daily Compass server to OpenAI. A disclosure footer alone is not the intended explicit-consent flow.
- Update the privacy policy for the final iOS implementation and complete App Store Connect App Privacy answers from actual server/SDK behavior. Review third-party retention and collected-data categories; do not select “Data Not Collected.”
- Audit included SDK privacy manifests and required-reason APIs with Xcode's privacy report. A complete app-level privacy declaration has not been invented or submitted.
- Confirm account deletion removes the account and associated content. For Apple subscribers, explain that account deletion does not cancel the App Store subscription.
- Community already includes reporting, blocking, and a moderation path. Verify objectionable-content filtering (including photos), moderator response handling, and the published support contact before review.
- Finish account recovery and email verification before a public launch.

See [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), sections 1.2 and 5.1, and [account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

## Draft listing text

Name: Daily Compass

Subtitle: Journal, tasks & daily habits

Suggested primary category: Lifestyle. Confirm the final category in App Store Connect.

Keywords: journal,mood,tasks,habits,reflection,wellness,planner,daily

Description draft — use after the corresponding iPhone features pass testing:

Daily Compass is a calm place to bring your day into focus.

Write a journal note, check in with your mood, and make space for the tasks that matter. Review today's entries and a short reflection, with small wins and summaries available when you want them.

- Capture thoughts and daily moments.
- Organize tasks with due dates and energy levels.
- Keep track of habits and your own food calorie notes.
- Request AI reflections and planning help when you choose to share the relevant information.
- Share moments with accepted friends, with reporting and blocking controls.

Journal entries are saved on your device. AI requests send the relevant information to the Daily Compass service and OpenAI. Account and community features need an internet connection. Daily Compass is intended for adults age 18 and older and is not a medical service.

Do not advertise Apple Health syncing, iPhone reminders, Apple subscriptions, or push announcements until they are implemented and tested. Add subscription terms after Apple product configuration is confirmed. Obtain actual support website and review-contact details before submission.

Privacy URL currently hosted: https://daily-compass-api.onrender.com/privacy.html

Account deletion URL currently hosted: https://daily-compass-api.onrender.com/delete-account.html

Existing public support contact: kwjiujitsu@gmail.com — confirm this remains the desired contact.

## Work from Windows with a cloud Mac

You do not have to buy a Mac. A manual GitHub Actions workflow is included at `.github/workflows/ios-simulator.yml`. GitHub provides macOS runners with Xcode; [runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). The workflow is installed on the default branch and remains manual-only. Cloud compilation and an iPhone simulator launch have passed.

Once installed on the repository's default branch, use GitHub → Actions → iOS simulator build (manual) → Run workflow. It installs locked dependencies, synchronizes the iOS project, and attempts an unsigned simulator build. No Apple membership or signing secrets are required for that compilation check. Its simulator artifact cannot be installed on an iPhone or uploaded to the App Store.

For the later signed release, configure Apple distribution signing and an App Store Connect upload workflow after enrollment. Store signing material as repository secrets, never in the repository or chat. A signed cloud build can then be uploaded to TestFlight for physical-iPhone testing. The separate manual `ios-testflight.yml` workflow now installs encrypted signing secrets, archives, exports, and uploads to App Store Connect.

Standard public-repository runners are free; private-repository builds use included minutes and may incur charges after the allowance is exhausted. Check [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) before running. Two successful cloud runs used about five rounded billable minutes, approximately US$0.31 at the listed US$0.062/minute rate before any included allowance. The authorized total budget is US$5; track future runs against that total.

## Mac build handoff

1. Extract the source archive to a normal local folder on the Mac.
2. Install a Node version supported by Capacitor 8 (Node 22 or later) and Xcode 26 or later.
3. From the project folder run `bash scripts/prepare-ios-on-mac.sh`.
4. In Xcode select the App target → Signing & Capabilities → your Apple Developer team. Verify the bundle ID and HealthKit capability. Enable push only once its integration is complete.
5. Finish the engineering blockers above. Run on simulator and physical iPhone; test layout on iPad because the target currently supports iPhone and iPad.
6. Create the app record in App Store Connect. Set ownership, privacy, age-rating questionnaire, availability, export-compliance answers, support URL, and reviewer information from verified facts.
7. Capture authentic screenshots from the final iOS build. Do not submit the Android/browser previews as iOS screenshots. See Apple's [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications); iPad screenshots are needed while iPad support remains enabled.
8. Archive in Xcode for a generic iOS device, validate, and distribute to App Store Connect. Start with TestFlight and resolve crashes or permission/purchase failures before App Review.
9. Supply a working reviewer account and clear notes on AI requests, health permissions, community moderation, account deletion, and purchases. See Apple's [review information requirements](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review).
10. Select a tested build, associate any first subscriptions, and submit for App Review. Apple approval is required before public release.

The source archive contains no Apple credentials, Android upload key, Firebase service-account secrets, or local account database. It is a preparation package, not an installable `.ipa`.

## Activated account and current handoff

- Apple Developer membership verified active October 22, 2026.
- Apple Team ID: Z9BXH892FC, now connected in the Xcode project.
- Bundle ID registered: com.kevthedev.dailycompass.mobile. HealthKit capability enabled and App Store distribution profile generated.
- Apple app ID: 6825649471.
- Store name: Daily Compass: Journal & Tasks (the shorter name was already taken).
- Draft version: 1.2.1; Lifestyle primary, Productivity secondary.
- Public support page: https://daily-compass-api.onrender.com/support.html
- Compile run: https://github.com/kevojiujitsu/daily-compass/actions/runs/39730031175 — successful.
- Compile and iPhone launch run: https://github.com/kevojiujitsu/daily-compass/actions/runs/39730302094 — successful.
- App Store Connect API access enabled with explicit agreement approval. A Developer-role upload key, Apple Distribution certificate, and App Store profile are created. Six credential values are stored as encrypted GitHub repository secrets. No private key contents are included in this package.
- Signed build workflow: `.github/workflows/ios-testflight.yml`, manual-only, 30-minute timeout. Successful signed build and upload: https://github.com/kevojiujitsu/daily-compass/actions/runs/39733160938 . Workflow signing settings are scoped to the App target.
- The remaining engineering blockers above still apply. The simulator welcome-screen screenshot demonstrates launch, not end-to-end feature testing or App Review readiness.

## Signed upload result

October 22, 2026: Apple uploader confirmed “UPLOAD SUCCEEDED with no errors” for version 1.2.1 build 1. Delivery UUID: 10c3b0f5-894c-4f8e-8ac0-6199e6be92d5. This confirms transport acceptance, not App Review approval. The signed IPA is saved separately. App Review contact details were saved in App Store Connect.

Five total cloud runs used approximately nine rounded minutes, at most US$0.558 before included allowances and minimal artifact storage. The authorized budget remains US$5.

Apple processing completed. TestFlight now lists build 1 with “Missing Compliance”; the encryption declaration has not been submitted. Audit the unused bundled crypto-js file and third-party SDKs before choosing the declaration. Public release still requires iPhone feature work, device testing, privacy/age-rating answers, screenshots, and review credentials.
