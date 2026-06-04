export type Friend = {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatar: string;
  postedToday: boolean;
  joinedDaysAgo: number;
  daysQuiet: number;
};

const PALETTE = [
  "#F7A8A0", "#FFC4BC", "#FFD9A8", "#BFE9C9", "#E8DEFF",
  "#A8D4F0", "#FFB8A8", "#FFEAD0", "#D6E8FF", "#FFD0CC",
];

const NAMES = [
  "Rahul","Priya","Arjun","Neha","Simran","Vikram","Isha","Rohan","Ananya","Dev",
  "Kabir","Tara","Aditya","Meera","Sanya","Yash","Riya","Karan","Diya","Nikhil",
  "Aarav","Zoya","Ishan",
];

const PRAVATAR_IDS = [
  12, 5, 13, 9, 16, 33, 47, 11, 26, 32,
  68, 1, 60, 44, 24, 51, 20, 52, 25, 65,
  14, 49, 7,
];

export const avatarUrl = (id: number) => `https://i.pravatar.cc/200?img=${id}`;

export const FRIENDS: Friend[] = NAMES.map((name, i) => ({
  id: String(i + 1),
  name,
  initials: name.slice(0, 2).toUpperCase(),
  color: PALETTE[i % PALETTE.length],
  avatar: avatarUrl(PRAVATAR_IDS[i]),
  postedToday: [0,1,3,5,8,9,12,14,17,20,22].includes(i),
  joinedDaysAgo: 30 + ((i * 47) % 600),
  daysQuiet: [3,21,7,1,30,2,5,14,0,8,15,1,22,4,10,2,9,17,3,1,6,28,2][i] ?? 0,
}));

export const SEATS_FILLED = FRIENDS.length;
export const SEATS_TOTAL = 25;

/** Friends drifting — quiet 14+ days */
export const DRIFTING = FRIENDS.filter((f) => f.daysQuiet >= 14);

export type MomentTag = "Life Update" | "Milestone" | "Mood" | "Thought" | "Remember When";

export type Moment = {
  id: string;
  friendId: string;
  tag: MomentTag;
  text: string;
  timeAgo: string;
  photo?: string;
  reactions?: number;
  /** AI-generated nostalgic surface */
  remember?: { year: string; cta: string };
};

