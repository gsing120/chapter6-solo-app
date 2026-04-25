# GCP setup — always-free e2-micro VM + HTTPS via Cloudflare Tunnel

Total time: ~30 minutes. Total cost: $0/month (always-free tier).

You'll do everything from your browser via **Google Cloud Shell** — no installs needed locally.

---

## Phase 0 — Prep (one-time, 5 min)

### 0.1 Push the project to GitHub
On your laptop:
```bash
cd /Users/gurveeruppal/Desktop/Summer/chapter6-solo-app
git init
git add .
git commit -m "Chapter 6 solo app"
```
Create a **private** repo on github.com (call it `chapter6-solo-app`), then:
```bash
git remote add origin https://github.com/<YOUR-USERNAME>/chapter6-solo-app.git
git branch -M main
git push -u origin main
```
The `.gitignore` keeps `.env` out, so your key stays off GitHub.

### 0.2 Have these handy
- Your GitHub repo URL: `https://github.com/<you>/chapter6-solo-app.git`
- Your Gemini API key: starts with `AIza…`
- A Google account (the one your Gemini billing is on)

---

## Phase 1 — Create the VM (10 min)

### 1.1 Open Google Cloud Console
Go to **https://console.cloud.google.com** → if you have a project for Gemini billing, select it. Otherwise click the project picker → **New Project**, name it `chapter6-classroom`, create.

### 1.2 Enable Compute Engine
Search bar → "Compute Engine" → **Enable** (first time only, ~30 sec).

### 1.3 Open Cloud Shell
Click the **>_** terminal icon in the top-right of the console. A bash terminal opens at the bottom — already authenticated as you, with `gcloud` ready.

### 1.4 Paste these commands, in order

**Set your project ID** (replace if your project name differs):
```bash
PROJECT_ID=$(gcloud config get-value project)
echo "Working in project: $PROJECT_ID"
```

**Create the always-free e2-micro VM:**
```bash
gcloud compute instances create chapter6-app \
  --machine-type=e2-micro \
  --zone=us-central1-a \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=10GB \
  --tags=http-server,app-3000
```
> The free tier requires **us-west1, us-central1, or us-east1** zones and `e2-micro`. We're using us-central1-a.

**Open the firewall on port 3000:**
```bash
gcloud compute firewall-rules create allow-app-3000 \
  --allow=tcp:3000 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=app-3000
```

**Get the VM's external IP** (you'll use this to test):
```bash
gcloud compute instances describe chapter6-app \
  --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```
Note this IP — call it `<VM_IP>` for the rest of the guide.

---

## Phase 2 — Install the app (10 min)

### 2.1 SSH into the VM (still in Cloud Shell)
```bash
gcloud compute ssh chapter6-app --zone=us-central1-a
```
You're now on the VM (prompt looks like `<your-name>@chapter6-app:~$`).

### 2.2 Run the setup script
Replace the placeholders with your real values, then run:
```bash
curl -fsSL https://raw.githubusercontent.com/<YOUR-USERNAME>/chapter6-solo-app/main/gcp-setup.sh \
  | bash -s -- https://github.com/<YOUR-USERNAME>/chapter6-solo-app.git AIza...your_real_key
```

The script will:
- Install Node.js 20 + git
- Clone your repo to `~/chapter6-solo-app`
- Run `npm install`
- Write `.env` with your Gemini key
- Create a systemd service `chapter6.service` that auto-restarts on crash and on reboot
- Start the service

Final output should show `Active: active (running)`.

### 2.3 Quick local test
```bash
curl -s http://localhost:3000/healthz
# → {"ok":true,"phase":"LOBBY"}
```

### 2.4 Test from outside
On your phone or laptop browser: **`http://<VM_IP>:3000/presenter`**
You should see the lobby with the QR code.

> The QR will show `http://<VM_IP>:3000`. That works for students, but mobile browsers warn "Not Secure" because it's plain HTTP. For HTTPS continue to Phase 3.

---

## Phase 3 — Add HTTPS via Cloudflare Tunnel (10 min, optional but recommended)

This gives you a clean `https://...trycloudflare.com` URL with no domain purchase, no certs to manage.

