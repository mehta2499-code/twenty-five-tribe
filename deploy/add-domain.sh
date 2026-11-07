#!/usr/bin/env bash
# =====================================================================
# 25 — serve the app on an extra domain (keeps the existing one working).
#
#   sudo bash add-domain.sh the25.world www.the25.world
#
# The domain(s) must already point at this server. Gets a free Let's Encrypt
# certificate for them and renews it automatically. Safe to run again.
# =====================================================================
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash add-domain.sh <domain> [www.<domain>]" >&2; exit 1; }
[[ $# -ge 1 ]] || { echo "Usage: sudo bash add-domain.sh the25.world www.the25.world" >&2; exit 1; }
APP_PORT=3000
MAIN="$1"
MY_IP=$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')
for d in "$@"; do
  ip=$(getent ahostsv4 "$d" | awk 'NR==1{print $1}')
  [[ "$ip" == "$MY_IP" ]] || { echo "!! $d points at '${ip:-nothing}', not $MY_IP. Fix DNS and wait a few minutes." >&2; exit 1; }
  echo "OK: $d -> $MY_IP"
done

cat > /etc/nginx/sites-available/25-$MAIN <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $*;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location /assets/ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
ln -sf /etc/nginx/sites-available/25-$MAIN /etc/nginx/sites-enabled/25-$MAIN
nginx -t && systemctl reload nginx

args=(); for d in "$@"; do args+=(-d "$d"); done
certbot --nginx "${args[@]}" --non-interactive --agree-tos --register-unsafely-without-email --redirect

code=$(curl -s -o /dev/null -w '%{http_code}' "https://$MAIN/" || true)
[[ "$code" == "200" ]] && echo "25 is live at https://$MAIN 🔒" || { echo "!! https://$MAIN answered $code" >&2; exit 1; }
