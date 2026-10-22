# Daily Compass — Apple App Store preparation

Prepared October 22, 2026. Version 1.2.1, initial iOS build 1.

**Status: source prepared; not yet ready to submit to Apple.** There is no signed iOS app or App Store Connect listing yet. The Android release and live web deployment have not been changed by this preparation. Work is on the local `ios-app-store-prep` branch.

## Your next two steps

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/). Apple lists membership at US$99 per year (or local currency). Choose individual or organization based on who should own and publish the app. Complete identity checks, agreements, and payment yourself. Do not send Apple passwords or verification codes in chat.
2. Arrange access to a Mac with Xcode 26 or later. It may be your own or borrowed Mac; owning one is not required. Cloud Mac access is another option to evaluate once you choose a build workflow. This Windows computer cannot compile, sign, or run an iOS simulator build.

Apple's current [upload requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) require Xcode 26+ with an iOS 26+ SDK. The project's [Capacitor 8 toolchain](https://capacitorjs.com/docs/getting-started/environment-setup) also requires Xcode 26+.

## Prepared source

- Bundle ID aligned with Capacitor: `com.kevthedev.dailycompass.mobile` (availability still needs confirmation in your Apple account).
- Marketing version 1.2.1 and iOS build 1.
- Current home design, bottom navigation, and removed music player copied into the iOS web assets.
- Swift Package Manager wiring synchronized for health, local notifications, push notifications, and native purchases.
- HealthKit entitlement added, with purpose strings for health, camera, and photo access. No background health or write permissions were enabled.
- Opaque 1024 × 1024 app icon and matching dark launch images created from the existing Daily Compass vector logo.
- `npm run ios`, `npm run ios:open`, and `npm run ios:check` added.
- `scripts/prepare-ios-on-mac.sh` installs dependencies, synchronizes iOS, runs static checks, and opens Xcode. It does not submit a release.

Passed: Capacitor iOS synchronization, Xcode project syntax parsing, permission/entitlement checks, plugin wiring, matching bundle IDs, version settings, and icon dimensions/opacity. **Not run:** Swift compilation, signing, simulator/device tests, StoreKit sandbox tests, or TestFlight.

## Engineering blockers before TestFlight/App Review

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

You do not have to buy a Mac. A manual GitHub Actions workflow is included at `.github/workflows/ios-simulator.yml`. GitHub provides macOS runners with Xcode; [runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). The workflow has not been run or pushed and does not run automatically on commits.

Once installed on the repository's default branch, use GitHub → Actions → iOS simulator build (manual) → Run workflow. It installs locked dependencies, synchronizes the iOS project, and attempts an unsigned simulator build. No Apple membership or signing secrets are required for that compilation check. Its simulator artifact cannot be installed on an iPhone or uploaded to the App Store.

For the later signed release, configure Apple distribution signing and an App Store Connect upload workflow after enrollment. Store signing material as repository secrets, never in the repository or chat. A signed cloud build can then be uploaded to TestFlight for physical-iPhone testing. That signing/upload path is not implemented in this preparation workflow.

Standard public-repository runners are free; private-repository builds use included minutes and may incur charges after the allowance is exhausted. Check [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) before running. No cloud minutes have been started by this preparation.

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
