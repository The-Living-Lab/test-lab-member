/* Shared types for designs, game state and live rooms. Used by the browser and the server. */
export type Num = number | "";
export type Tile = [number, number];
export type SourceType = "primary" | "secondary" | "supplemental";
/* What kind of evidence a source is. Only "document", "reporting" and "collection" count as primary evidence. */
export type Genre = "document" | "reporting" | "collection" | "memoir" | "scholarship";

export interface Effect { to: string; res: string; d: number }
export interface Risk { chance: Num; effects: Effect[]; text: string }
export interface Action {
  id: string; name: string; who: string[]; target: string; effects: Effect[];
  readingSelf: string; readingOther: string; rationale: string; trap: string;
  source: string; page: string; risk: Risk;
  /* How each court reads this move, keyed by actor id (Phase 1). Blank falls back to readingSelf for the
     acting court and readingOther for everyone else. */
  readings?: Record<string, string>;
  /* Redesign Phase 1: what kind of claim the rationale and the court readings are (shown to players). */
  claimRationale?: ClaimKind; claimReadings?: ClaimKind;
}
export type ClaimKind = "documented" | "inference" | "assumption";
/* A student's audit of an AI move: what the move rewards and what the sources say about it. Student work. */
export interface Audit { name: string; text: string; at?: string }
export interface Actor {
  id: string; name: string; kind: string; tile: Tile | null; playable: boolean;
  worldview: string; goal: string; start: Record<string, Num>;
}
export interface Resource { key: string; name: string; meaning: string }
export interface Source {
  id: string; type: SourceType; citation: string; note: string;
  /* Non-course sources: what kind of evidence it is, chosen by the designer and checked by the instructor. */
  genre?: Genre;
  key?: string; year: Num; where: string; fit: string;
  /* Optional designer-written prompt: what players should look for in this source. Never copied text. */
  lookFor?: string;
  /* News sources (contemporary demo): link, outlet, publication date, and labels for the Sources panel. */
  url?: string; outlet?: string; date?: string;
  state?: boolean;   /* state media: evidence of a government's framing, always paired with independent reporting */
  blog?: boolean;    /* posted to the EALC 1711 news blog */
  via?: string;      /* where the text was read, when not at the outlet's own page (e.g. a wire copy) */
}
export interface GameEvent { id: string; year: Num; title: string; text: string; effects: Effect[]; source: string;
  /* Contemporary demo: more than one source, and the exact date shown with the event. */
  sources?: string[]; date?: string }
/* The scene everyone sees after the host starts and before round 1: where the world stands, with a real
   event to react to. Dated no later than the year the game opens. */
export interface Opening { year: Num; date?: string; title: string; text: string; ask?: string; source: string; sources?: string[] }
export interface Trap { modern: string; historical: string }
export interface Place { c: number; r: number; name: string }
/* Contemporary demo (optional; the historical games leave these out). Each actor is a seat, held in each round
   by the real person in office that year. */
export interface SeatHolder {
  name: string; title: string;
  persona: string;     /* positions and red lines, paraphrased from that year's reporting; no invented quotes */
  sources: string[];   /* source ids the persona is built from */
  changed?: string;    /* set when the seat changed hands since the last round: who and why it matters */
  did: string;         /* what this seat actually did in the round, for the "what really happened" comparison */
}
export interface Gloss { term: string; text: string }
export interface RoundInfo { year: number; scene: string; sceneSources: string[]; holders: Record<string, SeatHolder>; glossary?: Gloss[] }
export interface Design {
  gid: string; sandbox?: boolean; title: string; subtitle: string;
  era: { label: string; start: Num; end: Num; week: string };
  order: string; setting: string; premise: string;
  resources: Resource[]; actors: Actor[];
  map: { cols: number; rows: number; terrain: string[]; places: Place[] };
  sources: Source[]; actions: Action[]; events: GameEvent[]; traps: Trap[];
  victory: { rounds: Num; res: string; text: string };
  published?: boolean; updatedAt: number;
  /* Contemporary demo extras (optional). */
  opening?: Opening;           /* shown to everyone before round 1 */
  rounds?: RoundInfo[];        /* one per round: its year, scene, seat holders and new terms */
  howto?: string[];            /* the "How this game works" screen before round 1 */
  outro?: string;              /* closing screen: how the historical version differs */
  notice?: string;             /* shown on every play screen */
  labels?: { traps?: string; assume?: string; shows?: string };
  submission?: { id: string; editKey: string; nickname: string };
}

