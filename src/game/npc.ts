/* AI-played courts (Phase 1.5) and team assignment. Pure functions: no browser or server dependencies,
   so the live game, pass-and-play and the tests all use the same rules. */
import { canTake, num, openingOf, readingOf, yearFor } from "./logic";
import { citableSources, personaForPrompt } from "./rounds";
import type { Action, Ballot, Design, GameState, HistoryRow, Move, NpcMode } from "./types";

/* AI courts cite a source id only. They never give a page, chapter or quote. */
export const AI_NO_LOC = "AI court: no location given";
export const AI_NAME = "AI court";

/* Actions this court may take right now (allowed, and not blocked by lack of resources). */
export function legalActions(d: Design, st: GameState, who: string): Action[] {
  return d.actions.filter(a => { const c = canTake(d, st, a, who); return c.ok && !c.blocked; });
}
const nameOf = (d: Design, id: string): string => (d.actors.find(a => a.id === id) || { name: id }).name;
const otherActors = (d: Design, who: string): string[] => d.actors.filter(a => a.id !== who).map(a => a.id);

/* ---------- rule-based fallback (pass-and-play, and whenever the AI is unavailable) ---------- */
/* Answers whoever last acted toward this court if it can; otherwise picks the move that best serves its
   victory resource, avoiding repeating its own last move. Deterministic, so a replay gives the same game. */
/* How a rule-based court weighs its moves, so players can watch it decide. Every legal move gets a score and the
   plain reasons behind it; the highest score wins (ties go to the earlier card). ruleMove plays exactly this choice. */
export interface Considered { id: string; name: string; score: number; reasons: string[] }
export interface Thinking { who: string; considered: Considered[]; choice: string; target: string; targetWhy: string; why: string; src: string }
export function ruleThinking(d: Design, st: GameState, who: string, rows: HistoryRow[] = []): Thinking {
  const A = d.actors.find(a => a.id === who);
  const legal = legalActions(d, st, who);
  if (!A || !legal.length) return { who, considered: [], choice: "", target: "", targetWhy: "", src: "",
    why: `Simplified move: ${A ? A.name : "This court"} has no move it can afford, so it waits.` };
  const acted = rows.filter(r => r.kind === "action");
  const lastAgainst = [...acted].reverse().find(r => r.target === who && r.actor !== who);
  const lastOwn = [...acted].reverse().find(r => r.actor === who);
  const vic = d.victory.res;
  const resName = (k: string) => (d.resources.find(r => r.key === k) || { name: k }).name;
  const weigh = (a: Action): Considered => {
    let s = 0; const reasons: string[] = [];
    for (const e of a.effects) if (e.to === "self") {
      const n = Number(e.d || 0), w = e.res === vic ? 2 : 1; s += w * n;
      if (n) reasons.push(`${n > 0 ? "+" : ""}${n} ${resName(e.res)} for itself${e.res === vic && n > 0 ? " (what it is scored on)" : ""}`);
    }
    if (Number(a.risk?.chance) > 0) { s -= Number(a.risk.chance) / 50; reasons.push(`${a.risk.chance}% chance it backfires`); }
    if (lastAgainst && (a.target === "choose" || a.target === lastAgainst.actor)) { s += 1.5; reasons.push(`lets it answer ${nameOf(d, lastAgainst.actor)}'s last move toward it`); }
    if (lastOwn && lastOwn.action === a.id) { s -= 1; reasons.push("it made this move last time"); }
    if (!reasons.length) reasons.push("no direct gain for itself");
    return { id: a.id, name: a.name, score: Math.round(s * 100) / 100, reasons };
  };
  const considered = legal.map((a, i) => ({ c: weigh(a), i })).sort((x, y) => y.c.score - x.c.score || x.i - y.i).map(x => x.c);
  const best = d.actions.find(a => a.id === considered[0]!.id)!;
  let target = "", targetWhy = "";
  if (best.target === "choose") {
    const others = otherActors(d, who);
    const leader = others.slice().sort((x, y) => (st.res[y]?.[vic] || 0) - (st.res[x]?.[vic] || 0))[0] || "";
    if (lastAgainst && others.includes(lastAgainst.actor)) { target = lastAgainst.actor; targetWhy = `${nameOf(d, target)} made the last move toward it`; }
    else { target = leader; targetWhy = `${nameOf(d, target)} leads in ${resName(vic)}`; }
  }
  const answer = lastAgainst ? `answers ${nameOf(d, lastAgainst.actor)}'s last move toward it` : "acts";
  const aim = (A.goal || "").trim().replace(/\.$/, "");
  const why = `Simplified move: ${A.name} ${answer} with "${best.name}"${target ? ` toward ${nameOf(d, target)}` : ""}${aim ? `, in line with its aim: ${aim}` : ""}.`;
  return { who, considered, choice: best.id, target, targetWhy, why, src: best.source || "" };
}
export function moveFromThinking(t: Thinking): Move {
  const why = [{ name: AI_NAME, text: t.why, src: t.src, loc: AI_NO_LOC, quote: "" }];
  return t.choice ? { action: t.choice, target: t.target, why, npc: "rule" } : { pass: true, npc: "rule", why: why.map(w => ({ ...w, src: "" })) };
}
export function ruleMove(d: Design, st: GameState, who: string, rows: HistoryRow[] = []): Move {
  return moveFromThinking(ruleThinking(d, st, who, rows));
}

