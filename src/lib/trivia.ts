/**
 * Trivia question bank. Each entry: [question, correct answer, wrong, wrong, wrong].
 * A round picks ROUND questions at random and shuffles the options, so no two
 * games look the same. Challenges share a seed so both friends get the same round.
 */
export type TriviaQ = { q: string; options: string[]; answer: number };
type Raw = [string, string, string, string, string];

const BANK: Record<string, Raw[]> = {
  ipl: [
    ["Who has scored the most runs in IPL history?", "Virat Kohli", "Rohit Sharma", "David Warner", "MS Dhoni"],
    ["Which team won the first IPL, in 2008?", "Rajasthan Royals", "CSK", "RCB", "Mumbai Indians"],
    ["Who captained Rajasthan Royals to the 2008 title?", "Shane Warne", "Rahul Dravid", "Graeme Smith", "Yusuf Pathan"],
    ["Who holds the record for the fastest IPL century (30 balls)?", "Chris Gayle", "AB de Villiers", "KL Rahul", "Yusuf Pathan"],
    ["MS Dhoni's jersey number?", "7", "17", "27", "77"],
    ["Most expensive player at the auction for IPL 2024?", "Mitchell Starc", "Pat Cummins", "Cameron Green", "Sam Curran"],
    ["Who hit 158* in the very first IPL match?", "Brendon McCullum", "Sourav Ganguly", "Ricky Ponting", "Chris Gayle"],
    ["Highest individual score in IPL history?", "175* by Chris Gayle", "158* by Brendon McCullum", "133* by AB de Villiers", "132* by KL Rahul"],
    ["Home ground of Chennai Super Kings?", "Chepauk (M. A. Chidambaram)", "Wankhede", "Eden Gardens", "Chinnaswamy"],
    ["Home ground of Mumbai Indians?", "Wankhede", "Brabourne", "DY Patil", "Chepauk"],
    ["Home ground of Kolkata Knight Riders?", "Eden Gardens", "Salt Lake", "Chinnaswamy", "Feroz Shah Kotla"],
    ["While CSK was suspended (2016–17), Dhoni played for?", "Rising Pune Supergiant", "Gujarat Lions", "Delhi Daredevils", "Kochi Tuskers"],
    ["Who won IPL 2016?", "Sunrisers Hyderabad", "RCB", "Mumbai Indians", "KKR"],
    ["Deccan Chargers won the IPL in which year?", "2009", "2008", "2010", "2012"],
    ["IPL 2009 was played in which country?", "South Africa", "UAE", "England", "Sri Lanka"],
    ["IPL 2020 was played in?", "UAE", "India", "South Africa", "England"],
    ["KKR won their first IPL title in?", "2012", "2010", "2014", "2016"],
    ["Which team won the IPL in its debut season, 2022?", "Gujarat Titans", "Lucknow Super Giants", "Punjab Kings", "Delhi Capitals"],
    ["Who captained Gujarat Titans to the 2022 title?", "Hardik Pandya", "Shubman Gill", "Rashid Khan", "David Miller"],
    ["Which team won its first IPL title in 2025?", "RCB", "Punjab Kings", "Delhi Capitals", "Lucknow Super Giants"],
    ["Who won IPL 2024?", "KKR", "SRH", "RCB", "CSK"],
    ["Who won IPL 2023?", "CSK", "Gujarat Titans", "Mumbai Indians", "KKR"],
    ["The Orange Cap goes to the season's…", "Top run-scorer", "Top wicket-taker", "Best fielder", "Best captain"],
    ["The Purple Cap goes to the season's…", "Top wicket-taker", "Top run-scorer", "Most sixes", "Best economy"],
    ["Virat Kohli scored 973 runs in a single IPL season in?", "2016", "2013", "2018", "2023"],
    ["Shah Rukh Khan co-owns which team?", "KKR", "Mumbai Indians", "RCB", "Rajasthan Royals"],
    ["Preity Zinta co-owns which team?", "Punjab Kings", "Delhi Capitals", "RCB", "SRH"],
    ["'Korbo Lorbo Jeetbo' is the slogan of?", "KKR", "CSK", "SRH", "RCB"],
    ["Which team scored 287/3 in 2024, then the highest IPL total?", "SRH", "RCB", "KKR", "Mumbai Indians"],
    ["Who is known as 'Mr IPL'?", "Suresh Raina", "Rohit Sharma", "Virat Kohli", "AB de Villiers"],
    ["Who calls himself the 'Universe Boss'?", "Chris Gayle", "Kieron Pollard", "Andre Russell", "Dwayne Bravo"],
    ["Who took the first hat-trick in IPL history?", "Lakshmipathy Balaji", "Amit Mishra", "Yuvraj Singh", "Rohit Sharma"],
    ["First bowler to take 200 IPL wickets?", "Yuzvendra Chahal", "Dwayne Bravo", "Lasith Malinga", "Amit Mishra"],
    ["Who took 5 for 5 for RCB in IPL 2009?", "Anil Kumble", "Zaheer Khan", "Praveen Kumar", "Dale Steyn"],
    ["Delhi Capitals were earlier called?", "Delhi Daredevils", "Delhi Dynamos", "Delhi Warriors", "Delhi Kings"],
    ["Kings XI Punjab became Punjab Kings in?", "2021", "2018", "2019", "2023"],
    ["Sunrisers Hyderabad replaced which team?", "Deccan Chargers", "Kochi Tuskers", "Pune Warriors", "Gujarat Lions"],
    ["Lucknow Super Giants joined the IPL in?", "2022", "2020", "2021", "2023"],
    ["Who founded the IPL as its first chairman?", "Lalit Modi", "Sharad Pawar", "N. Srinivasan", "Sourav Ganguly"],
    ["Which two teams have won 5 IPL titles each?", "CSK and Mumbai Indians", "CSK and KKR", "MI and KKR", "CSK and RCB"],
  ],
  indiagk: [
    ["Capital of Arunachal Pradesh?", "Itanagar", "Imphal", "Aizawl", "Kohima"],
    ["Which river is called Dakshin Ganga?", "Godavari", "Krishna", "Kaveri", "Narmada"],
    ["Who was India's first woman Prime Minister?", "Indira Gandhi", "Sarojini Naidu", "Pratibha Patil", "Sushma Swaraj"],
    ["India's officially declared national sport?", "None declared", "Hockey", "Cricket", "Kabaddi"],
    ["The world's tallest statue stands in which state?", "Gujarat", "Maharashtra", "Rajasthan", "Karnataka"],
    ["Whom does the Statue of Unity depict?", "Sardar Vallabhbhai Patel", "Mahatma Gandhi", "B. R. Ambedkar", "Subhas Chandra Bose"],
    ["India's national animal?", "Bengal tiger", "Asiatic lion", "Indian elephant", "Snow leopard"],
    ["India's national bird?", "Peacock", "Parrot", "Eagle", "Sparrow"],
    ["India's national aquatic animal?", "Ganges river dolphin", "Olive ridley turtle", "Mahseer", "Saltwater crocodile"],
    ["India's national fruit?", "Mango", "Banana", "Jackfruit", "Guava"],
    ["How many states does India have?", "28", "29", "27", "30"],
    ["Largest Indian state by area?", "Rajasthan", "Madhya Pradesh", "Maharashtra", "Uttar Pradesh"],
    ["Smallest Indian state by area?", "Goa", "Sikkim", "Tripura", "Mizoram"],
    ["Most populous Indian state?", "Uttar Pradesh", "Maharashtra", "Bihar", "West Bengal"],
    ["Highest peak lying entirely within India?", "Nanda Devi", "Kamet", "Trisul", "Saltoro Kangri"],
    ["Who wrote 'Jana Gana Mana'?", "Rabindranath Tagore", "Bankim Chandra Chatterjee", "Sarojini Naidu", "Muhammad Iqbal"],
    ["Who wrote 'Vande Mataram'?", "Bankim Chandra Chatterjee", "Rabindranath Tagore", "Subramania Bharati", "Sri Aurobindo"],
    ["India's first Prime Minister?", "Jawaharlal Nehru", "Sardar Patel", "Lal Bahadur Shastri", "Rajendra Prasad"],
    ["India's first President?", "Rajendra Prasad", "S. Radhakrishnan", "Zakir Husain", "V. V. Giri"],
    ["Who is called the 'Missile Man of India'?", "A. P. J. Abdul Kalam", "Vikram Sarabhai", "Homi Bhabha", "Satish Dhawan"],
    ["India's Constitution came into effect on?", "26 January 1950", "15 August 1947", "26 November 1949", "2 October 1950"],
    ["Chief architect of the Indian Constitution?", "B. R. Ambedkar", "Jawaharlal Nehru", "Rajendra Prasad", "Sardar Patel"],
    ["How many spokes does the Ashoka Chakra have?", "24", "12", "16", "32"],
    ["Who built the Taj Mahal?", "Shah Jahan", "Akbar", "Jahangir", "Aurangzeb"],
    ["The ₹ symbol was adopted in?", "2010", "2005", "2014", "2000"],
    ["Chandrayaan-3 landed near the Moon's…", "South pole", "North pole", "Equator", "Far side"],
    ["ISRO's headquarters is in?", "Bengaluru", "Sriharikota", "Thiruvananthapuram", "Hyderabad"],
    ["Which city is the 'Pink City'?", "Jaipur", "Jodhpur", "Udaipur", "Bikaner"],
    ["Which city is the 'City of Lakes'?", "Udaipur", "Bhopal", "Srinagar", "Nainital"],
    ["India's largest coastal lagoon?", "Chilika", "Pulicat", "Vembanad", "Sambhar"],
    ["The Golden Temple is in?", "Amritsar", "Ludhiana", "Chandigarh", "Patiala"],
    ["Kathakali is a classical dance from?", "Kerala", "Tamil Nadu", "Odisha", "Manipur"],
    ["Bharatanatyam comes from?", "Tamil Nadu", "Kerala", "Andhra Pradesh", "Karnataka"],
    ["Gandhi's Dandi (Salt) March was in?", "1930", "1920", "1942", "1919"],
    ["How many languages are in the Eighth Schedule?", "22", "18", "24", "15"],
    ["First Indian in space?", "Rakesh Sharma", "Kalpana Chawla", "Sunita Williams", "Ravish Malhotra"],
    ["India's first Nobel laureate?", "Rabindranath Tagore", "C. V. Raman", "Mother Teresa", "Amartya Sen"],
    ["The Hornbill Festival is held in?", "Nagaland", "Assam", "Meghalaya", "Mizoram"],
    ["The Sundarbans are famous for?", "Mangroves and Bengal tigers", "Deserts", "Coral reefs", "Glaciers"],
    ["The Gateway of India is in?", "Mumbai", "New Delhi", "Kolkata", "Chennai"],
  ],
  bolly00s: [
    ["Who directed Kabhi Khushi Kabhie Gham (2001)?", "Karan Johar", "Yash Chopra", "Aditya Chopra", "Sanjay Leela Bhansali"],
    ["'All izz well' is from which film?", "3 Idiots", "PK", "Munna Bhai MBBS", "Taare Zameen Par"],
    ["Lead actress of Kal Ho Naa Ho?", "Preity Zinta", "Rani Mukerji", "Kareena Kapoor", "Aishwarya Rai"],
    ["Which film made Hrithik Roshan a star in 2000?", "Kaho Naa… Pyaar Hai", "Mission Kashmir", "Fiza", "Yaadein"],
    ["Lagaan released in?", "2001", "1999", "2000", "2002"],
    ["Who directed Dil Chahta Hai?", "Farhan Akhtar", "Zoya Akhtar", "Karan Johar", "Imtiaz Ali"],
    ["Who played Circuit in Munna Bhai MBBS?", "Arshad Warsi", "Boman Irani", "Jimmy Shergill", "Rajkumar Hirani"],
    ["Who directed Rang De Basanti?", "Rakeysh Omprakash Mehra", "Rajkumar Hirani", "Ashutosh Gowariker", "Farhan Akhtar"],
    ["Who played Ishaan in Taare Zameen Par?", "Darsheel Safary", "Partho Gupte", "Harsh Mayar", "Ahsaas Channa"],
    ["In 3 Idiots, what's the college called?", "Imperial College of Engineering", "Indian Institute of Engineering", "Royal Engineering College", "Delhi College of Engineering"],
    ["Who played Geet in Jab We Met?", "Kareena Kapoor", "Katrina Kaif", "Priyanka Chopra", "Vidya Balan"],
    ["Chak De! India is about which sport?", "Women's hockey", "Cricket", "Football", "Kabaddi"],
    ["Which actress debuted in Om Shanti Om?", "Deepika Padukone", "Anushka Sharma", "Sonam Kapoor", "Katrina Kaif"],
    ["Who directed Devdas (2002)?", "Sanjay Leela Bhansali", "Yash Chopra", "Karan Johar", "Mansoor Khan"],
    ["Who played Baburao in Hera Pheri?", "Paresh Rawal", "Johnny Lever", "Om Puri", "Rajpal Yadav"],
    ["Kal Ho Naa Ho is set in which city?", "New York", "London", "Sydney", "Toronto"],
    ["What's the alien called in Koi… Mil Gaya?", "Jaadu", "Jhoomru", "Chamatkar", "Bholu"],
    ["Who played the bike-riding villain in Dhoom (2004)?", "John Abraham", "Hrithik Roshan", "Aamir Khan", "Uday Chopra"],
    ["In Swades, where does SRK's character work?", "NASA", "ISRO", "Google", "CERN"],
    ["Who directed Golmaal (2006)?", "Rohit Shetty", "Priyadarshan", "David Dhawan", "Anees Bazmee"],
    ["Lead pair of Jodhaa Akbar?", "Hrithik Roshan and Aishwarya Rai", "SRK and Kajol", "Aamir Khan and Kareena", "Ranbir and Deepika"],
    ["Who played the lead in Black (2005)?", "Rani Mukerji", "Vidya Balan", "Tabu", "Kajol"],
    ["Rock On!! (2008) was whose acting debut?", "Farhan Akhtar", "Arjun Rampal", "Purab Kohli", "Luke Kenny"],
    ["Who directed Veer-Zaara?", "Yash Chopra", "Aditya Chopra", "Karan Johar", "Kunal Kohli"],
    ["In Mohabbatein, Amitabh Bachchan runs which school?", "Gurukul", "St. Teresa's", "Pine Hills", "Doon Valley"],
    ["Which 2008 film is often called Bollywood's first ₹100-crore hit?", "Ghajini", "Rab Ne Bana Di Jodi", "Singh Is Kinng", "Race"],
    ["Who played the lead in Krrish (2006)?", "Hrithik Roshan", "Abhishek Bachchan", "Shahid Kapoor", "John Abraham"],
    ["Who plays Kabir Khan in Chak De! India?", "Shah Rukh Khan", "Salman Khan", "Aamir Khan", "Akshay Kumar"],
    ["Wake Up Sid (2009) starred Ranbir Kapoor and?", "Konkona Sen Sharma", "Deepika Padukone", "Anushka Sharma", "Katrina Kaif"],
    ["Who played Rancho in 3 Idiots?", "Aamir Khan", "R. Madhavan", "Sharman Joshi", "Shah Rukh Khan"],
  ],
  hindimusic: [
    ["'Tum hi ho' was sung by?", "Arijit Singh", "Atif Aslam", "Mohit Chauhan", "Sonu Nigam"],
    ["Music directors of 'Kal Ho Naa Ho'?", "Shankar–Ehsaan–Loy", "A. R. Rahman", "Pritam", "Vishal–Shekhar"],
    ["'Pasoori' came out in?", "2022", "2020", "2021", "2023"],
    ["'Channa Mereya' is from?", "Ae Dil Hai Mushkil", "Dear Zindagi", "Tamasha", "Rockstar"],
    ["Who sang 'Kesariya'?", "Arijit Singh", "Pritam", "Jubin Nautiyal", "Armaan Malik"],
    ["'Tum hi ho' is from which film?", "Aashiqui 2", "Ek Villain", "Yeh Jawaani Hai Deewani", "Rockstar"],
    ["Who composed 'Jai Ho'?", "A. R. Rahman", "Pritam", "Amit Trivedi", "Vishal–Shekhar"],
    ["'Chaiyya Chaiyya' was filmed on top of a…", "Train", "Bus", "Boat", "Rooftop"],
    ["Who sang the title song 'Chak De India'?", "Sukhwinder Singh", "Shankar Mahadevan", "Sonu Nigam", "KK"],
    ["'Kajra Re' is from?", "Bunty Aur Babli", "Dhoom", "Salaam Namaste", "No Entry"],
    ["'Munni Badnaam Hui' is from?", "Dabangg", "Singham", "Rowdy Rathore", "Wanted"],
    ["'Sheila Ki Jawani' is from?", "Tees Maar Khan", "Housefull", "Golmaal 3", "Dabangg"],
    ["Who sang 'Lag Jaa Gale'?", "Lata Mangeshkar", "Asha Bhosle", "Geeta Dutt", "Shreya Ghoshal"],
    ["Who sang 'Mere Sapnon Ki Rani'?", "Kishore Kumar", "Mohammed Rafi", "Mukesh", "Manna Dey"],
    ["'Kun Faya Kun' is from?", "Rockstar", "Delhi-6", "Tamasha", "Jab Tak Hai Jaan"],
    ["'Gerua' is from?", "Dilwale", "Fan", "Raees", "Jab Harry Met Sejal"],
    ["'Badtameez Dil' is from?", "Yeh Jawaani Hai Deewani", "Cocktail", "Barfi!", "Student of the Year"],
    ["'London Thumakda' is from?", "Queen", "Cocktail", "Tanu Weds Manu", "Band Baaja Baaraat"],
    ["'Malhari' is from?", "Bajirao Mastani", "Padmaavat", "Goliyon Ki Raasleela Ram-Leela", "Tanhaji"],
    ["'Kesariya' is from?", "Brahmāstra", "Shershaah", "Pathaan", "Rocky Aur Rani"],
    ["Who composed Rang De Basanti's songs?", "A. R. Rahman", "Shankar–Ehsaan–Loy", "Pritam", "Amit Trivedi"],
    ["Who sang 'Saathiya' (2002)?", "Sonu Nigam", "Udit Narayan", "KK", "Shaan"],
    ["'Apna Time Aayega' is from?", "Gully Boy", "Dil Dhadakne Do", "Zero", "Simmba"],
    ["'Naatu Naatu' won the Oscar for?", "Best Original Song", "Best Score", "Best Sound", "Best Dance"],
    ["Who sang 'Why This Kolaveri Di'?", "Dhanush", "Anirudh Ravichander", "A. R. Rahman", "Sid Sriram"],
    ["'Ilahi' is from?", "Yeh Jawaani Hai Deewani", "Zindagi Na Milegi Dobara", "Rockstar", "Tamasha"],
    ["'Pehla Nasha' is from?", "Jo Jeeta Wohi Sikandar", "Qayamat Se Qayamat Tak", "Dil", "Raja Hindustani"],
    ["Who sang 'Chammak Challo' with Hamsika Iyer?", "Akon", "Pitbull", "Sean Paul", "Snoop Dogg"],
    ["'Tujh Mein Rab Dikhta Hai' is from?", "Rab Ne Bana Di Jodi", "Jab Tak Hai Jaan", "Veer-Zaara", "Chak De! India"],
    ["'Ae Dil Hai Mushkil' title song singer?", "Arijit Singh", "Atif Aslam", "Mohit Chauhan", "Javed Ali"],
  ],
  desilife: [
    ["Universal answer to 'kya kar raha hai'?", "Kuch nahi, bata", "Bas, free hu", "Yaar abhi busy hu", "Kaam kar raha"],
    ["Maggi time: packet says vs reality?", "2 min vs 8 min", "2 min vs 2 min", "2 min vs 5 min", "2 min vs 15 min"],
    ["Wedding DJ's mandatory banger?", "Kala Chashma", "London Thumakda", "Bole Chudiyan", "Mehndi Laga Ke Rakhna"],
    ["What does 'achha theek hai' really mean?", "All of the above", "Ok fine", "I'm done arguing", "Whatever you say"],
    ["Vada pav is the iconic street food of?", "Mumbai", "Delhi", "Kolkata", "Chennai"],
    ["Dal makhani is made mainly with?", "Whole black urad dal", "Moong dal", "Masoor dal", "Chana dal"],
    ["Odisha and which state both claim the rasgulla?", "West Bengal", "Bihar", "Assam", "Jharkhand"],
    ["Onam is celebrated mainly in?", "Kerala", "Tamil Nadu", "Karnataka", "Goa"],
    ["Pongal is a harvest festival of?", "Tamil Nadu", "Punjab", "Assam", "Gujarat"],
    ["Bihu is celebrated in?", "Assam", "Bihar", "Odisha", "Manipur"],
    ["Lohri is big in?", "Punjab", "Kerala", "Goa", "West Bengal"],
    ["Mumbai's famous lunch-box delivery heroes?", "Dabbawalas", "Tiffinwalas", "Lunchwalas", "Thaliwalas"],
    ["Which spice is NOT usual in masala chai?", "Cumin", "Cardamom", "Ginger", "Clove"],
    ["Petha is the famous sweet of?", "Agra", "Mathura", "Varanasi", "Lucknow"],
    ["Mysore pak comes from?", "Karnataka", "Tamil Nadu", "Kerala", "Andhra Pradesh"],
    ["Rogan josh is from which cuisine?", "Kashmiri", "Punjabi", "Mughlai", "Awadhi"],
    ["Dhokla is a classic snack from?", "Gujarat", "Maharashtra", "Rajasthan", "Madhya Pradesh"],
    ["Litti chokha is from?", "Bihar", "Punjab", "Rajasthan", "Odisha"],
    ["Bebinca, the layered dessert, is from?", "Goa", "Kerala", "Sikkim", "Puducherry"],
    ["'Jugaad' means?", "A clever, low-cost hack", "A wedding ritual", "A kind of sweet", "A cricket shot"],
    ["Who hosts Kaun Banega Crorepati?", "Amitabh Bachchan", "Shah Rukh Khan", "Salman Khan", "Anil Kapoor"],
    ["Amul is headquartered in?", "Anand, Gujarat", "Pune", "Delhi", "Bengaluru"],
    ["The 'G' in Parle-G originally stood for?", "Glucose", "Genius", "Gold", "Ghee"],
    ["Who is 'Sharma ji ka beta'?", "The kid your parents compare you to", "Your neighbour's dog", "A cricketer", "A TV villain"],
    ["Kumbh Mela rotates between Prayagraj, Haridwar, Ujjain and?", "Nashik", "Varanasi", "Pushkar", "Puri"],
    ["Ganpati's favourite sweet?", "Modak", "Jalebi", "Rasgulla", "Kaju katli"],
    ["Rangoli is called what in Tamil Nadu?", "Kolam", "Alpana", "Mandana", "Muggulu"],
    ["Who popularised the word 'Jhakaas'?", "Anil Kapoor", "Govinda", "Jackie Shroff", "Sunil Shetty"],
    ["South Indian filter coffee is served in a tumbler and?", "Dabara (davara)", "Kulhad", "Lota", "Katori"],
    ["Ghewar is the sweet of which festival?", "Teej", "Onam", "Pongal", "Bihu"],
    ["Mom's universal 'I'm not angry' sign?", "Calling you by your full name", "Making your favourite food", "Hugging you", "Ordering pizza"],
    ["When a relative asks 'beta, kya kar rahe ho aajkal?' you say…", "'Bas, padhai'", "The truth", "'Startup'", "Nothing, you run"],
  ],
};

