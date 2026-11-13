/* Course data, taken word for word from the HIST 1550 / EALC 1711 syllabus (Fall 2025, unchanged for Fall 2026).
   `citation` reproduces the syllabus line; `starred` is the syllabus asterisk (*), which the syllabus glosses as
   "a first-hand account, penned by a participant in an event". The asterisk is kept as its own label and never decides
   what kind of evidence a reading is: `genre` does that (Phase 0 of the redesign; Toby's chapter is modern scholarship
   although the syllabus stars it). `from`/`to` are the years a reading is ABOUT, used only to judge fit with a game's era. */
import type { CourseSource, Design, Source } from "./types";

export const POLICY = "You MAY use generative AI in this course on the front end of all explorations but NOT the back end. On the front end, you MAY USE generative AI to gather/organize information and/or to brainstorm. Be aware, however, that like any other text/narrative (our pre-recorded lectures, course readings, news articles, etc.), all generative AI responses must be properly vetted and contextualized to be of any use. You MAY NOT USE generative AI to produce text for discussion posts, wiki assignments, blog posts, or final papers, or to generate slides for powerpoint presentations. Submitting as your own any text or slides produced by generative AI is plagiarism and will be referred to Penn’s Office of Student Conduct for possible disciplinary action. If in doubt, please ask us!";
export const COURSE_SPAN: [number, number] = [-300, 2026];

