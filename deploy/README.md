# Running 25 on your own server

25 runs as a small Node.js server behind Nginx. GitHub builds it and copies it to
your VPS on every push to `main`. The database, sign-in and files stay on Supabase.

## One-time setup (about 15 minutes)

### 1. Buy the VPS
Contabo, smallest plan, **Ubuntu 24.04**. Note the server's **IP address** and **root password**
from Contabo's welcome email.

### 2. (Recommended) Point a domain at it
At your domain registrar, add an **A record** for `@` (and one for `www`) with the server's IP.
Without a domain the app still works on `http://<IP>`, but phones may block the camera and
"Add to Home Screen" without HTTPS.

### 3. Run the setup script on the server
From a terminal on your computer (Mac: Terminal app; Windows: PowerShell):

```bash
ssh root@YOUR_SERVER_IP
```

Then, on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/mehta2499-code/twenty-five-tribe/main/deploy/setup-server.sh -o setup-server.sh
```

```bash
bash setup-server.sh yourdomain.com
```

(Leave off `yourdomain.com` if you don't have one yet.) At the end it prints three values.

### 4. Add the three secrets to GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `VPS_HOST` | the server IP it printed |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | the whole key it printed, including the `BEGIN` and `END` lines |

### 5. Deploy
Repo → **Actions → Deploy to VPS → Run workflow**. After this, every push to `main` deploys itself.

### 6. Tell Supabase about the new address
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://yourdomain.com`
- **Redirect URLs**: add `https://yourdomain.com/**`

Without this, sign-in links from the email open the old address.

## Day to day
- **Deploys:** automatic on push to `main`. Each deploy keeps the last 5 versions on the server.
- **Is it running?** `ssh root@IP` then `systemctl status twentyfive`
- **Logs:** `journalctl -u twentyfive -n 100`
- **Roll back:** `ls /var/www/twentyfive/releases`, then
  `ln -sfn /var/www/twentyfive/releases/<older> /var/www/twentyfive/current && systemctl restart twentyfive`

## Building locally
```bash
bun install
```
```bash
bun run build:node && bun run start
```
The app listens on port 3000 (`PORT` and `HOST` environment variables change that).
