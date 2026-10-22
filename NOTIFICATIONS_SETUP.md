# Daily Compass phone notifications

The app now has opt-in daily check-ins, task/goal reminders, daily encouragement,
and owner announcements delivered to the Android notification tray. Reminders
are scheduled on the device and work without the app being open. Announcements
use Firebase Cloud Messaging (FCM). All options start off. Notification previews
exclude journal contents, task names, and health details.

## Connect announcements

1. Open https://console.firebase.google.com/ and create or select the Daily Compass
   project. Google Analytics is not required.
2. Register an Android app with package **com.kevthedev.dailycompass.mobile**.
3. Download its `google-services.json` into `android/app/google-services.json`.
   This is Android app configuration, not the server's private service-account key.
4. Enable the Firebase Cloud Messaging API (HTTP v1) in the project.
5. In Project settings > Service accounts, obtain a server service account
   authorized to send FCM messages. Store its JSON only in Render's secret
   environment variable **FIREBASE_SERVICE_ACCOUNT_JSON**. Never commit it or
   put it into the Android app. No server credentials belong in this repository.
6. Set **DAILY_COMPASS_ANNOUNCEMENT_EMAIL** on Render to the exact email of the
   Daily Compass account authorized to send announcements. The server compares
   this with the authenticated user's email; users cannot choose their role.
7. Deploy the server changes. Run `npm run android`, then build and sign the next
   release in Android Studio. Version 1.2.0 / code 4 has been prepared; verify
   that code 4 has not already been uploaded before publishing.
8. Update the app through the existing closed track. Each user opens
   **Notifications**, enables their choices, and grants Android notification
   permission. Announcements also register that phone with the server.
9. The configured owner sees **Send an app announcement** in Notifications.
   Review the text before sending. Only opted-in registered devices are targeted.

## Current configuration (October 21, 2026)

- Firebase project: `daily-compass-64dd1` (Spark).
- Android app registered as `com.kevthedev.dailycompass.mobile`.
- App ID: `1:713468585713:android:e3291e157609cfbf462b50`.
- Firebase Cloud Messaging HTTP v1 API is enabled.
- `android/app/google-services.json` contains the registered project's Android
  configuration, assembled from its console identifiers and Firebase-generated
  Android API key. The Android Google Services resource generation was verified.
- The dedicated sender `daily-compass-notifications@daily-compass-64dd1.iam.gserviceaccount.com`
  has the Firebase Cloud Messaging API Admin role. Its uploaded public
  certificate expires October 21, 2027; rotate the credential before then.
- `FIREBASE_SERVICE_ACCOUNT_JSON` and `DAILY_COMPASS_ANNOUNCEMENT_EMAIL` were saved
  in the existing Render service, using **Save only**. Owner email:
  `kevojiujitsu@gmail.com`. Existing secret values were preserved.
- The sender authenticated successfully with Google. No phone message was sent.
- Local private credentials are under `work/firebase-notification-secrets/`,
  excluded from Git and from the Android build. Never include them in uploads.
- `window.DAILY_COMPASS_PUSH_CONFIGURED` is true in the prepared app build.
- The Android debug build and automated notification checks pass. A signed
  release and deployment of the changed server code are still required before
  testers can use the complete feature. No new Play release was published.

Local reminders and the test notification do not need Firebase.

## Verify on an Android phone

- Install the updated build; no permission prompt should appear until requested.
- Open Notifications and send a test. Grant permission, background the app,
  and check the tray. Also test denial without a crash.
- Enable a daily check-in and encouragement. Verify the selected local times.
- Enable task reminders; choose a future time on a task in My Path. Background
  the app and verify notification delivery. Complete/delete the task before
  another scheduled reminder and confirm that it is cancelled.
- Turn each category off and verify its pending notifications are cancelled.
- Once Firebase is connected, enable announcements, send a test announcement
  from the owner account, and check a backgrounded second phone. A non-owner
  must not see the composer and receives HTTP 403 if attempting the endpoint.
- Verify notification taps open the relevant page after unlocking the app.
- Reboot and check pending reminders. Android force-stop, Do Not Disturb,
  battery restrictions, and system notification settings can delay/prevent
  delivery. Reminders use inexact alarms and do not request exact-alarm access.

The next 50 future task reminders are scheduled; opening the app refreshes the
queue. Daily schedules use the phone's local time. If timezone settings change,
reopen the app to refresh schedules. Server acceptance of FCM messages is not
proof of display on a phone. No live announcement was sent during development.
