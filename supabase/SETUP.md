# Setting up Supabase for 25

One-time steps in the Supabase dashboard for project `yhtuvujroxdcsstbpipt`.

## 1. Create the database

**Automatic (recommended):** add two repository secrets in GitHub under
**Settings → Secrets and variables → Actions → New repository secret**:

- `SUPABASE_ACCESS_TOKEN`: create at supabase.com → Account → Access Tokens
- `SUPABASE_DB_PASSWORD`: Supabase → Project Settings → Database (reset it there if you don't know it)

Then open the repo's **Actions** tab → **Supabase migrations** → **Run workflow**.
From then on, any change to `supabase/migrations` on `main` is applied automatically.

**By hand:**

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/20261104000000_social_core.sql`.
3. Click **Run**. It should finish with "Success. No rows returned".

Then do the same with `supabase/migrations/20261105000000_games.sql`
(multiplayer Kachuful and trivia challenges).

Both scripts are safe to run again if you need to.

## 2. Turn on email codes

1. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
2. (Optional, needs custom SMTP first) **Authentication → Emails → Templates → Magic Link**: put the code in the email,
   for example:

   ```html
   <h2>Your 25 code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>Or tap to sign in: <a href="{{ .ConfirmationURL }}">Sign in to 25</a></p>
   ```

3. **Authentication → Emails → Templates → Confirm signup**: brand-new accounts get *this*
   email, not the Magic Link one, so it needs the code too:

   ```html
   <h2>Welcome to 25 👋</h2>
   <p>Your code to claim your seat:</p>
   <p style="font-size:32px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>
   <p>Type it in the app. It works for the next hour.</p>
   <p style="color:#888">Or tap here on this phone: <a href="{{ .ConfirmationURL }}">Claim my seat</a></p>
   ```

4. **Authentication → Emails → Templates → Reset Password**: keep the link
   (`{{ .ConfirmationURL }}`); it opens the app's reset-password page.

5. **Authentication → URL Configuration**:
   - Site URL: `https://twenty-five-tribe.lovable.app`
   - Redirect URLs: add `https://twenty-five-tribe.lovable.app/**` (and your own domain later).

## 3. Before inviting more than a few people

Supabase's built-in email sender only sends a handful of emails per hour.
Add your own sender under **Project Settings → Authentication → SMTP Settings**
(Resend, Brevo, Postmark and Amazon SES all work).

## Keys

- The app uses only the public **anon** key (in `src/integrations/supabase/client.ts`).
- Never put the `service_role` key in the app or the repo.

## What's enforced on the server

- Max 25 seats per person (accepted friends + requests you've sent).
- You can only message, snap, see posts, likes, comments and scores of people in your 25.
- Files live in private buckets under each user's folder; snap images can't be
  loaded by a recipient after they open the snap.
- Streak days follow India time. A day counts when both people snapped each other.
