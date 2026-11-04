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
    exit 0
  fi
  sleep 3
done
echo "!! The app didn't start. Run: systemctl status $SERVICE --no-pager; journalctl -u $SERVICE -n 50 --no-pager" >&2
exit 1
