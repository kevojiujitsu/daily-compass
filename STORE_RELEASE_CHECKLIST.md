# Daily Compass — Android / Google Play release checklist

Updated October 15, 2026

## Android setup already present

- Capacitor Android project: `android/`.
- App name: Daily Compass.
- Application ID: `com.dailycompass.app` (check availability before publishing; changing it later is difficult).
- Minimum Android API: 24; compile and target API: 36.
- Version: `1.0` / version code `1`.
- Android build command: `npm run android` (builds the web assets and syncs Capacitor).
- The old iOS instructions have been removed from the build path; this release plan is Android-only.

## Do these next

1. **Create a Google Play Console developer account.** The owner will need to complete Google's identity and account verification. Google currently charges a one-time US$25 registration fee. If this is a new personal account, Google requires a closed test with at least 12 testers opted in continuously for 14 days before the owner can apply for production access.
2. **Install Android Studio and its Android SDK.** Install a JDK supported by the project's Android Gradle Plugin, then open this project's `android/` folder in Android Studio. Build and run the app on a physical Android phone before preparing a store release.
3. **Deploy the AI server publicly over HTTPS.** Host `server.mjs`, set `OPENAI_API_KEY` as a server-side environment variable, and set `ALLOWED_ORIGINS` appropriately. Never put the API key in the Android app.
4. **Configure the native app with the hosted API URL.** In PowerShell, set `$env:DAILY_COMPASS_API_BASE = 'https://your-api.example.com'`, then run `npm run android`. Without this setting, the native app will not use the online AI service.
5. **Publish the privacy policy.** Review `privacy.html` and `privacy-policy-draft.md`, then host the policy at a public HTTPS URL. Use the same URL and matching data disclosures in Play Console. The policy currently lists `kwjiujitsu@gmail.com`.
6. **Prepare the Play listing and testing.** Add the store description, support contact, screenshots, content rating, Data safety answers, and target age group. The app requires users to be 18 or older; set the Play target audience and access controls to match that intent.
7. **Create a signed Android App Bundle.** In Android Studio, create and securely back up the upload key, generate a signed `.aab`, and upload it to the internal or closed testing track. Do not share the signing key or its passwords.

## Free plan and Compass Plus

- The in-app US$1.99/month Compass Plus card is a preview; users cannot buy it yet.
- Google Play requires Google Play Billing for digital app features and subscriptions.
- The Free limit of 10 AI reflections/month is now checked and recorded on the server per email account. Account records are stored in `data/accounts.json`; deploy with `DAILY_COMPASS_DATA_DIR` pointed to a durable, access-controlled persistent volume. This JSON store is for a single server instance; migrate to a managed database before running multiple instances or scaling.
- The proposed Plus limit (30 reflections/month) and extended journal history must be implemented and accurately described before selling the plan. Subscription screens must clearly disclose the price, billing period, renewal, and cancellation terms.

## Release blockers to resolve before public launch

- Google Play Console account is not yet set up.
- The public HTTPS AI service and privacy-policy URL are not configured.
- This environment did not detect a Java/JDK or Android SDK, so it cannot produce a signed Android bundle here yet.
- Play Billing and server-side subscriber verification are not connected; Plus is not purchasable and all accounts remain on Free until a verified Google Play entitlement is implemented.
- This starter has no email verification or password recovery yet. Until email addresses are verified, people could create additional accounts with other addresses; add verification and recovery, configure and back up persistent server storage, and review account-data deletion/retention before public release.
- Listing materials, ratings, Data safety disclosures, and any required closed test remain to be completed in Play Console.

## Official Google Play guidance

- Target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Closed testing for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- Subscription policy: https://support.google.com/googleplay/android-developer/answer/9900533
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