export const COURSE_SOURCES: CourseSource[] = [
  {key:"holcombe", type:"secondary", genre:"scholarship", starred:false, short:"Holcombe, A History of East Asia", citation:"Charles Holcombe, A History of East Asia: From Origins of Civilization to 21st Century, 2nd ed. (2017)", week:"Main text, all weeks", from:-3000, to:2026, any:true, terms:["Holcombe"]},
  {key:"spence", type:"supplemental", genre:"scholarship", starred:false, short:"Spence, The Question of Hu", citation:"Jonathan Spence, The Question of Hu (1988)", week:"Weeks II–IV", from:1720, to:1726, terms:["Spence","Question of Hu","\\bHu\\b"]},
  {key:"cai", type:"supplemental", genre:"document", starred:false, short:"Cai, Miscellany of the South Seas", citation:"Cai Tinglan, Miscellany of the South Seas (1830s)", week:"Weeks V–VII", from:1835, to:1837, terms:["Cai Tinglan","Miscellany"]},
  {key:"terasaki", type:"supplemental", genre:"memoir", starred:false, short:"Terasaki, Bridge to the Sun", citation:"Gwen Terasaki, Bridge to the Sun (1957)", week:"Weeks VIII–XII", from:1931, to:1950, terms:["Terasaki","Bridge to the Sun"]},
  {key:"park", type:"supplemental", genre:"memoir", starred:false, short:"Park, Who Ate Up All the Shinga?", citation:"Wan-suh Park, Who Ate Up All the Shinga?: An Autobiographical Novel (1992)", week:"Weeks XIII–XV", from:1935, to:1953, terms:["Shinga","Wan-?suh","Park Wan","\\bPark\\b(?! Chung)"]},
  {key:"han", type:"primary", genre:"document", starred:true, short:"“The Imperial Order and Han Syntheses”", citation:"“The Imperial Order and Han Syntheses” (2nd cent, BCE), pp. 283-92", week:"Week II", from:-206, to:-100, terms:["Han Syntheses","Imperial Order"]},
  {key:"admonition", type:"primary", genre:"document", starred:true, short:"“Admonition to the New King” (1392)", citation:"“Admonition to the New King” (1392), pp. 274-6", week:"Week III", from:1392, to:1392, terms:["Admonition"]},
  {key:"toby", type:"secondary", genre:"scholarship", starred:true, short:"Toby, “Through the Looking-Glass of Protocol”", citation:"Ronald Toby, “Through the Looking-Glass of Protocol,” pp. 168-197", week:"Week III", from:1600, to:1750, terms:["Toby","Looking-Glass"]},
  {key:"macartney", type:"primary", genre:"document", starred:true, short:"Macartney's commission (1792-3)", citation:"“Ld Macartney’s Cmmssn from Henry Dundas,” etc. (1792-3), pp. 92-109", week:"Week IV", from:1792, to:1794, terms:["Macartney","Dundas"]},
  {key:"opium", type:"primary", genre:"document", starred:true, short:"“Memorial on Legalizing Opium” (1836)", citation:"“Memorial on Legalizing Opium (1836), pp. 110-4", week:"Week IV", from:1836, to:1836, terms:["Memorial on Legalizing Opium"]},
  {key:"nariaki", type:"primary", genre:"document", starred:true, short:"“Debates over Opening Japan” (1853)", citation:"”Debates over Open J” (Tokugawa Nariaki, Ii Naosuke [1853]), pp. 281-8", week:"Week V", from:1853, to:1853, terms:["Nariaki","Ii Naosuke","Debates over Open"]},
  {key:"kapsin", type:"primary", genre:"document", starred:true, short:"Kim Okkyun, “Kapsin Reform Edict” (1884)", citation:"Kim Okkyun, “Kapsin Reform Edict” (1884), p. 995-6", week:"Week V", from:1884, to:1884, terms:["Kapsin","Kim Ok-?kyun"]},
  {key:"harris", type:"primary", genre:"document", starred:true, short:"“Journal of Townsend Harris” (1857-8)", citation:"“Journal of Townsend Harris” (1857-8), pp. 117-22", week:"Week VI", from:1856, to:1858, terms:["Townsend Harris"]},
  {key:"yungwing", type:"primary", genre:"document", starred:true, short:"“Yung Wing advises the Taiping and Zeng Guofan”", citation:"“Yung Wing advises the Taiping and Zeng Guofan” (1859, 63), pp. 150-4", week:"Week VI", from:1859, to:1863, terms:["Yung Wing"]},
  {key:"min", type:"primary", genre:"document", starred:true, short:"Min Yonghwan, “One Policy out of a Thousand” (1894)", citation:"Min Yonghwan, “One Policy out of a Thousand” (1894), pp. 26-34", week:"Week VII", from:1894, to:1894, terms:["Min Yonghwan","One Policy"]},
  {key:"mahan", type:"primary", genre:"document", starred:true, short:"Mahan, Problem of Asia (1900)", citation:"Alfred T. Mahan, Problem of Asia (1900), pp. 191-4", week:"Week VII", from:1900, to:1900, terms:["Mahan"]},
  {key:"lensen", type:"primary", genre:"collection", starred:true, short:"Lensen, Russia's East Expansion", citation:"Lensen, Russia’s East Expansion, pp. 40-51; 89-96; 111-15 (1689,1856,96, 1900)", week:"Week VIII", from:1689, to:1900, terms:["Lensen"]},
  {key:"sakurai", type:"primary", genre:"document", starred:true, short:"Sakurai, Human Bullets (1907)", citation:"Sakurai Tadayoshi, Human Bullets (1907), pp. vii-13", week:"Week VIII", from:1904, to:1905, terms:["Sakurai","Human Bullets"]},
  {key:"crow", type:"primary", genre:"document", starred:true, short:"Crow, Japan and America: A Contrast (1916)", citation:"Carl Crow, Japan and America: A Contrast (1916), pp. 1-7", week:"Week IX", from:1916, to:1916, terms:["Carl Crow"]},
  {key:"renacimiento", type:"primary", genre:"reporting", starred:true, short:"“Taft’s Terms of Probation,” El Renacimiento (1908)", citation:"Editors, “Taft’s Terms of Probation,” El Renacimiento (1908), pp. 49-51", week:"Week IX", from:1908, to:1908, terms:["Renacimiento"]},
  {key:"shidehara", type:"primary", genre:"document", starred:true, short:"Shidehara, “A Rapprochement with China” (1929-30)", citation:"Shidehara Kijuro, “A Rapprochement with China,” etc. (1929-30), pp. 247-51", week:"Week X", from:1929, to:1930, terms:["Shidehara"]},
  {key:"whampoa", type:"primary", genre:"document", starred:true, short:"“Sun Yatsen Opens the Whampoa Military Academy” (1924)", citation:"“Sun Yatsen Opens the Whampoa Military Academy\" (1924), pp. 252-5", week:"Week X", from:1924, to:1924, terms:["Whampoa"]},
  {key:"kcongress", type:"primary", genre:"document", starred:true, short:"Korean Congress, “An Appeal to America” (1919)", citation:"Korean Congress in the U.S., “An Appeal to America” (1919), pp. 29-30", week:"Week XI", from:1919, to:1919, terms:["Appeal to America","Korean Congress"]},
  {key:"dewey", type:"primary", genre:"document", starred:true, short:"Dewey, “Japan and America” (1919)", citation:"John Dewey, “Japan and America” (1919), pp. 150-5", week:"Week XI", from:1919, to:1919, terms:["Dewey"]},
  {key:"chiang", type:"primary", genre:"document", starred:true, short:"Chiang Kaishek Responds to Konoe Fumimaro (1938)", citation:"Chiang Kaishek Responds to Konoe Fumimaro (Dec. 28, 1938)", week:"Week XII", from:1938, to:1938, terms:["Konoe"]},
  {key:"nogi", type:"supplemental", genre:"memoir", starred:true, short:"Nogi, “Keeping Order in the Indies” (1992)", citation:"Nogi Harumichi, “Keeping Order in the Indies” (1992), pp. 105-13", week:"Week XII", from:1941, to:1945, terms:["Nogi"]},
  {key:"service", type:"primary", genre:"document", starred:true, short:"Service, “Impression of Chinese Communist Leaders” (1944)", citation:"John S. Service, \"Impression of Chse Comm Leaders\" (1944), pp. 192-8", week:"Week XIII", from:1944, to:1944, terms:["John S\\. Service","Chse Comm Leaders"]},
  {key:"mao45", type:"primary", genre:"document", starred:true, short:"Mao, “The Situation and our Policy after the Victory…” (1945)", citation:"Mao Tse-tung, “The Situation and our Policy after the Victory in the War of Resistance against Japan” (Aug. 13, 1945), pp. 324-42", week:"Week XIII", from:1945, to:1945, terms:["Situation and our Policy"]},
  {key:"hochiminh", type:"primary", genre:"document", starred:true, short:"Ho Chi Minh, Letter to Harry Truman", citation:"Ho Chi Minh, Letter to Harry Truman (Feb. 16, 1945)", week:"Week XIV", from:1945, to:1945, terms:["Letter to (Harry )?Truman"]},
  {key:"eckstein", type:"primary", genre:"document", starred:true, short:"Eckstein, “Ping Pong Diplomacy” (1972)", citation:"Ruth Eckstein, “Ping Pong Diplomacy: View from behind Scenes” (1972), pp. 327-42", week:"Week XIV", from:1971, to:1972, terms:["Eckstein"]},
  {key:"kpa", type:"primary", genre:"document", starred:true, short:"KPA General Staff press statement (2025)", citation:"“Spokesman for KPA General Staff Issues Press Statement,” Naenara, Aug. 23, 2025", week:"Week XV", from:2025, to:2025, terms:["KPA","Naenara"]},
  {key:"sco", type:"primary", genre:"document", starred:true, short:"Cao Desheng, “Xi to chair SCO summit in Tianjin” (2025)", citation:"Cao Desheng, “Xi to chair SCO summit in Tianjin,” China Daily, Aug. 23, 2025", week:"Week XV", from:2025, to:2025, terms:["SCO summit","Cao Desheng"]}
];

