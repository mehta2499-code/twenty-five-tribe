/**
 * The voice of 25.
 * Warm. Confident. A little mischief. Never preachy. Never solemn.
 * Every visible string in the app should live here or be obviously seeded from it.
 */

export const VOICE = {
  brandLine: "Twenty-five chairs. No more, no less.",
  brand: "twenty five",

  table: {
    header: "your table",
    headline: "These are your people.",
    subhead: (taken: number, open: number) =>
      `${taken} seats taken · ${open} kept open`,
    rollPrompt: "Roll the table",
    rollHint: "A random seat. A small unprompted hello.",
    reserve: "Reserve a seat",
    reserveAside: "Someone missing?",
    momentsHeader: "from your table today",
    tableTooltip: "Tap a seat to sit with them.",
  },

  // 4–5 of these get sprinkled across the orbit; the rest of the seats stay quiet
  // so the labels feel curated, not noisy.
  curatedRoles: ["Ride or Die", "Always Shows Up", "Family", "Day One", "Knows The Real Me"] as const,

  // Ghost labels on empty chairs the user has reserved for "someone, eventually"
  saveASeatPlaceholders: [
    "the friend I haven't met yet",
    "whoever ends up being my person",
    "my future best man",
    "the one who'll change everything",
    "a seat I'm keeping warm",
  ] as const,

  moments: {
    header: "moments",
    headline: "Small lives, ongoing.",
    sub: "Everything here fades in 72 hours. Nothing accumulates. That's the point.",
    empty: "Quiet at the table today. That's allowed.",
  },

  thoughts: {
    header: "thought of you",
    headline: "Quiet pings, not notifications.",
    sub: "Sometimes someone just thinks of you. That counts.",
    sendCTA: "Let someone know",
    sendHint: "Pick a face. Say one thing. Or just say nothing.",
    footer: "No likes. No reads. Just a hand on your shoulder.",
    incomingHeader: "they thought of you",
    outgoingHeader: "you thought of them",
  },

  games: {
    header: "games",
    headline: "Ways to know each other better.",
    footer: "No scores. No packs. Just ways to know each other better.",
    dealMeOne: "Deal me one",
  },

  you: {
    header: "you",
    seeingMe: "how your people see you",
    quietly: "quietly happening",
    footer: "No score. Friendship was never a number.",
  },

  emptyChair: {
    question: (name: string) =>
      `If this chair were empty next Sunday, what would you miss?`,
    take: "Take your time.",
    close: "I sat with this.",
  },

  // The cheeky-warm voice — short lines used in passing across the app
  warmAsides: {
    drift: (name: string) =>
      `Hasn't been a ${name}-shaped week in a while. Roll the table?`,
    nudge: (name: string) =>
      `Send ${name} something dumb. They'll like it more than you think.`,
    rollResult: (name: string) =>
      `${name}. Send them something that has nothing to do with anything.`,
  },

  rollActions: [
    { id: "song", label: "A song", hint: "Anything. The first one that comes to mind." },
    { id: "photo", label: "Where you are", hint: "One photo. No filter. Now." },
    { id: "line", label: "A line", hint: "Three openers. Pick. Fill. Send." },
  ] as const,

  rollStarters: [
    "Random thought:",
    "You'd hate this:",
    "If we were here right now:",
  ] as const,

  seatFooter: "One of twenty-five. Irreplaceable.",

  reservation: {
    pickHeader: "your contacts",
    pickSub: "Choose someone who's already in your life. We don't browse the rest.",
    roleHeader: "what role do they play?",
    roleSub: "Pick the truest one. You can change it later.",
    confirmHeader: "reserve this seat",
    sendingTo: (name: string) => `${name} will get this:`,
    waMessage: (fromName: string) =>
      `${fromName} reserved one of their 25 seats for you. Apparently you're one of the people that matter most. Claim your seat.`,
    cta: "Reserve their seat",
    done: (name: string) => `${name}'s seat is held. You'll know when they sit down.`,
    badgeReserved: "seat reserved · awaiting them",
    badgeAccepted: "seated",
    resend: "Send the reservation again",
  },

  claim: {
    eyebrow: "you have a seat waiting",
    headline: (name: string) => `${name} reserved one of their 25 for you.`,
    sub: "Twenty-five seats. No more. They picked you on purpose.",
    accept: "Take the seat",
    decline: "Not right now",
    footer: "You can leave the table any time. Nobody's keeping score.",
  },
};
