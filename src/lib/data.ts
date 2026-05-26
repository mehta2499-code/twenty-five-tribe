export type Friend = {
  id: string;
  name: string;
  initials: string;
  color: string;
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

export const FRIENDS: Friend[] = NAMES.map((name, i) => ({
  id: String(i + 1),
  name,
  initials: name.slice(0, 2).toUpperCase(),
  color: PALETTE[i % PALETTE.length],
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
};

export const MOMENTS: Moment[] = [
  { id: "m1", friendId: "2",  tag: "Mood",        text: "okay so the chai today was actually unreal. small wins.", timeAgo: "12m" },
  { id: "m2", friendId: "1",  tag: "Milestone",   text: "signed the lease. tiny apartment, huge feelings.", timeAgo: "1h" },
  { id: "m3", friendId: "9",  tag: "Thought",     text: "we romanticize being busy and call it a personality. stop.", timeAgo: "3h" },
  { id: "m4", friendId: "4",  tag: "Life Update", text: "moving back to bangalore next month. round 2.", timeAgo: "5h" },
  { id: "m5", friendId: "13", tag: "Mood",        text: "soft launch of my villain era. minor inconveniences only.", timeAgo: "7h" },
  { id: "m6", friendId: "6",  tag: "Milestone",   text: "first paycheck from the side project. cried a little.", timeAgo: "9h" },
  { id: "m7", friendId: "18", tag: "Thought",     text: "the older i get the more i text my mom for no reason.", timeAgo: "12h" },
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
  { id: "w1", name: "Aanya", initials: "AA", mutuals: 4 },
  { id: "w2", name: "Veer",  initials: "VE", mutuals: 2 },
  { id: "w3", name: "Saanvi",initials: "SA", mutuals: 6 },
];

export const ME = { name: "You", initials: "YO" };
