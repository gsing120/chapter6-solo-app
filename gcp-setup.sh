#!/usr/bin/env bash
# Run this on a fresh Debian/Ubuntu GCP VM, FROM INSIDE the cloned repo.
# Usage:
#   bash gcp-setup.sh <gemini-api-key>
set -euo pipefail

GEMINI_KEY="${1:-}"
if [[ -z "$GEMINI_KEY" ]]; then
  echo "Usage: bash gcp-setup.sh <gemini-api-key>"
  echo "Example: bash gcp-setup.sh AIzaSy..."
  exit 1
fi

USER_NAME="$(whoami)"
APP_DIR="$(pwd)"

if [[ ! -f "$APP_DIR/server.js" ]]; then
  echo "Error: run this from inside the chapter6-solo-app directory."
  exit 1
fi

echo "==> Installing Node.js 20"
if ! command -v node >/dev/null || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

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

echo "==> Creating systemd service"
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
echo "==> Done. App listening on port 3000."
EXTERNAL_IP="$(curl -fsS ifconfig.me 2>/dev/null || echo 'unknown')"
echo "    External IP: $EXTERNAL_IP"
echo "    Local check: curl -s http://localhost:3000/healthz"
echo "    Live logs:   sudo journalctl -u chapter6 -f"
