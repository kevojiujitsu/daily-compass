# Daily Compass

Daily Compass is a blue daily journal for journal and mood notes, tasks and work notes, and health and habit check-ins. Journal entries stay on the device; account name, age, email, password hash, sign-in session hashes, and AI usage are stored on the server. The app includes a date picker for browsing entries, expanded mood options, a task list with completion and due dates, and optional browser-generated relaxing music with track and volume controls. Music is generated on the device and is not sent to a service. When someone asks for a reflection, entries for the selected day and up to 60 journal entries from the preceding 30 days are sent to the online AI service. Name, age, email, and password are not sent with AI reflection requests.

## Run on a laptop

1. Copy the full `daily-compass` folder to your laptop and open it in VS Code.
2. Install Node.js 22 or newer.
3. For online AI, set your OpenAI API key in the terminal. The key stays on the server and is never placed in the app files:

   ```powershell
   $env:OPENAI_API_KEY = 'your-api-key'
   node server.mjs
   ```

   If you omit the key, the app still runs and provides simple local guidance.

4. Open http://localhost:3000. To preview on a phone over your Wi-Fi, open the `Phone preview` address printed by the server. Keep the laptop server running.

When you request a reflection, the server sends the selected day's entries and journal history from the preceding 30 days to OpenAI. The reflection includes a detailed summary, patterns from prior journal notes, highlights, and longer advice for each selected-day entry. The server does not save entry text, records successful reflections against each account’s monthly allowance, and sets `store: false` on the API request. Provider-side processing and retention depend on your OpenAI account and policies.


## Server account data

The server stores account emails, names, ages, salted password hashes, hashed session tokens, and monthly reflection counts in data/accounts.json. Set DAILY_COMPASS_DATA_DIR to a durable, access-controlled persistent volume in production. If that storage is ephemeral, restarts or redeploys can erase accounts and reset quotas. Keep backups protected and configure account deletion and retention before public launch.

## Deploy online AI for native apps

The native app needs a public HTTPS backend because API keys and account passwords must never be sent over an unencrypted public connection or embedded in a mobile app. For local HTTP phone previews, use a test email and a unique test password only. Deploy `server.mjs` to a Node.js host, set `OPENAI_API_KEY` there, and set `ALLOWED_ORIGINS` to your website plus Capacitor origins (`capacitor://localhost,https://localhost`). The server includes account authentication, monthly quotas, and basic per-IP request limits. Before public launch, add email verification and password recovery, stronger abuse controls, monitoring, and a privacy-reviewed data retention configuration.

Before building the Android app, set its HTTPS backend URL:

```powershell
$env:DAILY_COMPASS_API_BASE = 'https://your-api.example.com'
npm install
npm run android
```

The build writes the public backend URL into `app-config.js`; this URL is not secret. The API key remains only in the server environment. Without `DAILY_COMPASS_API_BASE`, the native app uses local guidance and cannot reach the hosted AI service.

### Render setup

The included `render.yaml` is a Render Blueprint for the API server. It uses a paid single-instance Node web service and attaches a persistent disk at `/var/data` for account records. Render provides HTTPS for the service URL. The single-instance setting is required because this starter uses a local JSON account store; do not scale it to multiple instances.

1. Put this `daily-compass` folder in a GitHub repository. The repository root should contain `render.yaml`, `package.json`, and `server.mjs`.
2. In Render, create a new Blueprint and connect that repository. Review the service and disk it will create before applying it.
3. When Render prompts for `OPENAI_API_KEY`, enter the OpenAI API key as a secret environment variable. Never commit the key to GitHub or put it in `app-config.js`.
4. After deployment, open the service's HTTPS URL followed by `/api/status`. Confirm it returns JSON with `aiReady: true` and `accountAuthReady: true`.
5. Use the final HTTPS service URL in the native app build:

   ```powershell
   $env:DAILY_COMPASS_API_BASE = 'https://your-service-name.onrender.com'
   npm install
   npm run android
   ```

6. Install and try the Android build with a test account before sharing it. Keep the Render disk attached: it holds account and reflection-usage records. Back up this data securely.

The Render Blueprint requires a paid service because its account store needs persistent storage. Render's free web services use an ephemeral filesystem; account records could be lost on restarts or deployments without persistent storage. Review current Render plan and disk pricing before creating the service. Deploying also requires a GitHub repository and a Render account.

## Store builds

For Android, install Android Studio and its SDK, then open the `android` folder and create a signed App Bundle (`.aab`) for Google Play. Google Play requires a developer account, store listing, screenshots, privacy disclosures, ratings, testing, and review. Store acceptance is decided by Google.

Before release, choose final app identifiers in `capacitor.config.json`, publish a public HTTPS privacy policy, and test the app on real devices. The password signs into an account but does not encrypt local journal entries. There is no password reset or journal-entry cloud backup in this starter.