export const MOMENTS: Moment[] = [
  { id: "m1", friendId: "1", tag: "Milestone",   text: "Just got promoted to Senior PM at Razorpay! Three years of grinding. 🙏", timeAgo: "12m", reactions: 12 },
  { id: "rw1", friendId: "2", tag: "Remember When",
    text: "Remember when you and Priya took that 2 AM auto back from Bandra and got stuck near Mahim? Exactly two years ago today.",
    timeAgo: "AI · just now",
    photo: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=600",
    remember: { year: "2 years ago", cta: "Send her this memory" } },
  { id: "m2", friendId: "2", tag: "Life Update", text: "Goa with the college gang this weekend. First trip where nobody cancelled.", timeAgo: "1h", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600", reactions: 18 },
  { id: "m3", friendId: "3", tag: "Mood",        text: "Inexplicably anxious today. Anyone else just get random Sunday dread?", timeAgo: "3h", reactions: 8 },
  { id: "m4", friendId: "4", tag: "Milestone",   text: "Got into the IIM Ahmedabad executive programme 🎉 2 years of applications finally worked.", timeAgo: "5h", reactions: 21 },
  { id: "rw2", friendId: "9", tag: "Remember When",
    text: "You and Ananya haven't played Truth Jar in 47 days. Last time, she said you were the funniest person she knew. Rematch?",
    timeAgo: "AI · 2h",
    remember: { year: "47 days ago", cta: "Start a rematch" } },
  { id: "m5", friendId: "5", tag: "Thought",     text: "Unpopular opinion: phone calls > texts. We've lost something.", timeAgo: "7h", reactions: 15 },
  { id: "m6", friendId: "9", tag: "Thought",     text: "we romanticize being busy and call it a personality. stop.", timeAgo: "9h", reactions: 9 },
  { id: "m7", friendId: "13", tag: "Life Update", text: "moving back to bangalore next month. round 2.", timeAgo: "11h", photo: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=600", reactions: 7 },
  { id: "m8", friendId: "6", tag: "Milestone",   text: "first paycheck from the side project. cried a little.", timeAgo: "14h", reactions: 24 },
  { id: "m9", friendId: "18", tag: "Mood",       text: "the older i get the more i text my mom for no reason.", timeAgo: "18h", reactions: 11 },
  { id: "m10", friendId: "15", tag: "Life Update", text: "Coldplay tonight. Twelve year old me would not believe this.", timeAgo: "21h", photo: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600", reactions: 19 },
];

export const WAITING_ROOM = [
  { id: "w1", name: "Aanya",  initials: "AA", mutuals: 4, avatar: avatarUrl(48) },
  { id: "w2", name: "Veer",   initials: "VE", mutuals: 2, avatar: avatarUrl(58) },
  { id: "w3", name: "Saanvi", initials: "SA", mutuals: 6, avatar: avatarUrl(45) },
];

export const ME = { name: "You", initials: "YO", avatar: avatarUrl(15) };

/** Friendship score grows with trivia, capsules, rematches */
export const FRIENDSHIP_SCORE = { value: 847, max: 1000 };

// ============== AI Roast & Toast lines ==============
export const ROASTS: Record<string, string[]> = {
  default: [
    "Look, {name} has the energy of a phone that's been on 1% for six hours and still won't die. Respect, but also — charge up.",
    "{name} responds to 'we should catch up' with 'yes definitely' and then enters a witness protection programme. Iconic.",
    "If procrastination were an Olympic sport, {name} would still be filling out the registration form three days after the closing ceremony.",
  ],
};
export const TOASTS: Record<string, string[]> = {
  default: [
    "To {name} — the friend who answers at 2 AM, never keeps score, and somehow remembers the small things you forgot you said. The world is softer because you're in it.",
    "{name} doesn't show up loudly. They show up steadily. Which, if you've ever been the person being shown up for, is everything. Cheers.",
    "Here's to {name} — proof that some people are not events in your life, they're seasons. And we're lucky to live in yours.",
  ],
};

// ============== Games ==============
export type Game = {
  id: string;
  emoji: string;
  name: string;
  players: string;
  description: string;
  price: "Free" | string;
};

export const FRIENDSHIP_GAMES: Game[] = [
  { id: "know-me",     emoji: "🧠", name: "How Well Do You Know Me?", players: "2 players", description: "Answer questions about yourself. Let your friend guess.", price: "Free" },
  { id: "most-likely", emoji: "🎯", name: "Most Likely To",            players: "All 25",   description: "Vote on your circle. Results will surprise you.", price: "Free" },
  { id: "truth-jar",   emoji: "🎲", name: "Truth Jar",                 players: "All 25",   description: "Drop anonymous questions. Answer in your own time.", price: "Free" },
  { id: "rapid-fire",  emoji: "⚡", name: "Rapid Fire",                players: "2 players", description: "60 seconds. One word answers. How in sync are you?", price: "Free" },
];

export const GAMES = FRIENDSHIP_GAMES;

export const ACTIVE_GAMES = [
  { id: "ag1", gameId: "judgement",   title: "Judgement · Round 3",   players: ["1","2","4","9"], progress: 0.6, status: "Your turn" },
  { id: "ag2", gameId: "trivia",      title: "IPL Legends · Priya",   players: ["2"],             progress: 0.4, status: "Waiting" },
  { id: "ag3", gameId: "most-likely", title: "Most Likely To",        players: ["3","5","7"],     progress: 0.8, status: "Your turn" },
];

export type TriviaPack = {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  questions: number;
  difficulty: 1 | 2 | 3;
  price: "Free" | string;
  gradient: string;
};

export const TRIVIA_PACKS: TriviaPack[] = [
  { id: "ipl",       emoji: "🏏", name: "IPL Legends",     tagline: "Who knows their cricket?",       questions: 25, difficulty: 2, price: "Free", gradient: "linear-gradient(135deg,#1A5276,#2B8AC4)" },
  { id: "bolly00s",  emoji: "🎬", name: "Bollywood 2000s", tagline: "SRK or Salman?",                  questions: 30, difficulty: 2, price: "₹29",  gradient: "linear-gradient(135deg,#9b1c4a,#F7A8A0)" },
  { id: "indiagk",   emoji: "🗺️", name: "India GK",        tagline: "How desi are you really?",        questions: 25, difficulty: 3, price: "Free", gradient: "linear-gradient(135deg,#0f5132,#BFE9C9)" },
  { id: "hindimusic",emoji: "🎵", name: "Hindi Music",     tagline: "Name the song from the lyrics",   questions: 30, difficulty: 3, price: "₹29",  gradient: "linear-gradient(135deg,#1A5276,#E8DEFF)" },
  { id: "desilife",  emoji: "😂", name: "Desi Life",       tagline: "Only Indians will get this",      questions: 20, difficulty: 1, price: "Free", gradient: "linear-gradient(135deg,#9a3412,#FFD9A8)" },
];

// ============== Memory Capsules ==============
export type CapsuleMomentEntry = {
  tag: MomentTag;
  text: string;
  date: string;
};
export type CapsulePulse = {
  word: string;
  emoji: string;
  date: string;
  color: string;
};
export type Capsule = {
  id: string;
  friendId: string;
  years: string;
  stats: { pulses: number; milestones: number; games: number };
  story: CapsuleMomentEntry[];
  pulses: CapsulePulse[];
  photos: string[];
  score: number;
  scoreNote: string;
};

const CAPSULE_FRIEND_IDS = ["1","2","4","6","9","13","15","18"];

const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400",
  "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=400",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
  "https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=400",
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400",
  "https://images.unsplash.com/photo-1530023367847-a683933f4172?w=400",
];

export const CAPSULES: Capsule[] = CAPSULE_FRIEND_IDS.map((fid, i) => {
  const f = FRIENDS.find((x) => x.id === fid)!;
  return {
    id: `cap-${fid}`,
    friendId: fid,
    years: `${(2 + (i % 5))} years of friendship`,
    stats: { pulses: 42 + i * 7, milestones: 6 + (i % 4), games: 19 + i * 3 },
    story: [
      { tag: "Milestone",   text: `The night ${f.name} called at 1 AM to say they got the job.`, date: "Mar 2023" },
      { tag: "Life Update", text: `Goa trip — the one where nobody cancelled.`,                  date: "Jul 2023" },
      { tag: "Mood",        text: `${f.name} sent the longest voice note about feeling lost. You listened twice.`, date: "Feb 2024" },
      { tag: "Thought",     text: `"We romanticise being busy and call it a personality."`,      date: "Aug 2024" },
      { tag: "Milestone",   text: `${f.name}'s engagement. You were the second to know.`,        date: "Jan 2025" },
    ],
    pulses: [
      { word: "tired",    emoji: "😮‍💨", date: "Apr 2",  color: "#7B6FD4" },
      { word: "grateful", emoji: "🤍",   date: "Jun 14", color: "#D4A96A" },
      { word: "anxious",  emoji: "🌀",   date: "Sep 9",  color: "#C94040" },
    ],
    photos: PHOTO_POOL.slice(0, 6),
    score: 92 - i * 3,
    scoreNote: `Top 3% of all friendships on 25 · Judgement rivals, ${f.name} leads 26–21`,
  };
});

export type TriviaQ = { q: string; options: string[]; answer: number };

export const TRIVIA_QUESTIONS: Record<string, TriviaQ[]> = {
  ipl: [
    { q: "Who has scored the most runs in IPL history?",       options: ["Rohit Sharma","Virat Kohli","David Warner","MS Dhoni"], answer: 1 },
    { q: "Which team won the first ever IPL in 2008?",          options: ["CSK","RCB","Rajasthan Royals","Mumbai Indians"], answer: 2 },
    { q: "Who holds the record for fastest IPL century?",       options: ["Chris Gayle","AB de Villiers","KL Rahul","Yusuf Pathan"], answer: 0 },
    { q: "MS Dhoni's jersey number is?",                         options: ["7","17","27","77"], answer: 0 },
    { q: "Most expensive IPL player in 2024 auction?",          options: ["Pat Cummins","Mitchell Starc","Cameron Green","Sam Curran"], answer: 1 },
  ],
  bolly00s: [
    { q: "Who directed Kabhi Khushi Kabhie Gham (2001)?",        options: ["Karan Johar","Yash Chopra","Aditya Chopra","Sanjay Bhansali"], answer: 0 },
    { q: "'All izz well' is a line from which film?",            options: ["3 Idiots","PK","Munna Bhai","Taare Zameen Par"], answer: 0 },
    { q: "Lead actress in Kal Ho Naa Ho?",                       options: ["Rani Mukerji","Kareena Kapoor","Preity Zinta","Aishwarya Rai"], answer: 2 },
    { q: "Which film made Hrithik Roshan a star?",               options: ["Mission Kashmir","Kaho Naa Pyaar Hai","Fiza","Yaadein"], answer: 1 },
    { q: "Lagaan released in?",                                   options: ["1999","2000","2001","2002"], answer: 2 },
  ],
  indiagk: [
    { q: "Capital of Arunachal Pradesh?",                        options: ["Itanagar","Imphal","Aizawl","Kohima"], answer: 0 },
    { q: "Which river is called Dakshin Ganga?",                 options: ["Krishna","Kaveri","Godavari","Narmada"], answer: 2 },
    { q: "Who was India's first woman PM?",                      options: ["Sarojini Naidu","Indira Gandhi","Pratibha Patil","Sushma Swaraj"], answer: 1 },
    { q: "National sport of India (officially)?",                options: ["Hockey","Cricket","Kabaddi","None declared"], answer: 3 },
    { q: "Tallest statue in the world is in?",                   options: ["Gujarat","Maharashtra","Rajasthan","Karnataka"], answer: 0 },
  ],
  hindimusic: [
    { q: "'Tum hi ho, tum hi ho' — singer?",                     options: ["Atif Aslam","Arijit Singh","Mohit Chauhan","Sonu Nigam"], answer: 1 },
    { q: "'Kal ho naa ho' — music director?",                    options: ["A.R. Rahman","Shankar–Ehsaan–Loy","Pritam","Vishal–Shekhar"], answer: 1 },
    { q: "Year of release: 'Pasoori'?",                          options: ["2020","2021","2022","2023"], answer: 2 },
    { q: "'Channa mereya' is from?",                             options: ["ADHM","Dear Zindagi","Tamasha","Rockstar"], answer: 0 },
    { q: "Who sang 'Kesariya'?",                                  options: ["Arijit Singh","Pritam","Jubin Nautiyal","Armaan Malik"], answer: 0 },
  ],
  desilife: [
    { q: "What's the universal Indian response to 'kya kar raha hai'?", options: ["Kuch nahi, bata","Bas, free hu","Yaar abhi busy hu","Kaam kar raha"], answer: 0 },
    { q: "Maggi cooking time as per packet vs reality?",          options: ["2 min vs 2 min","2 min vs 5 min","2 min vs 8 min","2 min vs 15 min"], answer: 2 },
    { q: "Mom finds your earphones tangled. Her first words?",    options: ["Saaf karke rakh","Itna ganda kyun","Mera nahi","Tujhe sambhalna nahi aata"], answer: 3 },
    { q: "Wedding DJ's mandatory opening song?",                  options: ["Kala Chashma","London Thumakda","Bole Chudiyan","Mehndi Laga Ke Rakhna"], answer: 0 },
    { q: "What does 'achha theek hai' really mean?",              options: ["Ok fine","I'm done arguing","Whatever you say","All of the above"], answer: 3 },
  ],
};

// ============== Relationship tags & moments (warm layer) ==============
export type RelationshipTag = "Family" | "Ride or Die" | "Safe Place" | "Soul Mirror" | "Day One" | "Chosen" | "Anchor";

export const RELATIONSHIP_TAGS: Record<string, RelationshipTag> = {
  "1": "Ride or Die",
  "2": "Soul Mirror",
  "3": "Day One",
  "4": "Safe Place",
  "6": "Chosen",
  "9": "Anchor",
  "13": "Family",
  "15": "Ride or Die",
  "18": "Safe Place",
  "20": "Day One",
};

export type RelationshipMoment = {
  id: string;
  friendId: string;
  text: string;
  when: string;
};

export const RELATIONSHIP_MOMENTS: RelationshipMoment[] = [
  { id: "rm1", friendId: "1", text: "Rahul described you as 'The one who always shows up'.", when: "this morning" },
  { id: "rm2", friendId: "2", text: "Priya reserved a seat for Simran.",                     when: "yesterday" },
  { id: "rm3", friendId: "9", text: "Ananya remembered your Goa trip.",                       when: "two days ago" },
  { id: "rm4", friendId: "11", text: "Your friendship with Kabir turned 10 years old.",       when: "this week" },
  { id: "rm5", friendId: "4", text: "Neha thought about you this week.",                      when: "Sunday" },
];

/** "Thought of you" log — quiet pings, never notifications */
export type Thought = {
  id: string;
  friendId: string;
  direction: "from" | "to";
  note?: string;
  when: string;
};
export const THOUGHTS: Thought[] = [
  { id: "t1", friendId: "1",  direction: "from", note: "saw a chai stall that reminded me of you", when: "this morning" },
  { id: "t2", friendId: "9",  direction: "from", note: "the old Goa playlist came on shuffle",     when: "yesterday" },
  { id: "t3", friendId: "4",  direction: "to",                                                       when: "two days ago" },
  { id: "t4", friendId: "11", direction: "from", note: "ten years. of you. of us.",                when: "Sunday" },
  { id: "t5", friendId: "13", direction: "to",                                                       when: "last week" },
  { id: "t6", friendId: "2",  direction: "from", note: "the rain in Bombay, the auto in Mahim",    when: "last week" },
];

/** Why this person sits at your table */
export const SEAT_REASONS: Record<string, string> = {
  "1":  "Because nobody answers a 2 AM call quite like him.",
  "2":  "Because she remembers the small things you forgot you said.",
  "3":  "Day one. Before any of this.",
  "4":  "Because she makes the loud world feel quiet.",
  "5":  "Because she says the thing nobody else will.",
  "6":  "Because his steadiness has held you up more than once.",
  "9":  "Because some friendships are seasons. You're living in hers.",
  "11": "Ten years. Same person. Different lives. Still each other's.",
  "13": "Family — the kind you didn't have to be born into.",
  "15": "Because the inside jokes have outlived three cities.",
};

/** Mutual descriptions — how this person has named you, and you them */
export const MUTUAL_DESCRIPTIONS: Record<string, { they: string[]; you: string[] }> = {
  default: {
    they: ["The one who always shows up.", "Steady.", "Home, kind of."],
    you:  ["A safe place.", "Funny in a way nobody else gets.", "The first call."],
  },
};

/** Friendship timeline events */
export const FRIENDSHIP_TIMELINE: Record<string, { year: string; text: string }[]> = {
  default: [
    { year: "Year 1",  text: "Met at a house party neither of you wanted to be at." },
    { year: "Year 3",  text: "The trip where nobody cancelled." },
    { year: "Year 5",  text: "The 1 AM call. The job. The crying." },
    { year: "Year 7",  text: "Different cities. Same group chat." },
    { year: "Today",   text: "Still here. Still seated." },
  ],
};

/**
 * "Save a Seat" — ghost labels on empty chairs.
 * Stored as { seatIndex, note }; surfaced on the Table as a labeled empty chair.
 */
export type SavedSeat = { seatIndex: number; note: string };
export const SAVED_SEATS: SavedSeat[] = [
  { seatIndex: 7,  note: "the friend I haven't met yet" },
  { seatIndex: 17, note: "whoever ends up being my person" },
];


/** How the user's 25 have described them (used on the You screen) */
export const ME_DESCRIPTIONS: { quote: string; from: string }[] = [
  { quote: "The one who always shows up.", from: "Rahul" },
  { quote: "Steady, in a world that isn't.", from: "Priya" },
  { quote: "Home, kind of.", from: "Ananya" },
  { quote: "The first call when something good happens.", from: "Kabir" },
  { quote: "Funny in a way nobody else gets.", from: "Neha" },
];

/** Soft counters for the You screen — non-competitive, no metric can go down */
export const QUIETLY = {
  momentsThisMonth: 14,
  thoughtsExchanged: 9,
  verdictsCast: 3,
};

// ============== Seat system ==============
// A seat is a relationship reservation, not a contact.
export type SeatState = "EMPTY" | "RESERVED" | "ACCEPTED" | "DECLINED";

/** Roles a user can assign when reserving a seat. */
export const ROLES = [
  "Ride or Die",
  "Day One",
  "Family",
  "Chaos Partner",
  "Safe Place",
  "Mentor",
  "Always Shows Up",
  "Soul Mirror",
  "The One",
] as const;
export type Role = (typeof ROLES)[number];

export type SeatMeta = {
  friendId: string;
  state: SeatState;
  role: Role;
  phone?: string;
  reservedAt?: string;
};

/** Per-friend seat metadata. Default state is ACCEPTED if not listed here. */
export const SEAT_META: Record<string, SeatMeta> = {
  "1":  { friendId: "1",  state: "ACCEPTED", role: "Ride or Die" },
  "2":  { friendId: "2",  state: "ACCEPTED", role: "Soul Mirror" },
  "3":  { friendId: "3",  state: "ACCEPTED", role: "Day One" },
  "4":  { friendId: "4",  state: "ACCEPTED", role: "Safe Place" },
  "5":  { friendId: "5",  state: "ACCEPTED", role: "Chaos Partner" },
  "6":  { friendId: "6",  state: "ACCEPTED", role: "Always Shows Up" },
  // Reserved seats — person picked, invitation sent, not yet claimed
  "7":  { friendId: "7",  state: "RESERVED", role: "Mentor",  phone: "+91 98•••••12", reservedAt: "3 days ago" },
  "10": { friendId: "10", state: "RESERVED", role: "Family",  phone: "+91 99•••••44", reservedAt: "yesterday" },
  "20": { friendId: "20", state: "RESERVED", role: "The One", phone: "+91 90•••••07", reservedAt: "an hour ago" },
};

export function getSeatMeta(friendId: string): SeatMeta {
  return SEAT_META[friendId] ?? { friendId, state: "ACCEPTED", role: "Always Shows Up" };
}

/** Demo "seat waiting for you" shown on /claim */
export const INCOMING_RESERVATION = {
  fromName: "Aman",
  fromInitials: "AM",
  fromAvatar: avatarUrl(33),
  role: "Ride or Die" as Role,
  reservedAt: "a few minutes ago",
};
