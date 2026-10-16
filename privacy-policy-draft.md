# Daily Compass privacy policy draft

Last updated: October 15, 2026

Daily Compass is intended for users age 18 and older. Journal, mood, task, work, health, and habit entries are stored locally on the device. The local app storage also contains the account name, age, email, and sign-in session token. The server stores account name, age, email address, a salted password hash, hashed sign-in session tokens, and the monthly AI reflection count. The server does not store journal entry text. Passwords are used to sign in and do not encrypt entries on the device. No analytics are currently used.

When users tap “Reflect on this day + past 30 days,” the app sends entries for the selected day and up to 60 journal notes from the previous 30 days (including dates and optional moods) to its server, which forwards them to OpenAI to generate a detailed summary, highlights, and advice. Store builds should use HTTPS; local development previews may use HTTP and should use test entries only. The user's email, name, age, and password are not included in the AI request. The server records successful AI reflections against the monthly account allowance, does not save entry text, and requests a non-stored API response. OpenAI may process or retain API data under the account's settings and applicable policies. When online AI is unavailable, the app uses simple local guidance.

Users can delete individual entries or use “Delete my profile and all entries” in the app to remove the server-side account and the local profile and entries on the device used for deletion. There is no password reset, account recovery, or journal-entry backup.

Optional relaxing music is generated in the app on the device. Music selection and playback are not sent to the app server.

Privacy contact: kwjiujitsu@gmail.com. Before release, review this draft, publish the final policy at a public HTTPS URL, and make sure store disclosures match the actual app behavior.