export const ORDERS: Record<string, {name: string; hint: string}> = {
  tribute:{name:"Hierarchical tribute and investiture", hint:"Rank is expressed through ritual: tribute missions, investiture, calendars and titles. Equality between rulers is not the default."},
  rival:{name:"Rival centers of civilization", hint:"More than one court claims to stand at the center (e.g. a Japan-centered order, Đại Việt's ‘southern emperor’). Protocol is contested."},
  treaty:{name:"Treaty ports and unequal treaties", hint:"Western international law arrives alongside older ritual orders; extraterritoriality, consuls and indemnities coexist with tribute."},
  imperial:{name:"Imperial rivalry and spheres of influence", hint:"Empires compete for concessions, protectorates and railways; colonized peoples appeal to outside powers and principles."},
  cold:{name:"Cold War blocs and decolonization", hint:"Divided states, alliances, aid and recognition battles; informal channels (sport, trade offices) carry real weight."},
  custom:{name:"Your own framework", hint:"Describe in the premise how relations between polities were understood in your era."}
};
export const ERAS = [
  {label:"“Chinese World Order”", start:1368, end:1600, order:"tribute", week:"II"},
  {label:"Korean and Japanese appropriation of Chinese World Order (14th-17th cent)", start:1392, end:1700, order:"rival", week:"III"},
  {label:"East Meets West: Canton (18th century), “treaty port” system (19th century)", start:1700, end:1860, order:"treaty", week:"IV"},
  {label:"Treaty port in Japan and Korea (to 1880s)", start:1853, end:1889, order:"treaty", week:"V"},
  {label:"19th Century Border Crossings", start:1840, end:1895, order:"treaty", week:"VI"},
  {label:"Japanese and American Empires (late 19th century)", start:1894, end:1905, order:"imperial", week:"VII"},
  {label:"Russo-Japanese War (Early 20th Century)", start:1896, end:1910, order:"imperial", week:"VIII"},
  {label:"World War I", start:1914, end:1919, order:"imperial", week:"IX"},
  {label:"Wilson in Japan and China (1920s)", start:1919, end:1931, order:"imperial", week:"X"},
  {label:"Road to War (1930s)", start:1931, end:1941, order:"imperial", week:"XI"},
  {label:"Asian “Liberation” (1941-52)", start:1941, end:1952, order:"imperial", week:"XII"},
  {label:"Continuing War in Asia: China and Korea (1950s)", start:1945, end:1960, order:"cold", week:"XIII"},
  {label:"Vietnam and US Retrenchment (1950s-70s)", start:1954, end:1979, order:"cold", week:"XIV"},
  {label:"Integration or Asianization?", start:1979, end:2025, order:"cold", week:"XV"}
];
/* Dated names used to catch chronology slips: [pattern, from, to, label] */
export const ANCHORS: [string, number, number, string][] = [
  ["\\bancient\\b",-3000,500,"“Ancient” (before about 500 CE)"],
  ["Han dynasty|Han court|Han tributary|Han empire",-206,220,"the Han dynasty (206 BCE–220 CE)"],
  ["\\bMing\\b",1368,1644,"the Ming dynasty (1368–1644)"],
  ["\\bQing\\b",1636,1912,"the Qing dynasty (1636–1912)"],
  ["Joseon|Chos[ŏo]n",1392,1897,"the Joseon dynasty (1392–1897)"],
  ["Hideyoshi",1585,1598,"Toyotomi Hideyoshi's rule and invasions of Korea (1585–98)"],
  ["Tokugawa",1603,1868,"the Tokugawa shogunate (1603–1868)"],
  ["Dutch East India Company|\\bVOC\\b",1602,1799,"the Dutch East India Company (1602–1799)"],
  ["Macartney",1792,1794,"the Macartney embassy (1792–94)"],
  ["Cai Tinglan",1835,1837,"Cai Tinglan's voyage to Vietnam (1835–36)"],
  ["Opium War",1839,1860,"the Opium Wars (1839–42, 1856–60)"],
  ["treaty[- ]port",1842,1943,"the treaty-port system (1842–1943)"],
  ["Taiping",1850,1864,"the Taiping Rebellion (1850–64)"],
  ["Commodore Perry|Matthew Perry|\\bPerry\\b",1852,1854,"Perry's expedition to Japan (1853–54)"],
  ["Townsend Harris",1856,1861,"Townsend Harris in Japan (1856–61)"],
  ["Meiji",1868,1912,"the Meiji era (1868–1912)"],
  ["Kapsin|Kim Ok-?kyun",1884,1884,"the Kapsin coup and reform edict (1884)"],
  ["Sun Yat-?sen",1895,1925,"Sun Yat-sen's political career (1895–1925)"],
  ["Russo-Japanese War",1904,1905,"the Russo-Japanese War (1904–05)"],
  ["Woodrow Wilson|\\bWilson\\b",1913,1921,"Wilson's presidency (1913–21)"],
  ["League of Nations",1920,1946,"the League of Nations (1920–46)"],
  ["Shidehara",1924,1931,"Shidehara diplomacy (1924–31)"],
  ["Chiang Kai-?shek",1925,1975,"Chiang Kai-shek's leadership (1925–75)"],
  ["Mao Zedong|Mao Tse-tung|\\bMao\\b",1921,1976,"Mao Zedong's political career (1921–76)"],
  ["Ho Chi Minh",1919,1969,"Ho Chi Minh's political career (1919–69)"],
  ["United Nations",1945,2026,"the United Nations (1945–)"],
  ["Cold War",1947,1991,"the Cold War (1947–91)"],
  ["Korean War",1950,1953,"the Korean War (1950–53)"],
  ["ping[- ]pong",1971,1972,"ping-pong diplomacy (1971)"],
  ["Shanghai Cooperation Organi[sz]ation|\\bSCO\\b",2001,2026,"the Shanghai Cooperation Organization (2001–)"]
];
/* Modern diplomatic concepts and roughly when they reach East Asian practice: [pattern, from, label] */
export const MODERN_TERMS: [string, number, string][] = [
  ["resident ambassador|permanent embass|resident minister|legation",1860,"resident ambassadors and legations (in East Asia from about 1860)"],
  ["sovereign equal|equal sovereign|equal(ly)? sovereign|sovereign equality",1860,"sovereign equality between states (in East Asian practice from about 1860)"],
  ["nation-?states?",1870,"nation-states (from the late 19th century)"],
  ["international law",1860,"Western international law (adopted in East Asia from the 1860s)"],
  ["free trade",1842,"free trade (a treaty-port era idea, from 1842)"],
  ["foreign ministr|ministry of foreign affairs",1861,"foreign ministries (China's Zongli Yamen 1861, Japan's Gaimushō 1869)"]
];
export const KINDS = ["Imperial court","Royal court","Military government","Domain / local lord","Trading company","Merchant network","Envoy / individual","Religious order","Nation-state","Colonial government","Party / movement","International organization"];
export const BASE_TERRAIN = [
  "ddddddllllssss","ddddllllllslss","mdllllllllslls","mmllllllslslls","mmlllllsslslls",
  "mmllllllssllss","mmllllllssslss","mllllllssslsss","llllllssssssls","llllssssssssls"
];
export const uid = (): string => Math.random().toString(36).slice(2, 9);
export const courseOf = (key: string | undefined): CourseSource | undefined => COURSE_SOURCES.find(c => c.key === key);
export function srcFromCourse(key: string, id: string, extra: Partial<Source> = {}): Source {
  const s = courseOf(key);
  if (!s) throw new Error("Unknown course reading " + key);
  return {id, type:s.type, citation:s.citation, note:"", key, year:"", where:"Course reader / assigned text", fit:"", lookFor:"", ...extra};
}

