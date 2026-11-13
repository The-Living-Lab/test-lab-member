/* Pure game logic: era fit, design checks, chronology flags, the turn engine and vote tallying.
   No browser or server dependencies, so it runs in both places and can be unit-tested. */
import { ANCHORS, COURSE_SOURCES, COURSE_SPAN, MODERN_TERMS, courseOf, uid } from "./data";
import type { Action, Ballot, CheckItem, ChronoFlag, ClaimKind, CourseSource, Design, Genre, Effect, GameEvent, GameState, HistoryQuery, HistoryRow, LogEntry, Move, Num, Opening, ResolvedBy, RoundSummary, Source, Vote, VoteCount } from "./types";

export const num = (v: unknown): number | null => (v === "" || v == null || isNaN(Number(v))) ? null : Number(v);
export function eraRange(d: Design): [number, number] | null {
  const s = num(d.era.start), e = num(d.era.end);
  if (s == null || e == null || s > e) return null;
  return [s, e];
}
export const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 <= b1 && b0 <= a1;
export const ERA_MARGIN = 25;
export const isCourse = (s: Source): boolean => !!(s.key && courseOf(s.key));
/* Kinds of evidence (redesign Phase 0). The syllabus asterisk is a separate label and never decides the kind. */
export const GENRE_LABEL: Record<Genre, string> = {
  document: "Document from the time", reporting: "Contemporary reporting", collection: "Edited collection of documents",
  memoir: "Memoir or oral history, recorded later", scholarship: "Modern scholarship",
};
export const GENRES = Object.keys(GENRE_LABEL) as Genre[];
export function genreOf(s: Source): Genre | "" {
  const c = courseOf(s.key);
  if (c) return c.genre;
  return s.genre && GENRE_LABEL[s.genre] ? s.genre : "";
}
/* Counts toward "primary sources": a document from the time, contemporary reporting, or an edited collection of
   such documents. A source whose kind is unknown never counts. */
export function countsAsPrimary(s: Source): boolean {
  const g = genreOf(s);
  return g === "document" || g === "reporting" || g === "collection";
}
/* Redesign Phase 1: kinds of claim a card rests on. */
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  documented: "Documented claim", inference: "Historical inference", assumption: "Design assumption",
};
export const CLAIMS = Object.keys(CLAIM_LABEL) as ClaimKind[];
export const claimLabel = (k: unknown): string => (typeof k === "string" && Object.prototype.hasOwnProperty.call(CLAIM_LABEL, k) && (CLAIM_LABEL as Record<string, string>)[k]) || "";
/* Where a reason stands. A completed form is not checked evidence: until the TA looks, a student reason is "not checked".
   Derived from the TA's tags, so nothing new is stored. ("Revised" arrives with the Phase 2 feedback loop.) */
export type EvidenceStatus = "ai" | "unchecked" | "asked" | "checked";
export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  ai: "AI reasoning, not evidence", unchecked: "Not checked", asked: "TA asked for a check", checked: "Checked by the TA",
};
export function evidenceStatus(r: { ballots: Ballot[]; tags?: Record<string, string> }, i: number): EvidenceStatus {
  const b = r.ballots[i]; if (!b || b.npc) return "ai";
  const t = (r.tags || {})["b" + i];
  return t === "check" ? "asked" : t ? "checked" : "unchecked";
}
/* Student reasons still open across a record: not checked, or a check the TA asked for. Only reasons on played
   moves count, since those are the ones the TA can tag. */
