/* Phase 5: the Instruction Manual on the front page. Plain data plus one HTML renderer, so the wording can be
   checked in tests and edited in one place. It describes how the app actually behaves; if a rule changes in
   logic.ts or the server, change it here too. No course or textbook text appears here. */
import { POLICY } from "./data";

export interface Goal { title: string; does: string; aim: string; aimText: string }
export const GOALS: Goal[] = [
  { title: "Reason as the people of the era",
    does: "You play a court and decide as its rulers and envoys would, with the resources, rivals and worldview the readings give them.",
    aim: "History", aimText: "key people, places and events" },
  { title: "Spot anachronism",
    does: "Every move has a different reading for each court, and every world lists the modern assumptions it is built to catch, such as states as sovereign equals or tribute as a sign of weakness.",
    aim: "Interpretation", aimText: "different narratives of the same event" },
  { title: "Go back to the record",
    does: "Every vote names a reading and where in it your reason comes from. In the debrief your TA sends the class to that passage to check it.",
    aim: "Reading", aimText: "informed judgments about primary and secondary sources" },
  { title: "Think like a historian",
    does: "You make a claim, back it with evidence, and defend it out loud when the TA pauses the game.",
    aim: "Expression", aimText: "clear arguments" },
];

export interface Rule { term: string; text: string }
export const RULES: Rule[] = [
  { term: "A world", text: "Each game is a world designed for one era: its courts, resources, map, diplomatic actions, historical events and a set number of rounds (1 to 12)." },
  { term: "Rounds and turns", text: "In each round every court takes one turn, in the world's order. When the last court has moved, that round's historical event (if there is one) takes effect and the next round begins." },
  { term: "Courts are teams", text: "Everyone on a court votes on their own phone. Only the court whose turn it is sees its choices; everyone else watches the main screen." },
  { term: "A vote", text: "Choose an action (and the court it is aimed at, if the action needs one) or choose to pass. Then give your reason in your own words, the reading it comes from, and where in that reading (a page or section). A short quote is optional. A vote to pass needs one sentence on why your court waits; no source is needed for that." },
  { term: "How a turn resolves", text: "The turn resolves when everyone on the court has voted, or when the TA presses Reveal now. The action with the most votes is played; a tie goes to the action that was voted for first. The court it is aimed at is the one most chosen among those votes. The TA can also skip a turn, which counts as a pass." },
  { term: "Resources", text: "Each court holds the world's resources, such as legitimacy or silver. Actions spend and gain them for the acting court and for the court they are aimed at. You can't take an action you can't pay for." },
  { term: "Risk", text: "Some actions carry a stated chance of backfiring. If one does, its extra costs apply and the board shows that it backfired. The percentage is the designer's modeling choice, not a measure of historical uncertainty." },
  { term: "Readings", text: "The same move means different things to different courts. After each move the board shows how the target court read it, then how the acting court read it." },
  { term: "Events", text: "The designer ties historical events to rounds. An event takes effect at the end of its round, and everyone sees it." },
  { term: "Pauses", text: "By default the game stops after every round for discussion and waits until the TA continues. The TA can choose to pause after every move instead." },
  { term: "Victory", text: "After the last round, the debrief shows which court holds the most of the world's victory resource, with the designer's note on what winning would have meant. The courts of the era may not have seen it that way, and that is part of the discussion." },
  { term: "AI courts", text: "Courts that no student is playing are played by AI, so a game works with a single student. The AI is either rule-based (it scores each move by what the court gains, its risk, and whether it answers a move made toward it) or generative (Claude), and every AI move is labeled with which. The TA can switch this off, and then empty courts pass." },
];

export const PLAY_STEPS: string[] = [
  "The TA picks a game in the Class library and presses Host live game, then puts the board on the projector.",
  "Players open the link or scan the QR code, then enter the six-character code and a nickname. There is no sign-in and no email.",
  "In the lobby, pick a court, or let the TA balance the teams. Courts left empty are played by AI.",
  "Arriving late? You are placed on the human-played court with the fewest players (a tie is settled at random), never on an AI court, and a catch-up screen shows what you missed.",
  "On your court's turn, vote with your reason and its source. Watch the board for each result and both courts' readings.",
  "Talk it through at each pause. At the end, the debrief shows the result and lets the TA review any round.",
];
export const PLAY_SHOTS: { src: string; alt: string }[] = [
  { src: "/manual/play-1.jpg", alt: "The Play page: pick a world and press Host live game or Pass and play." },
  { src: "/manual/play-2.jpg", alt: "The host screen with the QR code and the six-character game code." },
  { src: "/manual/play-3.jpg", alt: "The lobby: courts and teams, with empty courts played by AI." },
  { src: "/manual/play-4.jpg", alt: "The join screen: enter the game code and a nickname." },
  { src: "/manual/play-5.jpg", alt: "A court's turn: the board, the map and the actions to vote on." },
  { src: "/manual/play-6.jpg", alt: "The debrief: final standings, anachronism traps and the TA record." },
];
export const PLAY_NOTES: string[] = [
  "No projector or phones? Pass and play runs the whole game on one device passed around the table.",
  "If the host tab closes, reopen the game from Play with its code and the host recovery key shown in the lobby.",
];

