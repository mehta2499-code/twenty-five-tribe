#!/usr/bin/env bash
# =====================================================================
# 25 — one-time setup for a fresh Ubuntu 24.04 VPS (e.g. Contabo).
#
# Works on Ubuntu 24.04 and 26.04 (Contabo, Bluehost, most VPS hosts).
# Run as root:
#   bash setup-server.sh                 # serve on the server's IP (http)
#   bash setup-server.sh your-domain.com # also get a free HTTPS certificate
#
# What it does:
#   - updates the system, turns on the firewall (SSH, HTTP, HTTPS only)
#   - installs Node.js 22, Nginx and Certbot
#   - creates a "deploy" user that GitHub Actions logs in as
#   - creates the app folder and a systemd service that keeps the app running
#   - points Nginx at the app, and gets an HTTPS certificate if you gave a domain
#   - creates an SSH key for GitHub and prints what to paste into GitHub secrets
# Safe to run again.
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR=/var/www/twentyfive
APP_PORT=3000
SERVICE=twentyfive
DEPLOY_USER=deploy

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo bash setup-server.sh $DOMAIN)." >&2
  exit 1
fi

echo "==> Updating the system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg ufw nginx rsync

echo "==> Freeing the web ports (some hosts ship Apache pre-installed)"
for svc in apache2 httpd lighttpd; do
  if systemctl list-unit-files | grep -q "^$svc"; then
    systemctl stop "$svc" || true
    systemctl disable "$svc" || true
  fi
done

echo "==> Firewall: allow SSH (on whatever port it really uses), HTTP and HTTPS"
SSH_PORTS=$( { sshd -T 2>/dev/null | awk '/^port /{print $2}'; \
  ss -tlnp 2>/dev/null | awk '/sshd|ssh.socket/ {split($4,a,":"); print a[length(a)]}'; } | sort -u)
[[ -z "$SSH_PORTS" ]] && SSH_PORTS=22
for port in $SSH_PORTS; do ufw allow "$port/tcp"; done
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Installing Node.js (22 or newer)"
node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }
if [[ "$(node_major || echo 0)" -lt 22 ]]; then
  if curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; then
    :
  else
    echo "   NodeSource didn't work on this Ubuntu; using Ubuntu's own Node.js."
    apt-get install -y nodejs
  fi
fi
if [[ "$(node_major || echo 0)" -lt 20 ]]; then
  echo "!! Node.js 20+ is required but $(node -v 2>/dev/null || echo none) is installed." >&2
  exit 1
fi
node -v
NODE_BIN=$(command -v node)

echo "==> Creating the deploy user and app folder"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# The deploy user may restart the app, and nothing else, without a password.
cat > /etc/sudoers.d/twentyfive <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: $(command -v systemctl) restart $SERVICE, $(command -v systemctl) status $SERVICE
EOF
chmod 440 /etc/sudoers.d/twentyfive

echo "==> App service (keeps 25 running and restarts it if it crashes)"
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=25 web app
After=network.target

[Service]
User=$DEPLOY_USER
WorkingDirectory=$APP_DIR/current
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$APP_PORT
ExecStart=$NODE_BIN $APP_DIR/current/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $SERVICE

echo "==> Nginx"
SERVER_NAME="${DOMAIN:-_}"
cat > /etc/nginx/sites-available/$SERVICE <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME ${DOMAIN:+www.$DOMAIN};

    client_max_body_size 50m;   # photo and reel uploads go straight to Supabase, but be generous

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # Built assets have hashed names, so they can be cached for a long time.
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
EOF
ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ -n "$DOMAIN" ]]; then
  echo "==> HTTPS certificate for $DOMAIN (its DNS must already point at this server)"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
    echo "!! Certbot couldn't get a certificate yet. Check the domain's A record, then run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo "==> SSH key for GitHub Actions"
KEY=/home/$DEPLOY_USER/.ssh/github_deploy
mkdir -p /home/$DEPLOY_USER/.ssh
if [[ ! -f "$KEY" ]]; then
  ssh-keygen -t ed25519 -N "" -C "github-actions-25" -f "$KEY" >/dev/null
fi
grep -qf "$KEY.pub" /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || cat "$KEY.pub" >> /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys "$KEY"

IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
cat <<EOF

=====================================================================
 Server is ready. Now add these three secrets in GitHub:
 Repo → Settings → Secrets and variables → Actions → New repository secret

   VPS_HOST     $IP
   VPS_USER     $DEPLOY_USER
   VPS_PORT     $(echo $SSH_PORTS | awk '{print $1}')   (only needed if it isn't 22)
   VPS_SSH_KEY  (everything printed between the lines below, including
                 the BEGIN and END lines)

-----8<-----
$(cat "$KEY")
-----8<-----

 Then: Actions tab → "Deploy to VPS" → Run workflow.
 The app will be at: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$IP}
=====================================================================
EOF
