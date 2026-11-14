#!/usr/bin/env bash
# =====================================================================
# 25 — build and deploy directly on the server (no GitHub Actions needed).
# Run as root after setup-server.sh:
#   sudo bash deploy-on-server.sh
# Run it again any time to pull the latest code from GitHub and redeploy.
# =====================================================================
set -euo pipefail

REPO=https://github.com/mehta2499-code/twenty-five-tribe.git
SRC=/opt/twentyfive-src
APP_DIR=/var/www/twentyfive
SERVICE=twentyfive

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash deploy-on-server.sh" >&2
  exit 1
fi

echo "==> Tools (git, unzip, bun)"
export DEBIAN_FRONTEND=noninteractive
command -v git >/dev/null || apt-get install -y git
command -v unzip >/dev/null || apt-get install -y unzip
export BUN_INSTALL=/opt/bun
export PATH="$BUN_INSTALL/bin:$PATH"
command -v bun >/dev/null || curl -fsSL https://bun.sh/install | bash

echo "==> Latest code"
if [[ -d "$SRC/.git" ]]; then
  git -C "$SRC" fetch --depth 1 origin main
  git -C "$SRC" reset --hard origin/main
else
  git clone --depth 1 "$REPO" "$SRC"
fi
cd "$SRC"

echo "==> Build (a few minutes the first time)"
bun install --frozen-lockfile
rm -rf .output
NITRO_PRESET=node-server bunx vite build
test -f .output/server/index.mjs

echo "==> Push notification keys"
PUSH_ENV=/etc/twentyfive/push.env
NEW_PUSH=0
if [[ ! -f "$PUSH_ENV" ]]; then
  mkdir -p /etc/twentyfive
  read -r PUB PRIV < <(node -e "const c=require('crypto');const k=c.createECDH('prime256v1');k.generateKeys();let p=k.getPrivateKey();if(p.length<32)p=Buffer.concat([Buffer.alloc(32-p.length),p]);console.log(k.getPublicKey().toString('base64url')+' '+p.toString('base64url'))")
  {
    echo "VAPID_PUBLIC_KEY=$PUB"
    echo "VAPID_PRIVATE_KEY=$PRIV"
    echo "PUSH_SECRET=$(openssl rand -hex 24)"
    echo "VAPID_SUBJECT=mailto:admin@example.com"
  } > "$PUSH_ENV"
  chmod 600 "$PUSH_ENV"
  NEW_PUSH=1
fi
mkdir -p "/etc/systemd/system/$SERVICE.service.d"
printf '[Service]\nEnvironmentFile=-%s\n' "$PUSH_ENV" > "/etc/systemd/system/$SERVICE.service.d/push.conf"
# Other app keys (e.g. GIPHY_API_KEY for GIFs in chat) go in /etc/twentyfive/app.env.
APP_ENV=/etc/twentyfive/app.env
if [[ ! -f "$APP_ENV" ]]; then
  echo "# GIPHY_API_KEY=your-key   (free at developers.giphy.com)" > "$APP_ENV"
  chmod 600 "$APP_ENV"
fi
printf '[Service]\nEnvironmentFile=-%s\n' "$APP_ENV" > "/etc/systemd/system/$SERVICE.service.d/app.conf"
systemctl daemon-reload

echo "==> Switch to the new version"
RELEASE="$APP_DIR/releases/$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
mkdir -p "$RELEASE"
cp -a .output/. "$RELEASE/"
chown -R deploy:deploy "$APP_DIR"
ln -sfn "$RELEASE" "$APP_DIR/current"
systemctl restart "$SERVICE"
cd "$APP_DIR/releases" && ls -1t | tail -n +6 | xargs -r rm -rf

echo "==> Checking it's up"
for i in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)
  if [[ "$code" == "200" ]]; then
    IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    echo "25 is live: http://$IP (or your domain)"
    if [[ "$NEW_PUSH" == "1" ]]; then
      DOMAIN=$(grep -m1 -oP 'server_name \K[a-z0-9.-]+\.[a-z]{2,}' "/etc/nginx/sites-available/$SERVICE" 2>/dev/null || true)
      if [[ -n "$DOMAIN" ]]; then PUSH_URL="https://$DOMAIN/api/push"; else PUSH_URL="http://$IP/api/push"; fi
      SECRET=$(grep PUSH_SECRET "$PUSH_ENV" | cut -d= -f2)
      echo ""
      echo "==> ONE-TIME STEP for notifications. In Supabase → SQL Editor, run:"
      echo ""
      echo "    select public.set_push_config('$PUSH_URL', '$SECRET');"
      echo ""
      echo "    Keep that secret private. To see it again: sudo cat $PUSH_ENV"
    fi
    exit 0
  fi
  sleep 3
done
echo "!! The app didn't start. Run: systemctl status $SERVICE --no-pager; journalctl -u $SERVICE -n 50 --no-pager" >&2
exit 1