export interface OpenReason { seq: number; round: number; ballot: number; name: string; why: string; status: "unchecked" | "asked" }
export function openReasonList(rows: HistoryRow[]): OpenReason[] {
  const out: OpenReason[] = [];
  for (const r of rows) if (r.kind === "action") r.ballots.forEach((b, i) => {
    if (b.npc || (b.pass && !b.why)) return;
    const s = evidenceStatus(r, i);
    if (s === "unchecked" || s === "asked") out.push({ seq: r.seq, round: r.round, ballot: i, name: b.name || "A student", why: b.why || "", status: s });
  });
  return out;
}
export function openReasons(rows: HistoryRow[]): { unchecked: number; asked: number } {
  const l = openReasonList(rows);
  return { unchecked: l.filter(x => x.status === "unchecked").length, asked: l.filter(x => x.status === "asked").length };
}
export const AUDIT_MIN = 20;
export const cleanAudit = (t: unknown): string => String(t || "").replace(/\s+/g, " ").trim().slice(0, 600);
export const auditOk = (t: unknown): boolean => cleanAudit(t).length >= AUDIT_MIN;
export const starredOnSyllabus = (s: Source): boolean => !!courseOf(s.key)?.starred;
function sourcePeriod(s: Source): [number, number] | null {
  const c = courseOf(s.key);
  if (c) return c.any ? null : [c.from, c.to];
  if (!countsAsPrimary(s)) return null; // a later or secondary work may be about any period
  const y = num(s.year); return y == null ? null : [y, y];
}
export function sourceOutOfEra(d: Design, s: Source): boolean {
  const r = eraRange(d), p = sourcePeriod(s);
  if (!r || !p) return false;
  return !overlaps(p[0], p[1], r[0] - ERA_MARGIN, r[1] + ERA_MARGIN);
}
export const customComplete = (s: Source): boolean =>
  (s.citation || "").trim().length >= 20 && num(s.year) != null && (s.where || "").trim().length >= 3;
export function allowedReadings(d: Design): CourseSource[] {
  const r = eraRange(d);
  const attached = new Set(d.sources.filter(s => s.key && (s.fit || "").trim().length >= 30).map(s => s.key));
  return COURSE_SOURCES.filter(c => c.any || !r || overlaps(c.from, c.to, r[0] - ERA_MARGIN, r[1] + ERA_MARGIN) || attached.has(c.key));
}
export function chronology(d: Design): ChronoFlag[] {
  const r = eraRange(d); if (!r) return [];
  const fields: [string, string][] = [];
  const add = (where: string, text: unknown) => { if (text && String(text).trim()) fields.push([where, String(text)]); };
  add("Title", d.title); add("Era", d.era.label); add("Setting", d.setting); add("Premise", d.premise);
  d.actors.forEach(a => add("Actor: " + (a.name || "unnamed"), [a.name, a.worldview, a.goal].join(" ")));
  d.actions.forEach(a => add("Action: " + (a.name || "unnamed"), [a.name, a.readingSelf, a.readingOther, a.rationale, ...Object.values(a.readings || {})].join(" ")));
  d.events.forEach(e => add("Event: " + (e.title || "untitled"), e.title + " " + e.text));
  const out: ChronoFlag[] = [], seen = new Set<string>();
  const flag = (where: string, text: string) => { const k = where + "|" + text; if (!seen.has(k)) { seen.add(k); out.push({kind:"date", where, text}); } };
  /* What players hold from round 1: actors, setting and premise can't rely on events after the game opens. */
  const opening: [string, string][] = [["Setting", d.setting || ""], ["Premise", d.premise || ""], ["Opening scene", d.opening ? [d.opening.title, d.opening.text, d.opening.ask].join(" ") : ""], ...d.actors.map(a => ["Actor: " + (a.name || "unnamed"), [a.name, a.worldview, a.goal].join(" ")] as [string, string])];
  for (const [where, text] of opening) {
    for (const m of text.matchAll(/\b(?:after|since|following|from)\s+(?:the\s+[^.,;]{0,40}?\s+(?:of|in)\s+)?(\d{3,4})\b/gi)) {
      const y = Number(m[1]); if (y > r[0]) flag(where, `Refers to ${y}, but your game opens in ${r[0]}: players in round 1 could not know it.`);
    }
  }
  { const o = d.opening, y = o ? num(o.year) : null;
    if (o && String(o.text || "").trim() && y != null && y > r[0]) flag("Opening scene", `Dated ${y}, after your game opens in ${r[0]}. The opening shows the world as round 1 begins, so date it ${r[0]} or earlier.`); }
  const atBeijing = (d.map?.places || []).some(p => /beijing/i.test(p.name)) || /beijing/i.test(d.setting || "");
  if (r[0] < 1644 && atBeijing && d.actors.some(a => /\bQing\b/i.test(a.name))) flag("Actor: " + d.actors.find(a => /\bQing\b/i.test(a.name))!.name, `The Qing took Beijing in 1644, after your game opens in ${r[0]}. Start later, or seat the Ming in Beijing and the Qing (Later Jin) at Mukden.`);
  for (const [where, text] of fields) {
    if (/(Meiji|Japanese)\s+(government|court|state|emperor)[^.]{0,120}Kapsin|Kapsin[^.]{0,120}(Meiji|Japanese)\s+(government|court|state|emperor)/i.test(text))
      flag(where, "The Kapsin reform edict (1884) came from Kim Okkyun and other Korean reformers, not from the Meiji government.");
    if (r[0] >= 1944 && /treaty[- ]ports?/i.test(text))
      flag(where, `Mentions treaty ports, but the treaty-port system ended in 1943 in China (and by 1899 in Japan), before your era (${r[0]}–${r[1]}).`);
  }
  for (const [where, text] of fields) {
    for (const [pat, from, to, label] of ANCHORS) {
      if (overlaps(from, to, r[0] - 10, r[1] + 10) || !new RegExp(pat, "i").test(text)) continue;
      const k = where + "|" + label; if (seen.has(k)) continue; seen.add(k);
      out.push({kind:"date", where, text:`Mentions ${label}, outside your era (${r[0]}–${r[1]}).`});
    }
    for (const [pat, from, label] of MODERN_TERMS) {
      if (r[1] >= from || !new RegExp(pat, "i").test(text)) continue;
      const k = where + "|" + label; if (seen.has(k)) continue; seen.add(k);
      out.push({kind:"modern", where, text:`Mentions ${label}. Fine if your text says your era lacked it; otherwise revise.`});
    }
  }
  return out;
}
const sentences = (t: string): number => (String(t || "").match(/[^.!?]+[.!?]/g) || []).filter(x => x.trim().length > 8).length;
/* ---------- per-court readings ---------- */
export const READING_MIN = 20;
/* A vote to pass is a choice too: it needs one short sentence on why the court waits (no source needed). */
export const PASS_WHY_MIN = 15;
export const passWhyOk = (why: unknown): boolean => String(why || "").replace(/\s+/g, " ").trim().length >= PASS_WHY_MIN;
/* The reading `viewer` is shown for a move made by `actor`: its own entry, else the designer's fallback. */
export function readingOf(a: Action, viewer: string, actor: string): string {
  const own = ((a.readings || {})[viewer] || "").trim();
  if (own) return own;
  return ((viewer === actor ? a.readingSelf : a.readingOther) || "").trim();
}
export function readingsFor(d: Design, a: Action, actor: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const x of d.actors) out[x.id] = readingOf(a, x.id, actor);
  return out;
}
/* Courts with no reading of their own for this action (the fallback text doesn't count). */
export const missingReadings = (d: Design, a: Action): string[] =>
  d.actors.filter(x => ((a.readings || {})[x.id] || "").trim().length < READING_MIN).map(x => x.id);
