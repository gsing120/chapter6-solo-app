# Deploying chapter6-solo-app

Recommended host: **Render.com** (free tier supports WebSockets and gives HTTPS).

---

## One-time setup

### 1. Push the project to GitHub
```bash
cd chapter6-solo-app
git init
git add .
git commit -m "initial"
# Create a private repo on GitHub, then:
git remote add origin git@github.com:<you>/chapter6-solo-app.git
git push -u origin main
```
The repo includes a `.gitignore` that excludes `.env` and `node_modules`.

### 2. Create the Render web service
1. Go to https://render.com → sign up with your GitHub account.
2. **New +** → **Web Service** → connect your `chapter6-solo-app` repo.
3. Render will auto-detect `render.yaml`. Confirm:
   - Runtime: **Node**
   - Plan: **Free**
   - Build command: `npm install`
   - Start command: `node server.js`
   - Health check path: `/healthz`
4. **Environment variables** — paste your real values:
   - `GEMINI_API_KEY` = your paid key
   - `GEMINI_MODEL` = `gemini-3-flash-preview` (default)
   - `GEMINI_TTS_MODEL` = `gemini-2.5-flash-preview-tts`
   - `GEMINI_TTS_VOICE` = `Kore` (or `Puck`, `Charon`, `Zephyr`, `Leda`, etc.)
5. Click **Create Web Service**. First build takes ~3 min.

You'll get a URL like `https://chapter6-solo-app.onrender.com`.

### 3. Verify
- `https://<your-url>/presenter` — opens presenter view
- `https://<your-url>/` — student view
- `https://<your-url>/healthz` — should return `{"ok":true,...}`

The QR code automatically uses the public URL when running behind the proxy.

---

## On the day of class

### Wake the server before class
Render's free tier sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake.

**Option A — open the URL 2 minutes before class:**
Just hit `https://<your-url>/healthz` from your phone or laptop.

**Option B — keep awake permanently (free):**
1. Sign up at https://uptimerobot.com (free).
2. Add a new HTTP(s) monitor pointing to `https://<your-url>/healthz`, interval **5 minutes**.
3. Server will never sleep.

### Sharing the URL with students
- Project the presenter view on the classroom screen — the QR code is huge in the lobby and a small QR sticks in the top-right of every slide.
- The persistent URL displays under the QR. Students on data plans, uni Wi-Fi, or hotspot all reach the same address — no LAN dependency.
- Optional: register a short URL (e.g. `bit.ly/nur3035-ch6`) in case scanning fails.

---

## Cost ballpark
- **Render free tier:** $0 (750 hrs/month, sleeps when idle)
- **Gemini API:** ~$0.05–$0.30 per 30-min session (text + TTS combined)
- **Total per class:** under $0.50.

---

## Alternatives
- **Railway** — $5 trial, no sleep, same simple deploy.
- **Fly.io** — free tier, more setup.
- **Vercel** — ❌ does not support persistent WebSockets, won't work.

---

## Troubleshooting
- **QR code shows wrong URL** → set `PUBLIC_URL` env var on Render to your full HTTPS URL.
- **Audio doesn't play on the laptop** → click anywhere on the page once before pressing Start. Browsers block autoplay until first user gesture.
- **Students see "Connecting…" forever** → check that the host's WebSocket upgrade is allowed. Render handles this automatically; if you switch hosts, verify `wss://` is open.
- **First load slow** → cold start. Wake the server before class.