/* A reason given for a move. `loc` is where in the source the evidence is (page, chapter, section) and
   `quote` an optional short quote the student typed from their own copy. */
export interface Why { name: string; text: string; src: string; loc?: string; quote?: string }
export interface VoteCount { total: number; chosen: number }
export type LogEntry =
  | { kind: "pass"; id: string; round: number; who: string; npc?: NpcMode }
  | { kind: "action"; id: string; round: number; who: string; target: string | null; action: string; failed: boolean; year: Num; why: Why[]; votes: VoteCount | null; npc?: NpcMode }
  | { kind: "event"; id: string; round: number; event: GameEvent };
export interface GameState {
  order: string[]; turn: number; round: number;
  res: Record<string, Record<string, number>>;
  last: Record<string, Record<string, number>>;
  log: LogEntry[];
  route: { from: Tile; to: Tile; fail: boolean } | null;
  seq: number; over: boolean;
  startedAt?: string;
  /* Phase 4: set while the TA runs a pause-and-debrief; nothing resolves until the TA continues. */
  pause?: Pause | null;
}
export type PauseMode = "round" | "move";
/* "opening": the game has started and the opening scene is on screen; no one moves until the TA begins round 1. */
export type PauseKind = PauseMode | "opening";
export interface Pause { round: number; kind: PauseKind; seq: number; share: boolean }
/* "ai": chosen and reasoned by the AI model; "rule": the simple rule-based fallback. Both are AI-court moves. */
export type NpcMode = "ai" | "rule";
export type Move = { pass: true; votes?: VoteCount; npc?: NpcMode; why?: Why[] } | { pass?: false; action: string; target: string; why: Why[]; votes?: VoteCount | null; npc?: NpcMode };
export interface Vote { action: string; target: string; why: string; src: string; loc?: string; quote?: string; pass: boolean; name: string; at: number }

export interface CourseSource {
  key: string; type: SourceType; genre: Genre; starred: boolean; short: string; citation: string; week: string;
  from: number; to: number; any?: boolean; terms: string[];
}
export interface CheckItem { ok: boolean; t: string; step: number }
export interface ChronoFlag { kind: "date" | "modern"; where: string; text: string }


/* ---------- durable history (Phase 1): one record per move, pass or end-of-round event ---------- */
export interface Ballot { name: string; pass: boolean; action: string; target: string; why: string; src: string; loc: string; quote: string; npc?: NpcMode }
export type ResolvedBy = "vote" | "reveal" | "skip" | "empty" | "local" | "npc";
export interface HistoryRow {
  seq: number; kind: "action" | "pass" | "event" | "note"; round: number; turn: number; year: Num;
  actor: string; target: string; action: string; failed: boolean;
  npc: boolean; resolvedBy: ResolvedBy;
  ballots: Ballot[];                    /* every voter's choice and evidence, winners and losers */
  readings: Record<string, string>;     /* the reading each court was shown, keyed by actor id */
  event: GameEvent | null;
  at: string;
  /* Phase 4, host only: TA tags on reasons, keyed "b<ballot index>", and (on kind "note") the round note. */
  tags?: Record<string, TaTag>;
  /* Redesign Phase 1: students' audits of an AI move (host and record only in live games). */
  audits?: Audit[];
  note?: string;
}
export type TaTag = "strong" | "check" | "anachronism";
export interface HistoryQuery { round?: number; actor?: string; target?: string }
export interface RoundSummary { round: number; turns: HistoryRow[]; event: HistoryRow | null; traps: Trap[]; note?: string }
