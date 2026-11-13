/* Pause and debrief (Phase 4). Pure functions shared by the live game, pass-and-play and the tests. */
import { courseOf } from "./data";
import { readingOf } from "./logic";
import type { Design, GameState, HistoryRow, LogEntry, PauseMode } from "./types";

/* After a turn resolves: pause at the end of every round (default), or after every move if the TA chose that.
   The last round never pauses: the game goes straight to the final debrief. */
export function pauseAfter(st: GameState, made: LogEntry[], mode: PauseMode): boolean {
  if (st.over || !made.length) return false;
  const r = made[0]!.round, roundEnded = st.round !== r;
  if (mode !== "move" && !roundEnded) return false;
  st.pause = { round: r, kind: roundEnded ? "round" : "move", seq: st.seq, share: false };
  return true;
}

/* Discussion questions for a pause. No winner or ranking until the game is over. */
export function talkItThrough(round: number): string[] {
  return [
    `Which move in round ${round} did you first read in modern terms? What changed when you saw the other court's reading?`,
    "Pick one reason given this round. Go to its cited passage: does it support the reason?",
    "Which court's reading of a move here would you challenge, and with which source?",
  ];
}

export interface Prompt { kind: "evidence" | "quote" | "source" | "trap" | "narrative" | "ai"; text: string; ballot?: number }
/* Facilitator prompts for one recorded move, built only from the design and the record (no course text). */
export function facilitatorPrompts(d: Design, r: HistoryRow): Prompt[] {
  if (r.kind !== "action") return [];
  const out: Prompt[] = [];
  const a = d.actions.find(x => x.id === r.action);
  const A = d.actors.find(x => x.id === r.actor), T = r.target ? d.actors.find(x => x.id === r.target) : null;
  const cite = (id: string) => { const s = d.sources.find(x => x.id === id); return s ? (courseOf(s.key || "")?.starred ? "*" : "") + (s.citation.length > 80 ? s.citation.slice(0, 78) + "…" : s.citation) : ""; };
  r.ballots.forEach((b, i) => {
    if (b.pass || !b.why) return;
    if (b.npc) { out.push({ kind: "ai", ballot: i, text: `This was an AI court's reasoning${b.src ? ` (citing ${cite(b.src)})` : ""}. Does it hold up against the readings?` }); return; }
    if (b.src) {
      const where = b.loc ? `${cite(b.src)}, ${b.loc}` : cite(b.src);
      out.push({ kind: "evidence", ballot: i, text: `Go to ${where}. Find the passage. Does it support the reason given (“${b.why}”)? What does it say just before and after?` });
      if (b.quote) out.push({ kind: "quote", ballot: i, text: `Read the quote aloud: “${b.quote}”. Does it support the reason?` });
    }
  });
  const used = new Set(r.ballots.map(b => b.src).filter(Boolean));
  for (const id of used) {
    const s = d.sources.find(x => x.id === id); if (!s) continue;
    const star = courseOf(s.key || "")?.starred ? " The syllabus marks it with an asterisk; does that label fit this text?" : "";
    out.push({ kind: "source", text: `Is ${cite(id)} a primary or a secondary source?${star} Whose voice is it, and when was it written?` });
  }
  if (a && a.trap) {
    const match = d.traps.find(t => t.modern && (t.modern.toLowerCase().includes(a.trap.toLowerCase().slice(0, 20)) || a.trap.toLowerCase().includes(t.modern.toLowerCase().slice(0, 20))));
    out.push({ kind: "trap", text: `Modern assumption to set aside: ${a.trap}${match && match.historical ? ` What the era shows instead: ${match.historical}` : " What does the era show instead?"}` });
  }
  if (A && T && a) {
    const ra = r.readings[A.id] || readingOf(a, A.id, A.id), rt = r.readings[T.id] || readingOf(a, T.id, A.id);
    out.push({ kind: "narrative", text: `Same event, different narrative: ${A.name} read it as “${ra}” ${T.name} read it as “${rt}” Where do the readings disagree, and which source would settle it?` });
  }
  return out;
}
export const TA_TAGS: { key: "strong" | "check" | "anachronism"; label: string }[] = [
  { key: "strong", label: "Strong evidence" }, { key: "check", label: "Needs source check" }, { key: "anachronism", label: "Anachronism spotted" },
];
