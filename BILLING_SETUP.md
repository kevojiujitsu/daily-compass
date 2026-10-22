# Compass Plus Google Play billing

The Android app uses Google Play Billing through `@capgo/native-purchases`.

## Product values

- Subscription product ID: `compass_plus`
- Base plan ID: `monthly`
- Billing period: 1 month, auto-renewing
- Price selected: USD 1.99/month (Google Play displays localized pricing by storefront)
- Free allowance: 10 AI uses/month
- Compass Plus allowance: 30 AI uses/month

## Required setup before purchases can complete

1. Build and sign an Android App Bundle with version code 3. The app manifest includes the Google Play billing permission and the native Capacitor billing plugin.
2. Upload the bundle to the internal testing track. Add the subscription product `compass_plus` with the `monthly` auto-renewing base plan and the selected monthly price. Make the product available to the test countries and activate the base plan for testing.
3. In Google Cloud, create a service account for server-side subscription verification and enable the Google Play Android Developer API. Grant that service account the Play Console permission needed to view and acknowledge subscriptions for this app.
4. Set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` in the Render service to the service-account JSON key, and set `GOOGLE_PLAY_SUBSCRIPTION_ID=compass_plus` and `GOOGLE_PLAY_BASE_PLAN_ID=monthly`. Keep the JSON key private; never add it to the app bundle or repository.
5. Deploy the updated `server.mjs` to Render. The server verifies Google purchase tokens before granting Compass Plus and acknowledges confirmed subscriptions.
6. Add license testers in Play Console and install the app from the internal testing link to check purchases without a real charge.

The app queries the current localized price from Google Play and only offers the purchase flow on Android. It refreshes the subscription at sign-in, supports restoring purchases and opens Google Play's subscription manager. Production rollout should wait until internal testing and the account deletion/privacy review are complete.
