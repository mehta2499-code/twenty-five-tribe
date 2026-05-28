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

// Back-compat alias
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
  { id: "ipl",       emoji: "🏏", name: "IPL Legends",     tagline: "Who knows their cricket?",       questions: 25, difficulty: 2, price: "Free", gradient: "linear-gradient(135deg,#1e3a8a,#7F77DD)" },
  { id: "bolly00s",  emoji: "🎬", name: "Bollywood 2000s", tagline: "SRK or Salman?",                  questions: 30, difficulty: 2, price: "₹29",  gradient: "linear-gradient(135deg,#9b1c4a,#D4537E)" },
  { id: "indiagk",   emoji: "🗺️", name: "India GK",        tagline: "How desi are you really?",        questions: 25, difficulty: 3, price: "Free", gradient: "linear-gradient(135deg,#0f5132,#1D9E75)" },
  { id: "hindimusic",emoji: "🎵", name: "Hindi Music",     tagline: "Name the song from the lyrics",   questions: 30, difficulty: 3, price: "₹29",  gradient: "linear-gradient(135deg,#5b21b6,#A39CFF)" },
  { id: "desilife",  emoji: "😂", name: "Desi Life",       tagline: "Only Indians will get this",      questions: 20, difficulty: 1, price: "Free", gradient: "linear-gradient(135deg,#9a3412,#E4B86C)" },
];

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
    { q: "'Mere paas Ma hai' — wait wrong era. Lagaan released in?", options: ["1999","2000","2001","2002"], answer: 2 },
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
    { q: "Wedding shaadi DJ's mandatory opening song?",           options: ["Kala Chashma","London Thumakda","Bole Chudiyan","Mehndi Laga Ke Rakhna"], answer: 0 },
    { q: "What does 'achha theek hai' really mean?",              options: ["Ok fine","I'm done arguing","Whatever you say","All of the above"], answer: 3 },
  ],
};