### 3.1 On the VM, install cloudflared
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### 3.2 Run a quick tunnel as a systemd service
```bash
sudo tee /etc/systemd/system/cloudflared-tunnel.service >/dev/null <<'EOF'
[Unit]
Description=Cloudflare Quick Tunnel for chapter6
After=network.target chapter6.service
Requires=chapter6.service

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --url http://localhost:3000 --no-autoupdate
Restart=always
RestartSec=5
StandardOutput=append:/var/log/cloudflared-tunnel.log
StandardError=append:/var/log/cloudflared-tunnel.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel
sleep 6
```

### 3.3 Read the tunnel URL
```bash
sudo grep -m1 -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /var/log/cloudflared-tunnel.log
```
Copy that URL — that's your **public HTTPS URL**. Visit `<that-url>/presenter` from any device, anywhere.

> **Important:** Quick Tunnel URLs change if you stop/restart the tunnel. For a one-class use, just start it the day of and grab the new URL. For a stable URL across multiple sessions, see "Named tunnel" notes below.

---

## Phase 4 — Day-of-class checklist

```bash
# From your phone/laptop, hit Cloud Shell
gcloud compute ssh chapter6-app --zone=us-central1-a

# Confirm both services are running
sudo systemctl status chapter6 cloudflared-tunnel

# Get the current tunnel URL
sudo grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /var/log/cloudflared-tunnel.log | tail -1
```

Open that URL on the classroom projector → `/presenter`. The QR code in the corner will already point students to the same domain.

---

## Operations

### Watch live logs
```bash
sudo journalctl -u chapter6 -f
```

### Restart the app (after pulling new code)
```bash
cd ~/chapter6-solo-app
git pull
npm install
sudo systemctl restart chapter6
```

### Update environment variable (e.g., voice change)
```bash
sudo nano ~/chapter6-solo-app/.env
sudo systemctl restart chapter6
```

### Stop everything
```bash
sudo systemctl stop chapter6 cloudflared-tunnel
```

### Delete the VM (when you're done with the course)
```bash
gcloud compute instances delete chapter6-app --zone=us-central1-a
gcloud compute firewall-rules delete allow-app-3000
```

---

## Cost
- **VM**: e2-micro in us-central1 = always-free (1/account/month)
- **Network egress**: free tier covers 1 GB/month outbound (a 30-min class with 35 students uses ~50–150 MB)
- **Cloudflare Quick Tunnel**: free, no account required
- **Gemini API**: pay per use (~$0.05–$0.30 per session with TTS)

Total: ~$0.30 per class.

---

## Optional: stable HTTPS URL via Cloudflare named tunnel
If you want the same URL every class instead of the random `trycloudflare.com` subdomain:

1. Sign up at https://cloudflare.com (free)
2. Add a domain (free options: buy a `.com` for ~$10/yr, or use a free subdomain provider like DuckDNS)
3. Run `cloudflared tunnel login`, follow the browser flow
4. `cloudflared tunnel create chapter6`
5. `cloudflared tunnel route dns chapter6 chapter6.<your-domain>`
6. Replace the `ExecStart` line in the systemd unit with `cloudflared tunnel run chapter6`
7. Restart — your URL is now `https://chapter6.<your-domain>` and stable forever

---

## Troubleshooting

**`gcloud compute ssh` says permission denied**
Wait 30 seconds after creating the VM and try again. Or use the SSH-in-browser button next to the VM in Console.

**App won't start (`systemctl status chapter6` shows failed)**
```bash
sudo journalctl -u chapter6 -n 50
```
Most common cause: bad/missing `.env`. Edit it, then `sudo systemctl restart chapter6`.

**Students can reach the IP but page hangs**
Firewall rule didn't apply. Re-run:
```bash
gcloud compute firewall-rules create allow-app-3000 --allow=tcp:3000 --source-ranges=0.0.0.0/0 --target-tags=app-3000 || true
gcloud compute instances add-tags chapter6-app --tags=app-3000 --zone=us-central1-a
```

**Tunnel URL not appearing in log**
```bash
sudo systemctl status cloudflared-tunnel
sudo cat /var/log/cloudflared-tunnel.log | tail -50
```
If cloudflared exited, restart it: `sudo systemctl restart cloudflared-tunnel`.

**Gemini calls failing**
Check the logs: `sudo journalctl -u chapter6 -n 100 | grep gemini`. Most common: API key missing/wrong → re-edit `.env` and restart.
