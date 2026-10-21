# Hosting the SiteFlow sync server

The phones talk to this Express server, and it talks to MongoDB Atlas. Atlas is already
remote, so the only thing that has to change for family members to sync from anywhere is
**where this server runs**.

While it runs on a laptop it is only reachable at a LAN address like `http://10.13.28.123:5050`,
which works only on that same Wi-Fi, and only while the laptop is switched on.

---

## What the app does with no server at all

This is the state a freshly installed APK is in, and it is a supported one. The app never
guesses an address: with nothing configured it simply runs on its own.

Working, entirely on the phone:

- creating, editing and deleting bills and quotations
- registering payments and settlements
- PDF letterheads and Excel exports, and sharing both
- contractor profile, presets, sign-up and sign-in

Needing a server, and saying so plainly when there isn't one:

- sharing bills between two phones
- **Forgot Password**, because only the server can send the emailed code

An account created while there is no server lives on that phone alone. The first sign-in
that does reach a server uploads it automatically, so the other phone can then see that
person - no re-registration needed.

---

## Option A - Vercel (Recommended: Free, Instant Serverless, Zero Maintenance)

1. Push this repository to GitHub (it can stay private).
2. Sign in at <https://vercel.com> with your GitHub account.
3. Click **Add New... > Project** and click **Import** next to `SiteFlow`.
4. In **Configure Project**:
   - **Framework Preset**: `Other`
   - **Root Directory**: Click **Edit**, choose the `server` folder, and click **Continue**. *(Crucial step: must be `server`)*
5. Add the **Environment Variables** (copy values from your local `server/.env`):
   - `MONGODB_URI`
   - `DB_NAME` (`siteflow_db`)
   - `SMTP_EMAIL`
   - `SMTP_APP_PASSWORD`
6. Click **Deploy**. Vercel will deploy your serverless backend in under a minute and give you a public URL like `https://siteflow-server.vercel.app`.
7. **Allow Vercel to reach Atlas**:
   - Atlas dashboard > **Network Access** > **Add IP Address** > `0.0.0.0/0` (allow from anywhere).
8. Verify it works in your browser:
   - `https://your-vercel-domain.vercel.app/api/health` (should return `{"status":"ok", "database":"connected"}`)
9. In the app on both phones:
   - Go to **Settings > Cloud Sync Server**, paste your Vercel URL, and tap **Test & Save**.

---

## Option B - Render (free, always reachable)

1. Push this repository to GitHub (it can stay private).
2. Sign in at <https://render.com> with GitHub.
3. **New > Web Service**, pick the SiteFlow repository.
4. Render reads `render.yaml` at the repo root and fills in the settings. If you configure
   it by hand instead:
   - Root directory: `server`
   - Build command: `npm install --omit=dev`
   - Start command: `node server.js`
   - Health check path: `/api/health`
5. Add the environment variables (**Environment** tab). Copy the values out of your local
   `server/.env`:
   - `MONGODB_URI`
   - `DB_NAME` (`siteflow_db`)
   - `SMTP_EMAIL`
   - `SMTP_APP_PASSWORD`
6. Deploy. You get a URL like `https://siteflow-sync.onrender.com`.
7. **Allow Render to reach Atlas**: Atlas dashboard > **Network Access** > *Add IP Address* >
   `0.0.0.0/0` (allow from anywhere). Without this Atlas refuses the connection and every
   request fails. The database still requires the username and password.
8. Confirm it works - this should return `{"status":"ok", ...}`:
   ```
   https://siteflow-sync.onrender.com/api/health
   ```
9. In the app: **Settings > Cloud Sync Server**, paste the URL, tap **Test & Save**. Do this
   once on every phone.

Free tier note: the service sleeps after ~15 minutes idle, so the first sync after a quiet
period takes up to a minute to wake. Subsequent syncs are fast. A paid instance removes this.

---

## Option B - Cloudflare Tunnel (quick demo, laptop must stay on)

```bash
npm run server                      # in one terminal
cloudflared tunnel --url http://localhost:5050
```

`cloudflared` prints a public `https://<random>.trycloudflare.com` address. Paste it into
**Settings > Cloud Sync Server**. The address changes every restart unless you attach a
domain, and syncing stops when the laptop sleeps - fine for a demo, not for daily family use.

---

## Baking the URL into the APK

So family members do not have to type anything, put the address in `app.json`:

```json
"extra": {
  "apiUrl": "https://siteflow-sync.onrender.com"
}
```

Then rebuild:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

A value saved in **Settings > Cloud Sync Server** always overrides this, so the field stays
useful as an escape hatch if the address ever changes.

Once the address is `https://`, cleartext HTTP is no longer needed. You can remove
`usesCleartextTraffic` from the `expo-build-properties` plugin in `app.json` and rebuild,
which stops the app sending passwords in the clear.

---

## Security checklist before wider use

- Rotate the Atlas password and the Gmail app password - both were committed to git history
  and the repository was public.
- Keep `server/.env` out of git (already in `.gitignore`).
- Prefer restricting Atlas Network Access to your host's egress IPs rather than `0.0.0.0/0`
  if your plan supports static outbound addresses.
