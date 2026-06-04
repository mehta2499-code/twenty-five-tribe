# 25 — Rebuild Plan

Your spec is ~10 distinct screens + 7 signature features + a full visual rebrand + a copy pass. That's too much to ship well in one turn. Proposing a phased build so each phase actually lands instead of arriving half-finished.

## Phase 1 — Identity & tone (ship this turn)
The current build is structurally right but tonally funereal. Phase 1 is the biggest perceived change.

- **Visual identity refresh** in `styles.css`: warmer cream / deep oxblood or aged-bronze palette (away from navy-funeral), a Penguin-Classics-meets-Aesop type stack — *Fraunces* (display, with mischief in its italic) + *Inter Tight* or *Söhne*-feel sans. Grain texture, candle-warm glow, slower motion curves.
- **Copy pass** across Table, Moments, Thoughts, Games, You — strip solemn lines, replace with the cheeky-warm voice ("Hasn't been a Karan-shaped week…", "Send Ananya something dumb").
- **Table screen**: keep orbit, label only 4–5 seats (not most), add "Roll the Table" die affordance, add ghost-label empty chairs ("Save a Seat" preview).
- **Bottom nav**: Table · Moments · Thought of You · Games · You (already correct).

## Phase 2 — Signature features (next turn)
- **🎲 Roll the Table** — full flow: spin animation, random seat, 3 options (song / photo / sentence-starter), 60-second send.
- **⚡ The Empty Chair** — dedicated `/app/sunday` screen with the dimmed reverent question; entry point on Table on Sundays (or always-available "Preview Sunday" for demo).
- **🪑 Save a Seat** — ghost labels on empty chairs, editable, surface original note when chair is filled.

## Phase 3 — Ceremonies & depth (turn after)
- **Reserve-a-Seat ceremony** — 4-step full-screen flow (name → why → role → reveal).
- **3-screen onboarding** (thesis → constraint → first 3 seats).
- **Relationship page** rewrite per §3 (state-of-us soft line, split mutual descriptions, footer "One of twenty-five. Irreplaceable.").

## Phase 4 — Polish & artifacts
- **Voice notes** in Thought of You (15s, no transcription).
- **Moments 72h expiry** (visual fade + filter).
- **Games**: card-table aesthetic, Judgement reimagined with the four named categories, "Deal me one".
- **The Postcard** (shareable Penguin-Classics card on reserve).
- **The Annual** (year-end auto-montage — stub for demo).

## Out of scope (this rebuild)
- Real backend, Supabase RLS enforcement, phone OTP, push notifications, payments, printed-book fulfillment. Spec calls these out but the live preview is a frontend prototype — I'll keep seeded demo data and leave clean hooks where real persistence would plug in.

## Tech notes
- Stay on TanStack Start + Tailwind v4. No new heavy deps unless Phase 4 voice notes need one.
- Seed data lives in `src/lib/data.ts`; expand with the §6 demo state as needed per phase.
- All copy moves to a `src/lib/copy.ts` so the voice pass is auditable in one file.

---

**Confirm Phase 1 to start, or tell me to reshuffle priorities** (e.g. "Empty Chair first, visual later" or "do Reserve-a-Seat ceremony in Phase 1"). I'll execute one phase per turn.