/* ---------- AI prompt and strict validation ---------- */
const fx = (d: Design, a: Action) => a.effects.map(e => `${e.to === "self" ? "self" : e.to === "target" ? "target" : e.to === "all" ? "everyone" : nameOf(d, e.to)} ${e.d > 0 ? "+" : ""}${e.d} ${(d.resources.find(r => r.key === e.res) || { name: e.res }).name}`).join(", ");
/* Recent play this court should respond to: every move that involved it, plus the latest moves overall. */
export function npcContext(rows: HistoryRow[], who: string, max = 14): HistoryRow[] {
  const involved = rows.filter(r => r.kind !== "event" && (r.actor === who || r.target === who));
  const recent = rows.slice(-8);
  const keep = new Set([...involved.slice(-10), ...recent]);
  return rows.filter(r => keep.has(r)).slice(-max);
}
export function npcPrompt(d: Design, st: GameState, who: string, rows: HistoryRow[]): string {
  const A = d.actors.find(a => a.id === who)!;
  const year = yearFor(d, st.round);
  const legal = legalActions(d, st, who);
  const res = d.resources.map(r => `${r.name} (${r.meaning})`).join("; ");
  const standings = d.actors.map(a => `${a.name}: ` + d.resources.map(r => `${r.name} ${st.res[a.id]?.[r.key] ?? 0}`).join(", ")).join("\n");
  const actions = legal.map(a => `- id "${a.id}": ${a.name}. Target: ${a.target === "choose" ? "you choose another court" : a.target === "none" ? "none" : nameOf(d, a.target)}. Effects: ${fx(d, a)}.${Number(a.risk?.chance) > 0 ? ` Risk: ${a.risk.chance}% chance it backfires (${a.risk.text}).` : ""} How ${A.name} reads this move: ${readingOf(a, who, who) || "(not written)"} Source id: ${a.source || "none"}.`).join("\n");
  const sources = citableSources(d, st.round).map(s => `- id "${s.id}": ${s.citation}`).join("\n");
  const history = npcContext(rows, who).map(r => {
    if (r.kind === "event") return `Round ${r.round}: event (${r.year}) — ${r.event?.title || ""}.`;
    const who2 = nameOf(d, r.actor), by = r.npc ? "an AI court" : "students";
    if (r.kind === "pass") return `Round ${r.round}: ${who2} passed.`;
    const act = d.actions.find(a => a.id === r.action);
    const reasons = r.ballots.filter(b => !b.pass && b.action === r.action && b.why).slice(0, 2).map(b => `"${b.why.slice(0, 220)}"`).join(" ");
    const mine = r.target === who || r.actor === who ? ` As ${A.name} read it: ${(r.readings[who] || "").slice(0, 220)}` : "";
    return `Round ${r.round}${r.year !== "" ? ` (c. ${r.year})` : ""}: ${who2} → ${r.target ? nameOf(d, r.target) : "no target"}: ${act ? act.name : r.action}${r.failed ? " (it backfired)" : ""}. Reasoning given by ${by}: ${reasons || "none"}.${mine}`;
  }).join("\n") || "No moves yet.";
  const persona = personaForPrompt(d, st.round, who);
  if (persona) return modernPrompt(d, st, who, persona, res, standings, history, actions, sources);
  return `You are playing one court in a classroom strategy game about East Asian diplomacy. Students play the other courts and will test your reasoning against the course readings, so reason as this court plausibly would have, in its own categories (ritual rank, legitimacy, investiture, trade licenses, face, the court's own claims), not in modern diplomatic language such as sovereignty, national interest, international law or balance of power unless this era used such ideas.

World: ${d.title}. Era: ${d.era.label} (${d.era.start}–${d.era.end}). It is round ${st.round}${year !== "" ? `, around ${year}` : ""}.
Premise: ${d.premise}${(() => { const o = openingOf(d); return o ? `
How the game opened${o.year !== "" ? ` (${o.year})` : ""}: ${o.title}. ${o.text}` : ""; })()}

You are: ${A.name} (${A.kind}).
How this court sees the world: ${A.worldview}
What counts as success for it: ${A.goal}

Resources: ${res}
Current standing:
${standings}

Recent moves, especially those involving ${A.name}:
${history}

Moves you may make now:
${actions}

Sources in this world (cite by id only):
${sources || "(none)"}

Choose exactly one move. Respond to how others have just treated ${A.name} if that matters to it. In "why", write one to three sentences (at most 70 words) giving this court's reasoning in its own terms. Do not quote any document, invent quotations, or give page numbers. Set "src" to the id of the source that best supports the move, from the list above. Set "target" to a court id only if the move lets you choose a target; otherwise "".
Court ids: ${d.actors.filter(a => a.id !== who).map(a => `"${a.id}" (${a.name})`).join(", ")}

Reply with JSON only, no other text: {"action": "<move id>", "target": "<court id or empty>", "why": "<reasoning>", "src": "<source id>"}`;
}
/* The contemporary demo: a seat held by a real, mostly living person. Public conduct only, built from reporting. */
function modernPrompt(d: Design, st: GameState, who: string, persona: string, res: string, standings: string, history: string, actions: string, sources: string): string {
  const A = d.actors.find(a => a.id === who)!;
  return `You are playing one seat in a demonstration strategy game about East Asian diplomacy, built from news reporting. Players will test your reasoning against the reporting, so reason as this leader plausibly would from their reported public positions, and nothing more.

Rules for playing a real person: stay with their public diplomatic conduct as reported. No private life, no caricature, no speculation about motives beyond what the reporting supports. Never invent a quotation or put words in their mouth; paraphrase. Your move is clearly labeled as AI-generated game content.

World: ${d.title}. It is round ${st.round} of ${num(d.victory.rounds) || ""}, in ${yearFor(d, st.round)}.
Premise: ${d.premise}

Your seat: ${A.name}. ${A.worldview}
${persona}

Resources: ${res}
Current standing:
${standings}

Recent moves, especially those involving your seat:
${history}

Moves you may make now:
${actions}

Sources in this world (cite by id only, and only ones published by ${yearFor(d, st.round)}):
${sources || "(none)"}

Choose exactly one move. In "why", write one to three sentences (at most 70 words) giving this leader's reasoning as the reporting supports it. Do not quote any article or give paragraph numbers. Set "src" to the id of the source that best supports the move. Set "target" to a seat id only if the move lets you choose a target; otherwise "".
Seat ids: ${d.actors.filter(a => a.id !== who).map(a => `"${a.id}" (${a.name})`).join(", ")}

Reply with JSON only, no other text: {"action": "<move id>", "target": "<seat id or empty>", "why": "<reasoning>", "src": "<source id>"}`;
}
/* Strict check of the model's reply. Returns null if anything is off, so the caller retries or falls back. */
export function parseNpcReply(d: Design, st: GameState, who: string, text: string): Move | null {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
  const a = legalActions(d, st, who).find(x => x.id === o["action"]);
  if (!a) return null;
  const why = String(o["why"] ?? "").replace(/\s+/g, " ").trim();
  if (why.length < 15 || why.length > 600) return null;
  let target = "";
  if (a.target === "choose") {
    target = String(o["target"] ?? "");
    if (!d.actors.some(x => x.id === target && x.id !== who)) return null;
  }
  const src = String(o["src"] ?? "");
  if (d.sources.length && !d.sources.some(s => s.id === src)) return null;
  return { action: a.id, target, why: [{ name: AI_NAME, text: why.slice(0, 400), src, loc: AI_NO_LOC, quote: "" }], npc: "ai" };
}
/* The single ballot stored in history for an AI-court move. */
export function npcBallot(move: Move): Ballot {
  const w = (move.why || [])[0];
  return { name: AI_NAME, pass: !!move.pass, action: move.pass ? "" : move.action, target: move.pass ? "" : move.target, why: w ? w.text : "", src: w ? w.src : "", loc: AI_NO_LOC, quote: "", npc: move.npc || "rule" };
}

