# Setting up Supabase for 25

One-time steps in the Supabase dashboard for project `yhtuvujroxdcsstbpipt`.

## 1. Create the database

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/20261104000000_social_core.sql`.
3. Click **Run**. It should finish with "Success. No rows returned".

The script is safe to run again if you need to.

## 2. Turn on email codes

1. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
2. **Authentication → Emails → Templates → Magic Link**: put the code in the email,
   for example:

   ```html
   <h2>Your 25 code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>Or tap to sign in: <a href="{{ .ConfirmationURL }}">Sign in to 25</a></p>
   ```

3. **Authentication → URL Configuration**:
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