export const ROUND = 10;
export const bankSize = (pack: string) => (BANK[pack] ?? []).length;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T,>(arr: T[], r: () => number) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Questions you've seen recently on this phone, so solo games bring new ones first. */
const SEEN_KEY = (pack: string) => `tf.trivia.seen.${pack}`;
function seen(pack: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY(pack)) ?? "[]");
  } catch {
    return [];
  }
}
export function markSeen(pack: string, qs: TriviaQ[]) {
  try {
    const keep = [...qs.map((q) => q.q), ...seen(pack)].slice(0, Math.max(0, bankSize(pack) - ROUND));
    localStorage.setItem(SEEN_KEY(pack), JSON.stringify(keep));
  } catch {
    // ignore
  }
}

/**
 * A round of questions with shuffled options. Same pack + seed → same round
 * (used for challenges). With `fresh`, questions you haven't seen come first.
 */
export function buildRound(pack: string, seed: number, fresh = false): TriviaQ[] {
  const r = rng(seed);
  const raw = BANK[pack] ?? [];
  let order = shuffle(raw, r);
  if (fresh) {
    const old = new Set(seen(pack));
    order = [...order.filter((x) => !old.has(x[0])), ...order.filter((x) => old.has(x[0]))];
  }
  return order.slice(0, ROUND).map(([q, right, ...wrong]) => {
    const options = shuffle([right, ...wrong], r);
    return { q, options, answer: options.indexOf(right) };
  });
}
