#!/usr/bin/env bash
# Run this on a fresh Debian/Ubuntu GCP VM as your normal user (not root).
# Usage:
#   bash gcp-setup.sh <github-repo-url> <gemini-api-key>
# Example:
#   bash gcp-setup.sh https://github.com/me/chapter6-solo-app.git AIza...
set -euo pipefail

REPO_URL="${1:-}"
GEMINI_KEY="${2:-}"

if [[ -z "$REPO_URL" || -z "$GEMINI_KEY" ]]; then
  echo "Usage: bash gcp-setup.sh <github-repo-url> <gemini-api-key>"
  exit 1
fi

USER_NAME="$(whoami)"
APP_DIR="$HOME/chapter6-solo-app"

echo "==> Installing Node.js 20 and git"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

echo "==> Cloning repo to $APP_DIR"
if [[ -d "$APP_DIR" ]]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> Installing npm deps"
npm install --omit=dev

echo "==> Writing .env"
cat > "$APP_DIR/.env" <<EOF
GEMINI_API_KEY=$GEMINI_KEY
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
GEMINI_TTS_VOICE=Kore
PORT=3000
EOF
chmod 600 "$APP_DIR/.env"

echo "==> Creating systemd service: chapter6.service"
sudo tee /etc/systemd/system/chapter6.service >/dev/null <<EOF
[Unit]
Description=Chapter 6 Solo App
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

echo "==> Enabling + starting service"
sudo systemctl daemon-reload
sudo systemctl enable chapter6
sudo systemctl restart chapter6
sleep 2
sudo systemctl --no-pager status chapter6 || true

echo
echo "==> Done. App should be live on port 3000."
echo "    External IP: $(curl -fsS ifconfig.me 2>/dev/null || echo 'unknown')"
echo "    Test locally on the VM:  curl -s http://localhost:3000/healthz"
echo "    Logs:                    sudo journalctl -u chapter6 -f"
