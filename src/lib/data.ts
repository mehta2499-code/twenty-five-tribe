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
  "#7F77DD", "#B58CE4", "#5BCFC1", "#E48CB0", "#E4B86C",
  "#7CB4E4", "#9BE49E", "#E49B7C", "#C9A3F0", "#8AE4D2",
];

const NAMES = [
  "Rahul","Priya","Arjun","Neha","Simran","Vikram","Isha","Rohan","Ananya","Dev",
  "Kabir","Tara","Aditya","Meera","Sanya","Yash","Riya","Karan","Diya","Nikhil",
  "Aarav","Zoya","Ishan",
];

// Curated pravatar ids for diverse, real-looking faces
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

export const SEATS_FILLED = FRIENDS.length; // 23 / 25
export const SEATS_TOTAL = 25;

export type MomentTag = "Life Update" | "Milestone" | "Mood" | "Thought";

export type Moment = {
  id: string;
  friendId: string;
  tag: MomentTag;
  text: string;
  timeAgo: string;
  photo?: string;
  reactions?: number;
};

export const MOMENTS: Moment[] = [
  { id: "m1", friendId: "1", tag: "Milestone",   text: "Just got promoted to Senior PM at Razorpay! Three years of grinding. 🙏", timeAgo: "12m", reactions: 12 },
  { id: "m2", friendId: "2", tag: "Life Update", text: "Goa with the college gang this weekend. First trip where nobody cancelled.", timeAgo: "1h", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600", reactions: 18 },
  { id: "m3", friendId: "3", tag: "Mood",        text: "Inexplicably anxious today. Anyone else just get random Sunday dread?", timeAgo: "3h", reactions: 8 },
  { id: "m4", friendId: "4", tag: "Milestone",   text: "Got into the IIM Ahmedabad executive programme 🎉 2 years of applications finally worked.", timeAgo: "5h", reactions: 21 },
  { id: "m5", friendId: "5", tag: "Thought",     text: "Unpopular opinion: phone calls > texts. We've lost something.", timeAgo: "7h", reactions: 15 },
  { id: "m6", friendId: "9", tag: "Thought",     text: "we romanticize being busy and call it a personality. stop.", timeAgo: "9h", reactions: 9 },
  { id: "m7", friendId: "13", tag: "Life Update", text: "moving back to bangalore next month. round 2.", timeAgo: "11h", photo: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=600", reactions: 7 },
  { id: "m8", friendId: "6", tag: "Milestone",   text: "first paycheck from the side project. cried a little.", timeAgo: "14h", reactions: 24 },
  { id: "m9", friendId: "18", tag: "Mood",       text: "the older i get the more i text my mom for no reason.", timeAgo: "18h", reactions: 11 },
  { id: "m10", friendId: "15", tag: "Life Update", text: "Coldplay tonight. Twelve year old me would not believe this.", timeAgo: "21h", photo: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600", reactions: 19 },
];

export const PULSE_WORDS = ["tired","grateful","anxious","lit","meh","soft","wired","okay","heavy","glowing"];
export const PULSE_EMOJI = ["😮‍💨","🥲","🔥","🌧️","✨","🫠","💫","🌙","☕️","🌿"];
export const PULSE_COLORS = ["#7F77DD","#E48CB0","#5BCFC1","#E4B86C","#7CB4E4","#9BE49E","#C9A3F0","#8B8A9B"];

export const TODAYS_PULSES = FRIENDS.slice(0, 18).map((f, i) => ({
  friendId: f.id,
  word: PULSE_WORDS[i % PULSE_WORDS.length],
  emoji: PULSE_EMOJI[i % PULSE_EMOJI.length],
  color: PULSE_COLORS[i % PULSE_COLORS.length],
}));

export const WAITING_ROOM = [
  { id: "w1", name: "Aanya",  initials: "AA", mutuals: 4, avatar: avatarUrl(48) },
  { id: "w2", name: "Veer",   initials: "VE", mutuals: 2, avatar: avatarUrl(58) },
  { id: "w3", name: "Saanvi", initials: "SA", mutuals: 6, avatar: avatarUrl(45) },
];

export const ME = { name: "You", initials: "YO", avatar: avatarUrl(15) };

// Games
export type Game = {
  id: string;
  emoji: string;
  name: string;
  players: string;
  description: string;
  price: "Free" | string;
};

export const GAMES: Game[] = [
  { id: "know-me",     emoji: "🧠", name: "How Well Do You Know Me?", players: "2 players", description: "Answer questions about yourself. Let your friend guess.", price: "Free" },
  { id: "most-likely", emoji: "🎯", name: "Most Likely To",            players: "All 25",   description: "Vote on your circle. Results will surprise you.", price: "Free" },
  { id: "truth-jar",   emoji: "🎲", name: "Truth Jar",                 players: "All 25",   description: "Drop anonymous questions. Answer in your own time.", price: "Free" },
  { id: "memory-map",  emoji: "🗺️", name: "Memory Map",                players: "2 players", description: "Build a shared visual map of your friendship.", price: "₹29" },
  { id: "rapid-fire",  emoji: "⚡", name: "Rapid Fire",                players: "2 players", description: "60 seconds. One word answers. How in sync are you?", price: "Free" },
  { id: "late-night",  emoji: "🌙", name: "Late Night Packs",          players: "2 players", description: "Deep questions for 3am conversations.", price: "₹49" },
];

export const ACTIVE_GAMES = [
  { id: "ag1", gameId: "most-likely", title: "Most Likely To", players: ["1","2","4","9"], progress: 0.6 },
  { id: "ag2", gameId: "know-me",     title: "Know Me · Priya", players: ["2"],            progress: 0.3 },
  { id: "ag3", gameId: "truth-jar",   title: "Truth Jar",       players: ["3","5","7"],     progress: 0.8 },
];