/* Bring an older saved design up to the current shape without changing what it says. */
export function upgradeDesign<T extends Design>(d: T): T {
  if (!d.opening || typeof d.opening !== "object") d.opening = blankOpening();
  for (const a of d.actions || []) {
    if (a.rationale == null) a.rationale = "";
    if (!a.readings || typeof a.readings !== "object" || Array.isArray(a.readings)) a.readings = {};
  }
  for (const s of d.sources || []) {
    if (s.lookFor == null) s.lookFor = "";
    const c = courseOf(s.key);
    if (c) s.type = c.type; // course readings follow the catalog (Toby is modern scholarship)
    else if (!s.genre && s.type === "secondary") s.genre = "scholarship";
  }
  return d;
}
const twoReadings = (a: Action): boolean => (a.readingSelf || "").trim().length >= 30 && (a.readingOther || "").trim().length >= 30 && a.readingSelf.trim() !== a.readingOther.trim();

/* Blocking checks: every item must pass before a design can be submitted to the class library. */
export function checks(d: Design): CheckItem[] {
  const r = eraRange(d);
  const srcIds = new Set(d.sources.map(s => s.id));
  const usable = (s: Source) => isCourse(s) || customComplete(s);
  const prim = d.sources.filter(s => countsAsPrimary(s) && usable(s)).length;
  const sec = d.sources.filter(s => !countsAsPrimary(s) && usable(s)).length;
  const customs = d.sources.filter(s => !isCourse(s));
  const outEra = d.sources.filter(s => sourceOutOfEra(d, s));
  const fitOk = (s: Source) => (s.fit || "").trim().length >= 30;
  const pl = d.actors.filter(a => a.playable);
  const linked = d.actions.filter(a => a.source && srcIds.has(a.source)).length;
  const readings = d.actions.filter(twoReadings).length;
  const rationales = d.actions.filter(a => (a.rationale || "").trim().length >= 40).length;
  const perCourt = d.actions.filter(a => missingReadings(d, a).length === 0).length;
  const rounds = num(d.victory.rounds);
  const evIn = d.events.filter(e => { const y = num(e.year); return !!r && y != null && y >= r[0] && y <= r[1]; }).length;
  const evSrc = d.events.filter(e => e.source && srcIds.has(e.source)).length;
  return [
    {ok: (d.title || "").trim().length >= 3 && !/^untitled/i.test(d.title.trim()), t:"Game has a title", step:0},
    {ok: !!((d.era.label || "").trim() && r && r[0] >= COURSE_SPAN[0] && r[1] <= COURSE_SPAN[1]), t:"Era named, with start and end years inside the course span", step:0},
    {ok: sentences(d.premise) >= 2 && d.premise.trim().length >= 80, t:"Premise written (two or more sentences)", step:0},
    {ok: pl.length > 0 && pl.every(a => Array.isArray(a.tile)), t:"Playable actors have a seat on the map", step:1},
    {ok: pl.length >= 2, t:"At least two playable actors", step:2},
    {ok: d.actors.length > 0 && d.actors.every(a => a.name.trim() && a.worldview.trim().length >= 40), t:"Every actor has a name and a worldview (40+ characters)", step:2},
    {ok: (d.victory.text || "").trim().length >= 30 && rounds != null && rounds >= 1 && rounds <= 12, t:"Rounds (1–12) and the meaning of victory explained", step:3},
    {ok: prim >= 2, t:`Two or more primary sources: documents from the time, contemporary reporting or edited collections of them (${prim})`, step:4},
    {ok: sec >= 1, t:"At least one modern study, memoir or other later reading", step:4},
    {ok: customs.every(s => !!genreOf(s)), t:`Non-course sources say what kind of evidence they are (${customs.filter(s => !!genreOf(s)).length}/${customs.length})`, step:4},
    {ok: customs.every(customComplete), t:`Non-course sources have full citation, year and where to find them (${customs.filter(customComplete).length}/${customs.length})`, step:4},
    {ok: outEra.every(fitOk), t:`Sources from outside your era explain why they fit (${outEra.filter(fitOk).length}/${outEra.length})`, step:4},
    {ok: d.actions.length >= 4, t:`Four or more diplomatic actions (${d.actions.length})`, step:5},
    {ok: d.actions.every(a => !!claimLabel(a.claimRationale) && !!claimLabel(a.claimReadings)), t:`Every action says what kind of claim its rule and readings make (${d.actions.filter(a => !!claimLabel(a.claimRationale) && !!claimLabel(a.claimReadings)).length}/${d.actions.length})`, step:5},
    {ok: d.actions.length > 0 && linked === d.actions.length, t:`Every action is linked to a source (${linked}/${d.actions.length})`, step:5},
    {ok: d.actions.length > 0 && readings === d.actions.length, t:`Every action has two different readings (${readings}/${d.actions.length})`, step:5},
    {ok: d.actions.length > 0 && perCourt === d.actions.length, t:`Every action has a reading written for every court (${perCourt}/${d.actions.length})`, step:5},
    {ok: d.actions.length > 0 && rationales === d.actions.length, t:`Every action has your rationale tied to its source (${rationales}/${d.actions.length})`, step:5},
    {ok: d.events.length >= Math.min(3, rounds || 3), t:`Historical events for the rounds (${d.events.length})`, step:6},
    {ok: (() => { const o = d.opening; if ((!o || !String(o.text || "").trim()) && Array.isArray(d.rounds) && d.rounds[0] && d.rounds[0].scene) return true; return !!o && String(o.title || "").trim().length >= 3 && sentences(o.text) >= 2 && openingDateOk(d) && !!(o.source || (o.sources || []).length); })(), t:"Opening scene: titled, two or more sentences, dated no later than the year the game opens, and sourced", step:6},
    {ok: d.events.length > 0 && evIn === d.events.length, t:`Every event is dated inside your era (${evIn}/${d.events.length})`, step:6},
    {ok: d.events.length > 0 && evSrc === d.events.length, t:`Every event is linked to a source (${evSrc}/${d.events.length})`, step:6},
    {ok: d.traps.filter(t => (t.modern || "").trim() && (t.historical || "").trim()).length >= 2, t:"Two or more anachronism traps", step:7}
  ];
}