/* ---------- team assignment ---------- */
/* Late joiner (game already started): the court with at least one human and the fewest humans; ties
   broken randomly. AI-only courts are never candidates. null = nobody is playing, so the joiner picks. */
export function lateJoinCourt(order: string[], humans: Record<string, number>, rnd: () => number = Math.random): string | null {
  const live = order.filter(id => (humans[id] || 0) > 0);
  if (!live.length) return null;
  const min = Math.min(...live.map(id => humans[id] || 0));
  const tied = live.filter(id => (humans[id] || 0) === min);
  return tied[Math.min(tied.length - 1, Math.floor(rnd() * tied.length))]!;
}
/* Lobby auto-balance: every seat gets a court and team sizes differ by at most one. With fewer players
   than courts, each player gets a court of their own. Players stay where they are whenever possible. */
export function balanceTeams(courts: string[], seats: { id: string; actor: string | null }[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!courts.length) return out;
  const n = seats.length, cap = Math.ceil(n / courts.length), floor = Math.floor(n / courts.length);
  const teams: Record<string, string[]> = Object.fromEntries(courts.map(c => [c, [] as string[]]));
  const loose: string[] = [];
  for (const s of seats) {
    const t = s.actor ? teams[s.actor] : undefined;
    if (t && t.length < cap) t.push(s.id); else loose.push(s.id);
  }
  // Courts already at the cap keep only as many as needed so the smaller ones can reach `floor`.
  const fill = (limit: number) => { for (const c of courts) while (teams[c]!.length < limit && loose.length) teams[c]!.push(loose.shift()!); };
  const need = courts.reduce((k, c) => k + Math.max(0, floor - teams[c]!.length), 0);
  if (need > loose.length) {
    const over = courts.filter(c => teams[c]!.length > floor).sort((x, y) => teams[y]!.length - teams[x]!.length);
    let short = need - loose.length;
    for (const c of over) while (short > 0 && teams[c]!.length > floor) { loose.push(teams[c]!.pop()!); short--; }
  }
  fill(floor); fill(cap);
  for (const [c, ids] of Object.entries(teams)) for (const id of ids) out[id] = c;
  return out;
}
export type { NpcMode };
