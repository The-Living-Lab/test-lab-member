/* Per-round seats for the contemporary demo (pure functions, shared by the browser, the server and tests).
   A design without `rounds` (every historical game) gets nulls and empty lists everywhere, so nothing changes. */
import type { Design, Gloss, HistoryRow, RoundInfo, SeatHolder, Source } from "./types";

export function roundInfo(d: Design, round: number): RoundInfo | null {
  return (Array.isArray(d.rounds) && d.rounds[round - 1]) || null;
}
export function holderOf(d: Design, round: number, actor: string): SeatHolder | null {
  const r = roundInfo(d, round);
  return (r && r.holders && r.holders[actor]) || null;
}
/* "China's leader · Jiang Zemin" when the seat has a holder this round, else the actor's own name. */
export function seatLabel(d: Design, round: number, actor: string): string {
  const a = d.actors.find(x => x.id === actor), h = holderOf(d, round, actor);
  return a ? (h ? `${a.name} · ${h.name}` : a.name) : actor;
}
/* Seats that changed hands going into this round (round 1: anyone new that year), each with why it matters. */
export function seatChanges(d: Design, round: number): { actor: string; holder: SeatHolder }[] {
  const r = roundInfo(d, round);
  if (!r) return [];
  return d.actors.filter(a => r.holders[a.id] && (r.holders[a.id]!.changed || "").trim()).map(a => ({ actor: a.id, holder: r.holders[a.id]! }));
}
/* Terms explained the first time they appear: those this round introduces. */
export function glossaryFor(d: Design, round: number): Gloss[] {
  return (roundInfo(d, round)?.glossary || []).filter(g => g.term && g.text);
}
/* Sources a player may cite in this round: nothing published after the round's year (no hindsight). */
export function citableSources(d: Design, round: number): Source[] {
  const r = roundInfo(d, round);
  if (!r) return d.sources;
  return d.sources.filter(s => s.year === "" || Number(s.year) <= r.year);
}
/* Everything the Sources panel lists for a round: the scene, each seat's persona, and the closing event. */
export function roundSourceIds(d: Design, round: number, eventSources: string[] = []): { scene: string[]; seats: Record<string, string[]>; event: string[] } {
  const r = roundInfo(d, round);
  const seats: Record<string, string[]> = {};
  if (r) for (const a of d.actors) if (r.holders[a.id]) seats[a.id] = r.holders[a.id]!.sources.slice();
  return { scene: r ? r.sceneSources.slice() : [], seats, event: eventSources.slice() };
}
/* The comparison after a round: what each seat chose in the game, beside what the real holder did. */
export function realVsChosen(d: Design, round: number, rows: HistoryRow[]): { actor: string; chose: string; npc: boolean; did: string }[] {
  const r = roundInfo(d, round);
  if (!r) return [];
  return d.actors.filter(a => r.holders[a.id]).map(a => {
    const mine = rows.filter(x => x.round === round && x.actor === a.id && (x.kind === "action" || x.kind === "pass")).pop();
    let chose = "";
    if (mine) {
      if (mine.kind === "pass") chose = "passed";
      else {
        const act = d.actions.find(x => x.id === mine.action), t = mine.target ? d.actors.find(x => x.id === mine.target) : null;
        chose = (act ? act.name : mine.action) + (t ? ` → ${t.name}` : "") + (mine.failed ? " (it backfired)" : "");
      }
    }
    return { actor: a.id, chose, npc: !!(mine && mine.npc), did: r.holders[a.id]!.did };
  });
}
/* What the AI is told about the person in the seat. Paraphrased positions only, and no knowledge past the year. */
export function personaForPrompt(d: Design, round: number, actor: string): string {
  const r = roundInfo(d, round), h = holderOf(d, round, actor);
  if (!r || !h) return "";
  const cites = h.sources.map(id => d.sources.find(s => s.id === id)).filter(Boolean).map(s => `"${s!.id}" (${s!.citation})`).join("; ");
  return `In this round (${r.year}) the seat is held by ${h.name}, ${h.title}.
What the reporting shows about ${h.name}'s positions at this time: ${h.persona}
Reporting this is built from: ${cites || "none"}.
You know only what ${h.name} could have known by ${r.year}. Do not mention or rely on anything that happened later.`;
}