/* ---------- untrusted input limits (server checks every design it stores or hosts) ---------- */
const LIMITS = {bytes: 250_000, actors: 12, actions: 40, events: 24, sources: 40, traps: 20, resources: 4, text: 3000};
export function validateDesign(x: unknown): string | null {
  if (!x || typeof x !== "object") return "Design is missing.";
  const d = x as Design;
  let size = 0; try { size = JSON.stringify(d).length; } catch { return "Design could not be read."; }
  if (size > LIMITS.bytes) return "Design is too large.";
  for (const k of ["actors","actions","events","sources","traps","resources"] as const) if (!Array.isArray(d[k])) return `Design has no ${k} list.`;
  if (!d.era || !d.victory || !d.map || !Array.isArray(d.map.terrain) || !Array.isArray(d.map.places)) return "Design is incomplete.";
  if (d.actors.length > LIMITS.actors || d.actions.length > LIMITS.actions || d.events.length > LIMITS.events || d.sources.length > LIMITS.sources || d.traps.length > LIMITS.traps || d.resources.length !== LIMITS.resources) return "Design has too many items.";
  const tooLong = (v: unknown): boolean => typeof v === "string" ? v.length > LIMITS.text : Array.isArray(v) ? v.some(tooLong) : (v && typeof v === "object") ? Object.values(v).some(tooLong) : false;
  if (tooLong(d)) return "A text field in the design is too long.";
  const rounds = num(d.victory.rounds); if (rounds == null || rounds < 1 || rounds > 12) return "Rounds must be between 1 and 12.";
  if (!d.actors.some(a => a.playable)) return "Design has no playable actors.";
  return null;
}
export function cleanNickname(raw: unknown): string | null {
  const s = String(raw ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  return s.length >= 2 ? s : null;
}

/* ---------- turn engine (serializable state) ---------- */
export function eventsSorted(d: Design): GameEvent[] { return d.events.slice().sort((a, b) => Number(a.year) - Number(b.year)); }
export function yearFor(d: Design, round: number): Num {
  /* A design with per-round settings (the contemporary demo) names each round's year outright. */
  const set = Array.isArray(d.rounds) ? d.rounds[round - 1] : undefined;
  if (set && typeof set.year === "number") return set.year;
  const r = eraRange(d), n = num(d.victory.rounds) || 1;
  if (!r || r[0] === r[1]) return "";
  return Math.round(r[0] + (r[1] - r[0]) * (round - 1) / n);
}
/* The event that closes a round: the earliest event dated inside that round's slice of the era.
   Without era years, events are used in date order, one per round. */
export function eventForRound(d: Design, round: number): GameEvent | null {
  const evs = eventsSorted(d), r = eraRange(d), n = num(d.victory.rounds) || 1;
  if (!r || r[0] === r[1]) return evs[round - 1] ?? null;
  const lo = Number(yearFor(d, round)), hi = round >= n ? r[1] + 1 : Number(yearFor(d, round + 1));
  return evs.find(e => { const y = Number(e.year); return y >= lo && y < hi; }) ?? null;
}
/* The opening scene: the designer's own, or for a news-built world without one, round 1's scene. */
export function openingOf(d: Design): Opening | null {
  const o = d.opening;
  if (o && String(o.title || "").trim() && String(o.text || "").trim()) return o;
  const r = Array.isArray(d.rounds) ? d.rounds[0] : null;
  if (r && r.scene) return { year: r.year, title: "Where things stand", text: r.scene, source: "", sources: r.sceneSources || [] };
  return null;
}
export const blankOpening = (): Opening => ({ year: "", title: "", text: "", ask: "", source: "" });
/* Year the opening scene is dated, and whether it sits before or at the start of the game (never after). */
export function openingDateOk(d: Design): boolean {
  const o = d.opening, r = eraRange(d), y = o ? num(o.year) : null;
  return !!r && y != null && y <= r[0] && y >= COURSE_SPAN[0];
}
/* A started game: if the world has an opening scene, everyone sees it first and nothing moves until the TA begins. */
export function startState(d: Design, order: string[]): GameState {
  const st = newState(d, order);
  if (openingOf(d)) st.pause = { round: 0, kind: "opening", seq: st.seq, share: true };
  return st;
}
export function newState(d: Design, order: string[]): GameState {
  const res: GameState["res"] = {};
  d.actors.forEach(a => { const m: Record<string, number> = {}; d.resources.forEach(r => { m[r.key] = Number(a.start[r.key] || 0); }); res[a.id] = m; });
  return {order, turn:0, round:1, res, last:{}, log:[], route:null, seq:1, over:false};
}
function applyEffects(d: Design, st: GameState, effects: Effect[], self: string | null, target: string | null, delta: GameState["last"]): void {
  for (const e of effects || []) {
    const ids = e.to === "self" ? [self] : e.to === "target" ? [target] : e.to === "all" ? d.actors.map(a => a.id) : [e.to];
    for (const id of ids) {
      const row = id ? st.res[id] : undefined; if (!id || !row) continue;
      const n = Number(e.d) || 0;
      row[e.res] = (row[e.res] || 0) + n;
      const dl = (delta[id] = delta[id] || {}); dl[e.res] = (dl[e.res] || 0) + n;
    }
  }
}
export function canTake(d: Design, st: GameState, a: Action, actorId: string): {ok: boolean; blocked?: string} {
  if (!(a.who.includes("any") || a.who.includes(actorId))) return {ok:false};
  if (a.target !== "none" && a.target !== "choose" && a.target === actorId) return {ok:false};
  for (const e of a.effects) {
    if (e.to === "self" && e.d < 0 && ((st.res[actorId] || {})[e.res] || 0) + e.d < 0)
      return {ok:true, blocked:"Not enough " + ((d.resources.find(r => r.key === e.res) || {name:e.res}).name)};
  }
  return {ok:true};
}
/* Applies one turn and returns the log entries it created, oldest first (a move or pass, then the
   end-of-round event if the round closed). st.log keeps only the recent 40; history keeps everything. */
export function resolveMove(d: Design, st: GameState, move: Move, rnd: () => number = Math.random): LogEntry[] {
  const who = st.order[st.turn] ?? "";
  const made: LogEntry[] = [];
  const a = !move.pass ? d.actions.find(x => x.id === move.action) : undefined;
  const check = a ? canTake(d, st, a, who) : null;
  if (!a || move.pass || !check || !check.ok || check.blocked) {
    const e: LogEntry = move.npc ? {kind:"pass", id:uid(), round:st.round, who, npc:move.npc} : {kind:"pass", id:uid(), round:st.round, who}; st.log.unshift(e); made.push(e); st.last = {}; st.route = null;
  } else {
    const t = move.target;
    const target = a.target === "choose" ? (t && t !== who && d.actors.find(x => x.id === t) ? t : null) : (a.target === "none" ? null : a.target);
    const delta: GameState["last"] = {};
    applyEffects(d, st, a.effects, who, target, delta);
    let failed = false;
    if (a.risk && Number(a.risk.chance) > 0 && rnd() * 100 < Number(a.risk.chance)) { failed = true; applyEffects(d, st, a.risk.effects, who, target, delta); }
    const e: LogEntry = {kind:"action", id:uid(), round:st.round, who, target, action:a.id, failed, year:yearFor(d, st.round), why:(move.why || []).slice(0, 3), votes:move.votes ?? null};
    if (move.npc && e.kind === "action") e.npc = move.npc;
    st.log.unshift(e); made.push(e);
    st.last = delta;
    const A = d.actors.find(x => x.id === who), T = target ? d.actors.find(x => x.id === target) : undefined;
    st.route = T && T.tile && A && A.tile ? {from:A.tile, to:T.tile, fail:failed} : null;
  }
  st.turn++;
  if (st.turn >= st.order.length) {
    st.turn = 0;
    const ev = eventForRound(d, st.round);
    if (ev) {
      const dl: GameState["last"] = {};
      applyEffects(d, st, ev.effects, null, null, dl);
      const e: LogEntry = {kind:"event", id:uid(), round:st.round, event:ev}; st.log.unshift(e); made.push(e);
      for (const [id, m] of Object.entries(dl)) { const l = (st.last[id] = st.last[id] || {}); for (const [k, v] of Object.entries(m)) l[k] = (l[k] || 0) + v; }
    }
    st.round++;
    if (st.round > (num(d.victory.rounds) || 1)) st.over = true;
  }
  st.seq++;
  st.log = st.log.slice(0, 40);
  return made;
}
/* Team vote: plurality action (ties go to the earliest vote), plurality target among those votes. */
export function tallyVotes(votes: Vote[]): Move | null {
  if (!votes.length) return null;
  const by: Record<string, Vote[]> = {};
  for (const v of votes) { const k = v.pass ? "__pass" : v.action; (by[k] = by[k] || []).push(v); }
  const groups = Object.values(by).sort((x, y) => y.length - x.length || Math.min(...x.map(v => v.at)) - Math.min(...y.map(v => v.at)));
  const best = groups[0]!;
  const counts: VoteCount = {total:votes.length, chosen:best.length};
  if (best[0]!.pass) return {pass:true, votes:counts};
  const tg: Record<string, number> = {};
  for (const v of best) if (v.target) tg[v.target] = (tg[v.target] || 0) + 1;
  const target = Object.keys(tg).sort((a, b) => (tg[b] || 0) - (tg[a] || 0))[0] || "";
  return {action:best[0]!.action, target, why:best.filter(v => (v.why || "").trim()).slice(0, 3).map(v => ({name:v.name, text:v.why, src:v.src || "", loc:v.loc || "", quote:v.quote || ""})), votes:counts};
}

/* ---------- required evidence for a vote (Phase 3, Decision B) ---------- */
export const WHY_MIN = 15, LOC_MIN = 2, QUOTE_MAX = 300;
/* What a reasoned vote still lacks, in plain words. Empty = ready to send. A quote is never required.
   If a world lists no sources (a rough test draft), source and location can't be required. */
export function evidenceMissing(d: Design, a: Action, v: { why?: string; src?: string; loc?: string; target?: string }, who: string): string[] {
  const out: string[] = [];
  if (a.target === "choose" && !d.actors.some(x => x.id === v.target && x.id !== who)) out.push("which court the move is toward");
  if (d.sources.length) {
    if (!d.sources.some(s => s.id === v.src)) out.push("a source from this world's readings");
    if ((v.loc || "").trim().length < LOC_MIN) out.push("where in that source your evidence is (page, chapter or section)");
  }
  if ((v.why || "").trim().length < WHY_MIN) out.push("your reasoning (at least one full sentence)");
  return out;
}

/* ---------- history (Phase 1) ---------- */
export const ballotOf = (v: Vote): Ballot => ({name:v.name, pass:!!v.pass, action:v.pass ? "" : v.action, target:v.pass ? "" : (v.target || ""), why:v.why || "", src:v.src || "", loc:v.loc || "", quote:v.quote || ""});
/* One record per entry that resolveMove created. `before` is the turn and seq the move was made on.
   Each court's reading is stored as shown, so later edits to the design never change the record. */
export function historyRows(d: Design, before: {seq: number; turn: number}, made: LogEntry[], ballots: Ballot[], resolvedBy: ResolvedBy, at: string = new Date().toISOString()): HistoryRow[] {
  return made.map((e): HistoryRow => {
    const base = {seq:before.seq, round:e.round, turn:before.turn, npc:resolvedBy === "npc", resolvedBy, at};
    if (e.kind === "event") return {...base, kind:"event", year:e.event.year, actor:"", target:"", action:"", failed:false, ballots:[], readings:{}, event:e.event};
    if (e.kind === "pass") return {...base, kind:"pass", year:yearFor(d, e.round), actor:e.who, target:"", action:"", failed:false, ballots, readings:{}, event:null};
    const a = d.actions.find(x => x.id === e.action);
    return {...base, kind:"action", year:e.year, actor:e.who, target:e.target || "", action:e.action, failed:e.failed, ballots, readings:a ? readingsFor(d, a, e.who) : {}, event:null};
  });
}
/* Query by round, acting court and/or target court. Results are in play order. */
export function filterHistory(rows: HistoryRow[], q: HistoryQuery): HistoryRow[] {
  return rows.filter(r => r.kind !== "note" && (q.round == null || r.round === q.round) && (!q.actor || r.actor === q.actor) && (!q.target || r.target === q.target))
    .sort((a, b) => a.seq - b.seq || (a.kind === "event" ? 1 : 0) - (b.kind === "event" ? 1 : 0));
}
/* Everything the round's debrief needs: its turns in order, the event that closed it, and the world's traps. */
export function roundSummary(d: Design, rows: HistoryRow[], round: number): RoundSummary {
  const inRound = filterHistory(rows, {round});
  const note = rows.find(r => r.kind === "note" && r.round === round);
  const out: RoundSummary = {round, turns:inRound.filter(r => r.kind !== "event"), event:inRound.find(r => r.kind === "event") || null, traps:d.traps.filter(t => (t.modern || "").trim())};
  if (note && note.note) out.note = note.note;
  return out;
}
export type { LogEntry };