/* ---------- sample world (sandbox: cannot be submitted to the library) ---------- */
export function sampleDesign(): Design {
  return {
    gid:"sample-tribute-silver", sandbox:true,
    title:"Tribute, Silver and Go-betweens",
    subtitle:"Managed contact in early modern East Asia",
    era:{label:"From the early Qing to the Canton system", start:1650, end:1795, week:"III–IV"},
    order:"rival",
    setting:"Maritime East Asia from Beijing to Nagasaki, Shuri and Thăng Long",
    premise:"Several courts claim a place in a civilized order centered on Beijing, but not all of them accept that center on Beijing's terms. Relations are ranked rather than equal. Players gain standing through ritual, licensed trade and well-placed go-betweens.",
    resources:[
      {key:"leg", name:"Legitimacy", meaning:"Standing in the ritual order: recognition by superiors, peers and one's own court."},
      {key:"silver", name:"Silver", meaning:"Trade revenue and the means to fund missions and gifts."},
      {key:"info", name:"Knowledge", meaning:"What a court knows of others, gathered by envoys, interpreters and merchants."},
      {key:"force", name:"Force", meaning:"Military capacity. Force used without ritual justification erodes legitimacy."}
    ],
    actors:[
      {id:"qing", name:"Qing Court", kind:"Imperial court", tile:[6,3], playable:true, worldview:"The emperor as Son of Heaven sits at the apex of a single civilized order. Foreign rulers are ranked by their ritual relationship to him, not treated as equals.", goal:"Keep tributaries in ritual alignment and the coasts quiet.", start:{leg:6,silver:5,info:3,force:6}},
      {id:"joseon", name:"Joseon Court", kind:"Royal court", tile:[9,4], playable:true, worldview:"A loyal tributary that sees itself as a guardian of Confucian civilization. Since the Qing conquest of 1644 many of its scholars privately regard the Manchu Qing as barbarians while the court still sends tribute.", goal:"Preserve the dynasty and its claim to orthodoxy.", start:{leg:5,silver:3,info:3,force:3}},
      {id:"tokugawa", name:"Tokugawa Bakufu", kind:"Military government", tile:[12,4], playable:true, worldview:"Sends no tribute to China. Builds its own order: contact through licensed gateways, and foreign embassies staged to display the shogun's authority.", goal:"Show domestic audiences that foreigners come to Edo.", start:{leg:5,silver:5,info:2,force:5}},
      {id:"ryukyu", name:"Ryukyu Kingdom", kind:"Royal court", tile:[11,6], playable:true, worldview:"A maritime kingdom that pays tribute to China while, after Satsuma's 1609 invasion, also answering to Satsuma, and keeps that second tie out of Chinese view.", goal:"Survive between two larger neighbors and keep the trade flowing.", start:{leg:3,silver:4,info:3,force:1}},
      {id:"daiviet", name:"Đại Việt", kind:"Royal court", tile:[2,9], playable:true, worldview:"Sends tribute north as a ‘king’ while its ruler is styled emperor at home: a southern civilized center in its own right.", goal:"Keep the northern border peaceful without conceding equality at home.", start:{leg:4,silver:3,info:2,force:4}},
      {id:"so", name:"Sō of Tsushima", kind:"Domain / local lord", tile:[10,5], playable:false, worldview:"A domain that lives off the Korea trade and acts as go-between for Edo and Hanseong, with every incentive to keep relations smooth.", goal:"Keep the Korea trade and the shogun's favor.", start:{leg:2,silver:3,info:4,force:1}},
      {id:"voc", name:"Dutch East India Company", kind:"Trading company", tile:[11,5], playable:false, worldview:"A company, not a state, allowed at Nagasaki on the shogunate's terms. Its factors deliver news reports to Japanese officials.", goal:"Keep its foothold and its profits.", start:{leg:1,silver:6,info:4,force:2}}
    ],
    map:{cols:14, rows:10, terrain:BASE_TERRAIN.slice(), places:[
      {c:6,r:3,name:"Beijing"},{c:9,r:4,name:"Hanseong"},{c:12,r:4,name:"Edo"},{c:10,r:5,name:"Tsushima"},{c:11,r:5,name:"Nagasaki"},
      {c:11,r:6,name:"Shuri"},{c:5,r:8,name:"Canton"},{c:2,r:9,name:"Thăng Long"},{c:12,r:8,name:"Manila"}]},
    sources:[
      srcFromCourse("holcombe","s1",{note:"Main text: tribute, Ming–Qing China, Confucian Korea, Đại Việt (pp. 132–66).", lookFor:"What each side gained from a tribute mission, and who set the terms of the exchange."}),
      srcFromCourse("toby","s2",{note:"Argues the Tokugawa built a Japan-centered order rather than isolating Japan.", lookFor:"How the bakufu staged Korean and Ryukyuan embassies for domestic audiences, and which gateways it allowed."}),
      srcFromCourse("spence","s3",{note:"Jesuits, converts and Canton in the 1720s: contact through individuals."}),
      srcFromCourse("admonition","s4",{note:"Ruler's virtue as the basis of legitimate power.", fit:"Written in 1392, before this game begins. Used only as a statement of the Confucian ideal of rule that Joseon officials continued to invoke, not as evidence of 17th-century events."}),
      srcFromCourse("macartney","s5",{note:"British instructions for an embassy seeking resident diplomats and open ports."})
    ],
    actions:[
      {id:"x1", name:"Present tribute at Beijing", who:["joseon","ryukyu","daiviet"], target:"qing",
        effects:[{to:"self",res:"silver",d:-1},{to:"self",res:"leg",d:2},{to:"self",res:"info",d:1},{to:"target",res:"leg",d:1}],
        readingSelf:"Our ruler's title is confirmed, and the trade attached to the mission more than pays for the gifts.",
        readingOther:"Beijing records another proof that civilization radiates from the Son of Heaven.",
        readings:{qing:"Another mission arrives at court, proof that the Son of Heaven's virtue draws distant rulers to him.",joseon:"Our envoys perform the rites the dynasty owes; privately some of us ask whether the Manchu court deserves them.",tokugawa:"Courts that bow at Beijing rank themselves below it; the shogun's Japan sends no such mission.",ryukyu:"The tribute ship keeps our king's title and the Fuzhou trade alive.",daiviet:"Our king bows north in form, while at home our ruler remains emperor of the south.",so:"What matters to Tsushima is that Joseon stays calm and the Korea trade continues.",voc:"Tribute missions carry licensed trade that the Company's ships cannot share in."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"Holcombe presents tribute as an exchange: legitimacy and trade access for the sender, and ritual confirmation for the emperor. So the card raises both sides' Legitimacy and costs only a little Silver.",
        trap:"Tribute was humiliating protection money paid by weak states.", source:"s1", page:"pp. 132–49", risk:{chance:0,effects:[],text:""}},
      {id:"x2", name:"Confer investiture", who:["qing"], target:"choose",
        effects:[{to:"self",res:"leg",d:1},{to:"target",res:"leg",d:2}],
        readingSelf:"A foreign ruler is ranked and placed within the imperial order.",
        readingOther:"Recognition from Beijing strengthens the ruler against rivals at home.",
        readings:{qing:"The emperor names and ranks a foreign ruler, placing him within the civilized order.",joseon:"A patent from Beijing confirms our king before his own officials and rivals.",tokugawa:"The shogun takes no title from Beijing; such patents mark a ruler as a subordinate.",ryukyu:"Investiture envoys at Shuri confirm the king, and we take care that they see nothing of Satsuma.",daiviet:"Investiture as king of Annam keeps the border quiet; at home our ruler's own titles are unchanged.",so:"A Beijing patent matters to Hanseong's standing; we watch only for what could disturb Joseon's dealings with Edo.",voc:"Ranks granted at Beijing decide who may trade there; the Company seeks entry on whatever terms keep the trade."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"Holcombe's discussion of Confucian Korea shows investiture mattering to the recipient's domestic standing, so the target gains more Legitimacy than the Qing does.",
        trap:"Recognition meant the stronger state ran the weaker one's internal affairs.", source:"s1", page:"pp. 149–66", risk:{chance:0,effects:[],text:""}},
      {id:"x3", name:"Send a communication embassy to Edo", who:["joseon"], target:"tokugawa",
        effects:[{to:"self",res:"silver",d:-2},{to:"self",res:"info",d:2},{to:"target",res:"leg",d:2}],
        readingSelf:"A mission of neighborly relations, and a close look at a former invader after the 1590s wars.",
        readingOther:"In Edo the procession is staged as foreigners coming to pay respects to the shogun.",
        readings:{qing:"A tributary exchanging envoys with a ruler outside the imperial order; Beijing is not a party to it.",joseon:"A mission of neighborly relations, and a chance to observe a former invader at close range.",tokugawa:"A grand procession to Edo shows daimyo and townspeople that foreigners come to honor the shogun.",ryukyu:"Ryukyu's own missions to Edo are staged the same way, so we know what the bakufu wants the crowds to see.",daiviet:"Two northern courts settle their relations without reference to Beijing; it does not reach our border.",so:"Our domain arranges and escorts the embassy; its success keeps our place between Edo and Hanseong.",voc:"The Company's factors at Nagasaki hear of the procession; it shows how the shogunate receives foreigners."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"Toby argues that the bakufu used Korean embassies to display its authority to domestic audiences. Joseon gains Knowledge from the trip; Edo gains Legitimacy from the spectacle.",
        trap:"An embassy means both sides agree on what the visit means.", source:"s2", page:"pp. 168-197", risk:{chance:0,effects:[],text:""}},
      {id:"x4", name:"Restrict trade to licensed gateways", who:["tokugawa","qing"], target:"none",
        effects:[{to:"self",res:"leg",d:1},{to:"self",res:"info",d:1},{to:"self",res:"silver",d:-1}],
        readingSelf:"Contact continues, but on our terms and through channels we license.",
        readingOther:"Foreign merchants find the door narrowed, not shut.",
        readings:{qing:"Trade is permitted through designated ports under officials' supervision, so foreigners stay within bounds.",joseon:"Contact with Japan already runs only through the Japan House at Busan; little changes for us.",tokugawa:"Contact continues, but only through Nagasaki, Tsushima, Satsuma and Matsumae, on our terms.",ryukyu:"Licensed channels on both sides make our ships more useful as a link between them.",daiviet:"When the northern courts narrow their ports, the trade reaching our coasts shifts; the court watches who arrives.",so:"A licensed gateway is our livelihood: the Korea trade runs through Tsushima and nowhere else.",voc:"The door narrows but stays open; the Company keeps its post by accepting the shogunate's rules."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"Toby describes contact managed through designated gateways rather than cut off, so the card trades some Silver for control (Legitimacy) and information.",
        trap:"A ‘closed country’ meant isolation from the world.", source:"s2", page:"pp. 168-197", risk:{chance:0,effects:[],text:""}},
      {id:"x5", name:"Serve two masters", who:["ryukyu"], target:"none",
        effects:[{to:"self",res:"silver",d:3}],
        readingSelf:"Survival as a small kingdom between two larger ones.",
        readingOther:"Satsuma profits from the China trade through Ryukyu without appearing in it.",
        readings:{qing:"To Beijing, Ryukyu remains a loyal tributary whose missions arrive on schedule.",joseon:"Joseon knows Ryukyu chiefly as a fellow tributary met at Beijing.",tokugawa:"Through Satsuma, Ryukyu's China trade serves Japanese interests while appearing to be Ryukyu's own.",ryukyu:"Survival as a small kingdom between two larger ones, each shown only the face it expects.",daiviet:"Another court balancing between larger powers; a position our own rulers understand.",so:"Like our own domain, Ryukyu lives as a go-between for other people's trade.",voc:"Chinese goods reach Japan by a channel the Company does not control."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"Left without a source on purpose so you can see the checklist flag it. Find a reading on Ryukyu's dual subordination before using this card.",
        trap:"A state can only be subordinate to one power at a time.", source:"", page:"",
        risk:{chance:33,effects:[{to:"self",res:"leg",d:-2}],text:"Chinese envoys glimpse Satsuma officials in Shuri, and the court must smooth things over."}},
      {id:"x6", name:"Collect the Dutch news reports", who:["tokugawa"], target:"voc",
        effects:[{to:"self",res:"info",d:2},{to:"target",res:"silver",d:1}],
        readingSelf:"Officials at Nagasaki gather news of the wider world as a condition of Dutch trade.",
        readingOther:"The price of keeping the only European trading post the shogunate permits.",
        readings:{qing:"Foreign merchants reporting to port officials is familiar; Beijing takes no part in Nagasaki's arrangements.",joseon:"Joseon has no share in these reports; its view of Japan comes through Tsushima and its own embassies.",tokugawa:"Officials at Nagasaki gather news of the wider world as a condition of Dutch trade.",ryukyu:"Edo gathers news from many directions, including what Ryukyu's missions bring back from China.",daiviet:"Dutch ships call at southern ports too; what they tell Edo about the region is beyond our reach.",so:"Edo's news from the Dutch sits alongside what our domain reports from Korea.",voc:"The price of keeping the only European trading post the shogunate permits."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"Left without a source on purpose so you can see the checklist flag it.",
        trap:"Tokugawa Japan knew nothing of the outside world.", source:"", page:"", risk:{chance:0,effects:[],text:""}},
      {id:"x7", name:"Punitive expedition", who:["any"], target:"choose",
        effects:[{to:"self",res:"force",d:-1},{to:"self",res:"leg",d:-1},{to:"target",res:"force",d:-1},{to:"target",res:"leg",d:-1}],
        readingSelf:"Force must be clothed in righteousness, or it costs the ruler standing.",
        readingOther:"An act of aggression to be reported to one's own overlord.",
        readings:{qing:"Force against a disobedient ruler is rectification, and justified only if the court's virtue is plain.",joseon:"After the Japanese invasions of the 1590s and the Manchu invasions of 1627 and 1636, force from a neighbor is a calamity to be reported and endured.",tokugawa:"The bakufu keeps the peace and avoids foreign wars; force abroad would revive the memory of Hideyoshi's campaigns.",ryukyu:"A small kingdom with little force of its own appeals to its overlords rather than fight.",daiviet:"Our rulers have turned back northern armies before; resisting invasion is part of their claim to rule.",so:"War between Edo and Hanseong would end the trade our domain lives on.",voc:"Violence threatens trade; the Company weighs any conflict by what it costs the ledger."},
        claimRationale:"assumption", claimReadings:"inference",
        rationale:"The Admonition ties a ruler's legitimacy to virtue rather than force, so using force costs the attacker Legitimacy as well as the target.",
        trap:"Military power converts directly into international standing.", source:"s4", page:"pp. 274-6", risk:{chance:0,effects:[],text:""}}
    ],
    opening:{year:1650, title:"A new dynasty in Beijing",
      text:"In 1644 Manchu armies took Beijing and proclaimed the Qing the rulers of China. Six years on, Ming loyalists still fight in the south and along the coast, close to Đại Việt's northern border, yet the Qing court already receives envoys as the Ming emperors did. Joseon, forced to submit to the Manchus in 1637, now sends its tribute missions to Beijing, though many of its scholars still honor the fallen Ming. In Japan the Tokugawa shogunate has expelled the Portuguese and keeps the Dutch at Nagasaki, handling foreign contact through a few licensed gateways. Ryukyu, invaded by Satsuma in 1609, still sends its missions to China.",
      ask:"Who now sits at the center of the civilized order, and how will your court answer the new court in Beijing?",
      source:"s1", sources:["s1","s2"]},
    events:[
      {id:"e3", year:1684, title:"The maritime ban is lifted", text:"Coastal trade reopens after the Qing secure Taiwan.", effects:[{to:"all",res:"silver",d:1}], source:"s1"},
      {id:"e4", year:1715, title:"New rules for the Nagasaki trade", text:"Chinese ships must carry trade licenses issued in Japan's name. The Qing court debates, then lets the trade continue.", effects:[{to:"tokugawa",res:"leg",d:1},{to:"qing",res:"info",d:1}], source:"s2"},
      {id:"e5", year:1757, title:"European trade confined to Canton", text:"The Qianlong emperor limits European ships to the single port of Canton, where licensed Chinese merchants handle their trade.", effects:[{to:"qing",res:"info",d:1},{to:"voc",res:"silver",d:-1}], source:"s1"},
      {id:"e6", year:1793, title:"The Macartney embassy", text:"Britain's envoy asks for a resident ambassador and more open ports. The Qianlong emperor receives the mission as tribute and declines.", effects:[{to:"qing",res:"leg",d:1}], source:"s5"}
    ],
    traps:[
      {modern:"States are sovereign equals that negotiate as peers.", historical:"Relations were ranked. Ritual form expressed, and negotiated, each ruler's place."},
      {modern:"Diplomacy is run by foreign ministries and professional diplomats.", historical:"Ritual offices, border domains, interpreters, merchants and converts carried relations."},
      {modern:"Paying tribute is a sign of weakness.", historical:"Rulers sought tribute relations for legitimacy, trade licenses and security."},
      {modern:"Tokugawa Japan was a closed country.", historical:"Contact was managed through designated gateways (Toby)."}
    ],
    victory:{rounds:4, res:"leg", text:"The court with the most Legitimacy after four rounds wins. In the debrief, ask what each court would itself have counted as success."},
    published:false, updatedAt:0
  };
}
export function blankDesign(): Design {
  return {
    gid:"g"+uid(), title:"Untitled world", subtitle:"", era:{label:"", start:"", end:"", week:""}, order:"custom",
    setting:"", premise:"",
    resources:[
      {key:"r1", name:"Legitimacy", meaning:""},{key:"r2", name:"Wealth", meaning:""},
      {key:"r3", name:"Knowledge", meaning:""},{key:"r4", name:"Force", meaning:""}],
    actors:[
      {id:"p"+uid(), name:"", kind:"Royal court", tile:null, playable:true, worldview:"", goal:"", start:{r1:3,r2:3,r3:3,r4:3}},
      {id:"p"+uid(), name:"", kind:"Royal court", tile:null, playable:true, worldview:"", goal:"", start:{r1:3,r2:3,r3:3,r4:3}}],
    map:{cols:14, rows:10, terrain:BASE_TERRAIN.slice(), places:[]},
    sources:[], actions:[], events:[], traps:[{modern:"", historical:""}],
    opening:{year:"", title:"", text:"", ask:"", source:""},
    victory:{rounds:4, res:"r1", text:""}, published:false, updatedAt:0
  };
}
