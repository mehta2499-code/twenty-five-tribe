#!/usr/bin/env bash
# =====================================================================
# 25 — switch the server to HTTPS on a domain (DuckDNS works).
# The domain must already point at this server's IP.
#
#   sudo bash enable-https.sh the25.duckdns.org
#
# What it does:
#   - checks the domain points here
#   - serves the app on that domain, and sends anyone using the bare IP
#     (old links, home-screen icons) to https://<domain>
#   - gets a free Let's Encrypt certificate (renews itself automatically)
# Safe to run again.
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
APP_PORT=3000
SERVICE=twentyfive

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash enable-https.sh $DOMAIN" >&2
  exit 1
fi
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash enable-https.sh your-name.duckdns.org" >&2
  exit 1
fi

echo "==> Checking $DOMAIN points at this server"
MY_IP=$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')
DNS_IP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
if [[ "$DNS_IP" != "$MY_IP" ]]; then
  echo "!! $DOMAIN points at '${DNS_IP:-nothing}', but this server is $MY_IP." >&2
  echo "   On duckdns.org, set the IP to $MY_IP, click 'update ip', wait a minute, then run this again." >&2
  exit 1
fi
echo "    OK: $DOMAIN -> $MY_IP"

echo "==> Firewall: allow web traffic"
ufw allow 80/tcp >/dev/null || true
ufw allow 443/tcp >/dev/null || true

echo "==> Nginx for $DOMAIN"
cat > /etc/nginx/sites-available/$SERVICE <<EOF
# The app, on its domain.
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

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

# Anyone arriving by the bare IP (old links) goes to the domain.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://$DOMAIN\$request_uri;
}
EOF
ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Free HTTPS certificate (Let's Encrypt)"
export DEBIAN_FRONTEND=noninteractive
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "==> Checking it's up"
sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
if [[ "$code" == "200" ]]; then
  echo ""
  echo "25 is live at https://$DOMAIN 🔒"
  echo "The certificate renews itself; nothing else to do here."
else
  echo "!! https://$DOMAIN answered $code. Run: systemctl status $SERVICE --no-pager; nginx -t" >&2
  exit 1
fi
