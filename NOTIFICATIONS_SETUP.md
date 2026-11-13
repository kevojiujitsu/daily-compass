# Daily Compass phone notifications

The app supports opt-in local reminders and owner announcements on Android.
Reminders are scheduled on the device and do not require the app to stay open.
Announcements use Firebase Cloud Messaging (FCM). Notification options start
off, and previews exclude journal contents, task names, and health details.

## Configure announcements

1. Open the Firebase console and create or select the project used by the app.
2. Register the Android app using the package identifier configured for this
   project.
3. Download the generated `google-services.json` to
   `android/app/google-services.json`. This file is Android app configuration;
   it is not the server's private service-account key.
4. Enable the Firebase Cloud Messaging API (HTTP v1).
5. Create or select a server service account authorized to send FCM messages.
   Store its JSON only in the hosting provider's secret environment variable
   `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit it or include it in the app.
6. Set `DAILY_COMPASS_ANNOUNCEMENT_EMAIL` on the server to the email address
   of the account authorized to send announcements. The server compares this
   value with the authenticated user's email.
7. Deploy the server and build a new Android release containing the Firebase
   configuration. Follow the platform's current signing and publishing
   guidance.
8. After installing the updated build, users can opt in under Notifications
   and grant Android notification permission.
9. The authorized account can send an announcement from Notifications.
   Announcements target only opted-in, registered devices.

## Verify on an Android phone

- Install the updated build. Confirm that permission is requested only when
  needed, and test both grant and denial.
- Enable daily check-ins and encouragement, background the app, and verify
  the selected local times.
- Schedule a future task reminder, then complete or delete the task and
  confirm the reminder is cancelled.
- Turn each category off and verify its pending notifications are cancelled.
- Once FCM is configured, test an announcement on a separate opted-in device.
  Confirm a non-owner cannot see the composer and receives HTTP 403 if it
  attempts the endpoint.
- Verify notification taps open the relevant page after unlocking the app.
- Reboot and check pending reminders. Force-stop, Do Not Disturb, battery
  restrictions, and system settings may delay or prevent delivery.

The app schedules up to the next 50 future task reminders and refreshes the
queue when opened. Daily schedules use the phone's local time; reopen the app
after changing time-zone settings. Server acceptance of an FCM message does
not prove it was displayed on a device.