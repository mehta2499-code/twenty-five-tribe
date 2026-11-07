# 25 on iPhone (Capacitor + Xcode, free Apple ID)

The app is a native shell that loads https://the25.duckdns.org, so server
deploys reach it instantly. Rebuild only for the 7-day free-signing renewal or
when the shell changes (icon, permissions).

## One-time setup on the Mac

1. Install **Xcode** from the Mac App Store, open it once, accept the licence,
   let it install iOS components.
2. Xcode → Settings → Accounts → **+** → Apple ID → sign in.
3. Install Homebrew (if missing), then Node and Bun:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install node oven-sh/bun/bun
   ```
4. Get the code and prepare the iOS project:
   ```bash
   git clone https://github.com/mehta2499-code/twenty-five-tribe.git
   cd twenty-five-tribe
   bun install
   bunx cap sync ios
   bunx cap open ios
   ```

## In Xcode

5. Left sidebar → click **App** (blue icon) → target **App** → **Signing & Capabilities**:
   - Tick **Automatically manage signing**
   - **Team:** *Your Name (Personal Team)*
   - **Bundle Identifier:** something unique, e.g. `app.twentyfive.abhijeet`
6. Plug in the iPhone, unlock it, tap **Trust This Computer**.
7. iPhone: Settings → Privacy & Security → **Developer Mode** → on → restart.
8. Xcode top bar: pick the iPhone as the run destination → press **▶ Run**.
9. First launch says "Untrusted Developer": iPhone → Settings → General →
   **VPN & Device Management** → your Apple ID → **Trust**.
10. Open 25 → sign in.

## Every 7 days

Plug in → Xcode → ▶ Run. Data stays; you stay signed in.

## Friends' iPhones

Free Apple IDs can register only a few devices. For a friend's phone: add
*their* Apple ID in Xcode → Accounts, pick their Personal Team, use a
different bundle ID (e.g. `app.twentyfive.rahul`), then Run.

## Known limits (free signing)

- No push notifications in the native app. Use the Home Screen (Safari) version
  for notifications.
- Expires every 7 days.
- Fix both with the $99/year Apple Developer account + TestFlight.

## Errors

- "maximum number of registered iPhone devices": use another Apple ID (above).
- "No profiles for …": bundle ID taken; change it.
- Blank white screen: server down or no internet; check https://the25.duckdns.org.