export const DESIGN_STEPS: string[] = [
  "Press New world, or open the sample to see a finished one. Drafts are kept in this browser.",
  "Work through the design wizard: world and era, map, courts, resources and victory, sources, diplomatic actions, historical events and anachronism traps.",
  "Tie each action to your sources, and write a reading of each action for every court: what the move meant to them.",
  "Pass the automatic source checks. They look for completeness, not accuracy: at least two primary sources (documents from the time, contemporary reporting, or edited collections of them) and one later reading such as a modern study or memoir, every action and event linked to a source, a reading of every action for every court, and a reason for any source from outside your era. Your instructor also sees flags for dates and modern terms.",
  "Try it out with Pass and play or a live test game.",
  "Submit under your nickname. Your instructor reviews it, and approved games join the Class library.",
];

export interface Why { title: string; text: string }
export const WHYS: Why[] = [
  { title: "Every vote needs evidence", text: "You can't send a vote without a reason, a reading and a place in that reading. The game is built to send you back to the sources, and your TA checks them in the debrief." },
  { title: "Each court has its own reading", text: "Diplomacy in this era wasn't one shared language. Seeing the target's reading next to the actor's shows that the same mission could be tribute to one court and recognition to another." },
  { title: "The game pauses to talk", text: "The point is the reasoning, not the score, so the game stops for discussion each round. There is no ranking until the game is over." },
  { title: "Nicknames, no accounts", text: "No one signs in and nothing asks for an email or student ID. Your TA sees nicknames only." },
];

export const NPC_NOTE = "Moves made by AI courts are AI-generated game content. They are always labeled as AI, on the board, on phones and in the record. They are not student work, and the course policy above still applies to everything you write: your reasons must be your own.";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/* The manual. The two paths stay visible; the reference sections fold away so the library stays near the top. */
export function manualHtml(open: string[] = []): string {
  const sec = (id: string, title: string, body: string) =>
    `<details class="msec" data-sec="${id}" ${open.includes(id) ? "open" : ""}><summary><h3>${esc(title)}</h3></summary><div class="mbody">${body}</div></details>`;
  const ol = (xs: string[]) => `<ol class="msteps">${xs.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
  const carousel = (xs: string[]) => `<div class="mcar" data-i="0" aria-roledescription="carousel" aria-label="How to play, step by step">
      <div class="mview"><div class="mtrack">${xs.map((x, i) => `<figure class="mslide" aria-label="Step ${i + 1} of ${xs.length}">${PLAY_SHOTS[i] ? `<img src="${PLAY_SHOTS[i].src}" alt="${esc(PLAY_SHOTS[i].alt)}" loading="lazy">` : ""}<figcaption><b>${i + 1}.</b> ${esc(x)}</figcaption></figure>`).join("")}</div></div>
      <div class="mnav"><button class="ghost" data-act="mcar" data-d="-1" aria-label="Previous step">‹</button>${xs.map((_, i) => `<button class="mdot" data-act="mcar" data-i="${i}" aria-label="Step ${i + 1}" aria-current="${i === 0}">${i + 1}</button>`).join("")}<button class="ghost" data-act="mcar" data-d="1" aria-label="Next step">›</button></div>
    </div>`;
  return `<section class="manual" id="manual" aria-labelledby="manual-h">
    <div class="secthead"><h2 id="manual-h">Instruction manual</h2><span class="small muted">How to play, how to build a game, and why it works this way</span></div>
    <div class="paths">
      <article class="frame stack path"><div class="eyebrow">Path 1</div><h3>Play a game from the library</h3><p class="small muted">The TA hosts; everyone else joins from a phone.</p>${carousel(PLAY_STEPS)}
        <ul class="small muted mnotes">${PLAY_NOTES.map(n => `<li>${esc(n)}</li>`).join("")}</ul></article>
      <article class="frame stack path"><div class="eyebrow">Path 2</div><h3>Generate your own game</h3><p class="small muted">Build the diplomatic world of an era from the readings.</p>${ol(DESIGN_STEPS)}
        <div class="row"><button class="primary" data-act="new-draft">New world</button><button data-act="open-sample">Open the sample</button></div></article>
    </div>
    ${sec("goals", "What the game is for", `<ol class="goals">${GOALS.map(g => `<li><b>${esc(g.title)}.</b> ${esc(g.does)} <span class="aim">Course aim: <b>${esc(g.aim)}</b>, ${esc(g.aimText)}.</span></li>`).join("")}</ol>`)}
    ${sec("rules", "The rules", `<dl class="rules">${RULES.map(r => `<div><dt>${esc(r.term)}</dt><dd>${esc(r.text)}</dd></div>`).join("")}</dl>`)}
    ${sec("why", "Why the screens work this way", `<dl class="rules">${WHYS.map(w => `<div><dt>${esc(w.title)}</dt><dd>${esc(w.text)}</dd></div>`).join("")}</dl>`)}
    ${sec("ai", "AI in this game", `<div class="eyebrow">Course AI policy</div><blockquote class="policy">${esc(POLICY)}</blockquote><p>${esc(NPC_NOTE)}</p>`)}
  </section>`;
}
