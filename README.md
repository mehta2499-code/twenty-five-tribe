# My Twenty-Five

App name: 25

Tagline: Your world. All 25 of them.

Build a mobile-first social app called 25 where each user can have a maximum of 25 friends — no more, no less. The limit is the core product mechanic. Dark mode first. Color palette: primary purple #7F77DD, background near-black #0D0D0F, surface cards #1A1A1F, text white #F5F0FF, muted text #8B8A9B. Font: rounded modern sans-serif. Every screen should feel intimate, premium, and slightly emotional — not corporate, not startup-cheesy.

Build these screens:

1. Onboarding screen Full screen dark background. Large "25" as the hero wordmark in #7F77DD, bold display font. Below it: "Your world. All 25 of them." in muted text. Below that: "Pick your 25. Choose wisely. Or don't — you can always reshuffle." Small CTA button "Claim your 25" in purple. Clean, minimal, no clutter.

2. Home feed (Moments) Top bar shows "25" logo left, a small purple circle with user initials right. Below that, a horizontal scroll row of 25 circular avatars — these are the user's 25 friends. Each circle has a thin purple ring if that friend posted a Moment today. Grey ring if not. Tapping a ring opens their Moment.

Below the avatar row, a vertical feed of Moments cards. Each card shows: friend avatar + name + timestamp + a badge tag (one of: Life Update / Milestone / Mood / Thought) in different subtle colors. Card body is the moment text or photo. No like count visible. A small emoji reaction button bottom right — tapping shows a floating emoji picker (❤️ 🔥 😂 🫂 👏). Reactions are private — only the poster sees who reacted.

At the bottom, a floating purple "+" button to add a new Moment.

3. My 25 screen (The Seats) A visually beautiful grid of 25 seats — render them as 25 rounded square cards in a 5x5 grid. Filled seats show the friend's avatar + first name. Empty seats show a faint "+" with dashed border in muted purple. At the top, a counter: "23 / 25 seats filled" in small muted text.

Tapping a filled seat opens a small bottom sheet with: friend name, how long they've been in your 25, a "Drift" indicator (green = active, amber = 14 days quiet, red = 21+ days quiet), and two buttons: "Send a vibe" and "Remove from 25".

At the top right, a small "Waiting Room" button showing a badge count — tapping it shows a list of people who want to be added but your seats are full.

4. Pulse screen Full screen, centered. Title: "How are you actually doing?" in white, large. Below it: a text field limited to 1 word. Below that: an emoji picker row (user picks 1). Below that: a color swatch row — 8 soft colors the user can pick to represent their mood. A "Send Pulse" button in purple at the bottom. After sending, a confirmation screen: "Your 25 can feel you." with a soft animation of the purple circle pulsing outward.

After sending Pulse, the screen shows today's Pulse feed — a simple list of each of your 25 friends' pulse for today: their avatar, their 1 word, their emoji, and a small colored dot matching their color choice. No comments. No reactions. Just presence.

5. Post a Moment screen Clean sheet that slides up from the "+" button. Four large type-selector buttons at the top: Life Update / Milestone / Mood / Thought — each with a distinct subtle color. Below: a text area "What's happening?" with a 280 character limit shown as a small counter. Below: an optional photo upload area (dashed border, tap to add). Below: a toggle "Expires in 72 hours" defaulting to ON. At the bottom: "Share with your 25" purple button.

6. Bottom navigation 5 tabs: Home (house icon) / My 25 (grid icon) / Pulse (heartbeat icon) / Moments (camera icon) / Profile (person icon). Active tab in purple. Inactive in muted grey. No labels — icons only. Clean.

Key rules to apply across all screens:

No follower counts anywhere

No public content — every screen feels private and intimate

No infinite scroll — the feed ends when you've seen all 25 people's Moments

Reactions are always private

Tone of microcopy throughout: witty, warm, emotionally intelligent. Examples: empty seat = "An empty seat. Someone's missing." / drift alert = "You and Priya haven't talked in 21 days. Just saying." / full seats = "All 25 taken. Someone's gotta go for someone new to come in. That's just life."

Use subtle purple glow or pulse animations sparingly for key moments (sending Pulse, adding someone to your 25, receiving a Memory Capsule)

Use realistic dummy data throughout — Indian names (Rahul, Priya, Arjun, Neha, Simran, Vikram, Isha, Rohan, Ananya, Dev), realistic Moment content, realistic Pulse words (tired / grateful / anxious / lit / meh).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://twenty-five-tribe.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cd199ca9-8d7c-4d25-82c7-6566a8a88a81).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
