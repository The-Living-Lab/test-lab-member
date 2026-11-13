/* Server-only game backend. Runs inside server functions with the service role, so it bypasses
   row-level security; every function here therefore checks the caller itself. Browsers never write
   tables directly. Loaded only via dynamic import from game.functions.ts. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { QUOTE_MAX, allowedReadings, auditOk, ballotOf, cleanAudit, passWhyOk, cleanNickname, evidenceMissing, historyRows, startState, resolveMove, roundSummary, tallyVotes, upgradeDesign, validateDesign } from "@/game/logic";
import { pauseAfter } from "@/game/debrief";
import { balanceTeams, lateJoinCourt, npcBallot, npcPrompt, parseNpcReply, ruleMove } from "@/game/npc";
import type { Audit, Ballot, Design, GameState, HistoryQuery, HistoryRow, Move, NpcMode, PauseMode, ResolvedBy, RoundSummary, TaTag, Vote } from "@/game/types";

const PAUSED = "The TA has paused the game for discussion. Wait for the TA to continue.";
const NOTE_MAX = 2000;

type Ctx = { userId: string; ip: string };
type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string };
export type Result<T = object> = Ok<T> | Fail;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => supabaseAdmin as any; // tables are created outside Lovable's type generator
const fail = (error: string): Fail => ({ ok: false, error });
const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_PLAYERS = 60;
const AI_CALLS_PER_GAME = 80;   // AI-court moves plus the host's AI reading helper; about 2 cents at Haiku prices
const AI_TIMEOUT_MS = 20_000;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/* ---------- small utilities ---------- */
function randomString(n: number, alphabet = CODE_CHARS): string {
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return Array.from(a, x => alphabet[x % alphabet.length]).join("");
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}
const pepper = () => process.env["SUPABASE_SERVICE_ROLE_KEY"] || "tt";
const ipKey = async (ip: string) => "ip:" + (await sha256(pepper() + "|" + ip)).slice(0, 32);
const nowIso = () => new Date().toISOString();
const expiry = () => new Date(Date.now() + ROOM_TTL_MS).toISOString();

/* Lockouts count per device (anonymous user) and, more loosely, per network address:
   a whole classroom may share one address, so its limit is much higher. */
async function tooMany(kind: string, ctx: Ctx, maxUser: number, maxNet: number, minutes: number, failuresOnly = true): Promise<boolean> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const count = async (subject: string) => {
    let q = db().from("attempts").select("id", { count: "exact", head: true }).eq("kind", kind).eq("subject", subject).gte("at", since);
    if (failuresOnly) q = q.eq("ok", false);
    const { count: c } = await q; return c || 0;
  };
  return (await count(ctx.userId)) >= maxUser || (await count(await ipKey(ctx.ip))) >= maxNet;
}
async function record(kind: string, ctx: Ctx, ok: boolean): Promise<void> {
  await db().from("attempts").insert([{ kind, subject: ctx.userId, ok }, { kind, subject: await ipKey(ctx.ip), ok }]);
}
async function cleanup(): Promise<void> {
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  await db().from("attempts").delete().lt("at", dayAgo);
  await db().from("rooms").delete().lt("expires_at", dayAgo);
}

/* ---------- rooms: shared loading, team computation, and state settling ---------- */
interface RoomRow {
  id: string; code: string; host_user_id: string; game_key: string | null; test: boolean; title: string;
  phase: "lobby" | "play" | "over" | "closed"; state: GameState | null; teams: Record<string, string[]>;
  progress: { seq: number; actor: string; voted: number; of: number; npc?: boolean } | null; locked: boolean; rev: number; expires_at: string;
  fill_ai: boolean; pause_mode?: PauseMode;
}
interface SeatRow { id: string; user_id: string; nickname: string; actor: string | null; joined_at: string }

async function loadRoom(roomId: string): Promise<RoomRow | null> {
  const { data } = await db().from("rooms").select("*").eq("id", roomId).maybeSingle();
  return (data as RoomRow) || null;
}
async function loadDesign(roomId: string): Promise<Design | null> {
  const { data } = await db().from("room_private").select("design").eq("room_id", roomId).maybeSingle();
  return data ? upgradeDesign(data.design as Design) : null;
}
async function loadSeats(roomId: string): Promise<SeatRow[]> {
  const { data } = await db().from("seats").select("id,user_id,nickname,actor,joined_at").eq("room_id", roomId).order("joined_at");
  return (data as SeatRow[]) || [];
}
const isOpen = (r: RoomRow) => r.phase !== "closed" && new Date(r.expires_at).getTime() > Date.now();

/* Teams for display: nicknames per court, with repeated nicknames numbered so the class can tell them apart. */
function computeTeams(design: Design, room: RoomRow, seats: SeatRow[]) {
  const used: Record<string, number> = {}, display = new Map<string, string>();
  const teams: Record<string, string[]> = {}, members: Record<string, SeatRow[]> = {};
  for (const s of seats) {
    const base = s.nickname.toLowerCase(); used[base] = (used[base] || 0) + 1;
    display.set(s.id, used[base]! > 1 ? `${s.nickname} (${used[base]})` : s.nickname);
  }
  for (const s of seats) {
    if (!s.actor) continue;
    const a = design.actors.find(x => x.id === s.actor);
    if (!a || !a.playable) continue;
    if (room.phase !== "lobby" && room.state && !room.state.order.includes(a.id)) continue;
    (teams[a.id] = teams[a.id] || []).push(display.get(s.id)!);
    (members[a.id] = members[a.id] || []).push(s);
  }
  return { teams, members, display };
}
async function votesFor(roomId: string, seq: number, seatIds: string[]): Promise<{ seat_id: string; action: string; target: string; why: string; src: string; loc: string; quote: string; pass: boolean; created_at: string }[]> {
  if (!seatIds.length) return [];
  const { data } = await db().from("votes").select("seat_id,action,target,why,src,loc,quote,pass,created_at").eq("room_id", roomId).eq("seq", seq).in("seat_id", seatIds);
  return data || [];
}

/* ---------- durable history (Phase 1): every move, pass and event, never capped ---------- */
const toDbHistory = (roomId: string, r: HistoryRow) => ({ room_id: roomId, seq: r.seq, kind: r.kind, round: r.round, turn: r.turn,
  year: r.year === "" ? null : r.year, actor: r.actor, target: r.target, action: r.action, failed: r.failed, npc: r.npc,
  resolved_by: r.resolvedBy, ballots: r.ballots, readings: r.readings, event: r.event, created_at: r.at, tags: r.tags || {}, note: r.note || "" });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/* Redesign Phase 1: students' audits of an AI move ride in the row's host-only tags under "audit:<seat id>",
   so no table changes; they are split back out here. */
const AUDIT_KEY = "audit:";
function splitTags(raw: unknown): { tags?: Record<string, TaTag>; audits?: Audit[] } {
  if (!raw || typeof raw !== "object") return {};
  const tags: Record<string, TaTag> = {}, audits: Audit[] = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.startsWith(AUDIT_KEY)) { try { const a = JSON.parse(String(v)); if (a && typeof a.text === "string") audits.push({ name: String(a.name || ""), text: a.text, at: String(a.at || "") }); } catch { /* skip */ } }
    else tags[k] = v as TaTag;
  }
  audits.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { ...(Object.keys(tags).length ? { tags } : {}), ...(audits.length ? { audits } : {}) };
}
const fromDbHistory = (x: any): HistoryRow => ({ seq: x.seq, kind: x.kind, round: x.round, turn: x.turn, year: x.year ?? "",
  actor: x.actor || "", target: x.target || "", action: x.action || "", failed: !!x.failed, npc: !!x.npc, resolvedBy: x.resolved_by,
  ballots: x.ballots || [], readings: x.readings || {}, event: x.event || null, at: x.created_at,
  ...splitTags(x.tags), ...(x.note ? { note: x.note } : {}) });
async function saveHistory(roomId: string, rows: HistoryRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db().from("history").insert(rows.map(r => toDbHistory(roomId, r)));
  if (error && error.code !== "23505") console.error("history insert failed", error);
}

/* Bring a room up to date: auto-pass courts with no players, resolve a turn once every team member
   has voted (or when the host forces a reveal), refresh the teams and vote-progress shown to everyone.
   Writes are guarded by `rev`, so two simultaneous requests can never resolve the same turn twice. */
type NpcResult = { seq: number; who: string; move: Move };
async function settle(roomId: string, force?: "reveal" | "skip", npc?: NpcResult): Promise<Result> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await loadRoom(roomId);
    if (!room || room.phase === "closed") return fail("This game has ended.");
    const design = await loadDesign(roomId);
    if (!design) return fail("This game has no world loaded.");
    const seats = await loadSeats(roomId);
    let { teams, members, display } = computeTeams(design, room, seats);
    let state = room.state ? (JSON.parse(JSON.stringify(room.state)) as GameState) : null;
    let phase = room.phase;
    let forced = force;
    const rows: HistoryRow[] = [];
    const step = (st: GameState, move: Move, ballots: Ballot[], by: ResolvedBy) => {
      const before = { seq: st.seq, turn: st.turn };
      const made = resolveMove(design, st, move);
      rows.push(...historyRows(design, before, made, ballots, by));
      pauseAfter(st, made, room.pause_mode === "move" ? "move" : "round");   /* Phase 4: stop for the TA's debrief */
    };
    if (phase === "play" && state) {
      for (let i = 0; i < 50 && !state.over && !state.pause; i++) {
        const who = state.order[state.turn]!;
        const team = members[who] || [];
        if (forced === "skip") { step(state, { pass: true }, [], "skip"); forced = undefined; continue; }
        if (!team.length) {
          if (!room.fill_ai) { step(state, { pass: true }, [], "empty"); continue; }
          /* AI court: apply its move only if it was made for exactly this turn; otherwise wait for npcTurn.
             One AI move per settle, so the host's pacing decides when the next AI court reveals. */
          if (npc && npc.seq === state.seq && npc.who === who) { step(state, npc.move, [npcBallot(npc.move)], "npc"); npc = undefined; continue; }
          break;
        }
        const vs = await votesFor(roomId, state.seq, team.map(s => s.id));
        if (vs.length >= team.length || (forced === "reveal" && vs.length > 0)) {
          const votes: Vote[] = vs.map(v => ({ action: v.action, target: v.target, why: v.why, src: v.src, loc: v.loc || "", quote: v.quote || "", pass: v.pass, name: display.get(v.seat_id) || "Player", at: new Date(v.created_at).getTime() }));
          const move: Move = tallyVotes(votes) || { pass: true };
          step(state, move, votes.sort((a, b) => a.at - b.at).map(ballotOf), vs.length >= team.length ? "vote" : "reveal");
          forced = undefined;
          continue;
        }
        break;
      }
      if (state.over) phase = "over";
      ({ teams, members, display } = computeTeams(design, { ...room, phase, state }, seats));
    }
    let progress: RoomRow["progress"] = null;
    if (phase === "play" && state && !state.over && !state.pause) {
      const who = state.order[state.turn]!, team = members[who] || [];
      progress = !team.length && room.fill_ai
        ? { seq: state.seq, actor: who, voted: 0, of: 0, npc: true }
        : { seq: state.seq, actor: who, voted: (await votesFor(roomId, state.seq, team.map(s => s.id))).length, of: team.length };
    }
    const changed = phase !== room.phase || JSON.stringify(state) !== JSON.stringify(room.state)
      || JSON.stringify(teams) !== JSON.stringify(room.teams) || JSON.stringify(progress) !== JSON.stringify(room.progress);
    if (!changed) return { ok: true };
    const { data } = await db().from("rooms")
      .update({ phase, state, teams, progress, rev: room.rev + 1, updated_at: nowIso(), expires_at: expiry() })
      .eq("id", roomId).eq("rev", room.rev).select("id");
    if (data && data.length) { await saveHistory(roomId, rows); return { ok: true }; }
  }
  return fail("The game was busy. Try again.");
}
async function requireHost(ctx: Ctx, roomId: string): Promise<RoomRow | Fail> {
  const room = await loadRoom(roomId);
  if (!room || !isOpen(room)) return fail("This game has ended or expired.");
  if (room.host_user_id !== ctx.userId) return fail("Only the host can do that.");
  return room;
}
async function mySeat(ctx: Ctx, roomId: string): Promise<SeatRow | null> {
  const { data } = await db().from("seats").select("id,user_id,nickname,actor,joined_at").eq("room_id", roomId).eq("user_id", ctx.userId).maybeSingle();
  return (data as SeatRow) || null;
}

/* ---------- host ---------- */
export async function hostCreateRoom(ctx: Ctx, input: { design?: unknown; designId?: string | undefined }): Promise<Result<{ roomId: string; code: string; recoveryKey: string }>> {
  if (await tooMany("create", ctx, 10, 60, 60, false)) return fail("Too many games started from this device. Wait an hour and try again.");
  await record("create", ctx, true);
  let design: Design, gameKey: string | null = null, test = true;
  if (input.designId) {
    const { data } = await db().from("designs").select("id,design,status").eq("id", input.designId).maybeSingle();
    if (!data || data.status !== "approved") return fail("That game is not approved for the class library.");
    design = upgradeDesign(data.design as Design); gameKey = data.id; test = false;
  } else {
    const problem = validateDesign(input.design);
    if (problem) return fail(problem);
    design = upgradeDesign(input.design as Design);
  }
  void cleanup();
  const recoveryKey = randomString(5) + "-" + randomString(5);
  for (let i = 0; i < 6; i++) {
    const code = randomString(6);
    const { data, error } = await db().from("rooms").insert({ code, host_user_id: ctx.userId, game_key: gameKey, test, title: design.title.slice(0, 200), expires_at: expiry() }).select("id").single();
    if (error) { if (error.code === "23505") continue; console.error(error); return fail("Could not create the game."); }
    const { error: e2 } = await db().from("room_private").insert({ room_id: data.id, design, recovery_hash: await sha256(recoveryKey.replace("-", "")) });
    if (e2) { console.error(e2); await db().from("rooms").delete().eq("id", data.id); return fail("Could not create the game."); }
    return { ok: true, roomId: data.id, code, recoveryKey };
  }
  return fail("Could not create a game code. Try again.");
}
export async function hostReopen(ctx: Ctx, input: { code: string; recoveryKey: string }): Promise<Result<{ roomId: string }>> {
  if (await tooMany("recover", ctx, 8, 40, 15)) return fail("Too many wrong attempts. Wait 15 minutes and try again.");
  const code = String(input.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const key = String(input.recoveryKey || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { data } = await db().from("rooms").select("id,phase,expires_at").eq("code", code).neq("phase", "closed").gt("expires_at", nowIso()).maybeSingle();
  const priv = data ? (await db().from("room_private").select("recovery_hash").eq("room_id", data.id).maybeSingle()).data : null;
  if (!data || !priv || priv.recovery_hash !== await sha256(key)) { await record("recover", ctx, false); return fail("That code and recovery key don't match an open game."); }
  await record("recover", ctx, true);
  await db().from("rooms").update({ host_user_id: ctx.userId, updated_at: nowIso(), expires_at: expiry() }).eq("id", data.id);
  return { ok: true, roomId: data.id };
}
export async function hostAction(ctx: Ctx, input: { roomId: string; action: string }): Promise<Result> {
  const room = await requireHost(ctx, input.roomId);
  if ("ok" in room) return room;
  const set = (patch: Record<string, unknown>) => db().from("rooms").update({ ...patch, rev: room.rev + 1, updated_at: nowIso(), expires_at: expiry() }).eq("id", room.id).eq("rev", room.rev).select("id");
  switch (input.action) {
    case "lock": case "unlock": await set({ locked: input.action === "lock" }); return { ok: true };
    case "ai-on": case "ai-off":
      if (room.phase !== "lobby") return fail("Choose this before the game starts.");
      await set({ fill_ai: input.action === "ai-on" }); return { ok: true };
    case "balance": {
      if (room.phase !== "lobby") return fail("Auto-balance works before the game starts. During play, move players one at a time.");
      const design = await loadDesign(room.id); if (!design) return fail("This game has no world loaded.");
      const seats = await loadSeats(room.id);
      const plan = balanceTeams(design.actors.filter(a => a.playable).map(a => a.id), seats.map(s => ({ id: s.id, actor: s.actor })));
      for (const s of seats) if (plan[s.id] && plan[s.id] !== s.actor) await db().from("seats").update({ actor: plan[s.id] }).eq("id", s.id);
      return settle(room.id);
    }
    case "start": {
      if (room.phase !== "lobby") return fail("The game has already started.");
      const design = await loadDesign(room.id); if (!design) return fail("This game has no world loaded.");
      const seats = await loadSeats(room.id);
      const withHumans = design.actors.filter(a => a.playable && seats.some(s => s.actor === a.id)).map(a => a.id);
      if (!withHumans.length) return fail("At least one player must pick a court before the game starts.");
      const order = room.fill_ai ? design.actors.filter(a => a.playable).map(a => a.id) : withHumans;
      const { data } = await set({ phase: "play", state: { ...startState(design, order), startedAt: nowIso() } });
      if (!data || !data.length) return fail("The game was busy. Try again.");
      return settle(room.id);
    }
    case "reveal": case "skip":
      if (room.phase !== "play") return fail("The game is not in play.");
      if (room.state?.pause) return fail(PAUSED);
      return settle(room.id, input.action);
    /* Phase 4: pause and debrief */
    case "pause-round": case "pause-move":
      await set({ pause_mode: input.action === "pause-move" ? "move" : "round" }); return { ok: true };
    case "share-on": case "share-off": {
      if (!room.state?.pause) return fail("The game is not paused.");
      const { data } = await set({ state: { ...room.state, pause: { ...room.state.pause, share: input.action === "share-on" } } });
      return data && data.length ? { ok: true } : fail("The game was busy. Try again.");
    }
    case "continue": {
      if (room.phase !== "play" || !room.state) return fail("The game is not in play.");
      if (!room.state.pause) return { ok: true };
      const { data } = await set({ state: { ...room.state, pause: null } });
      if (!data || !data.length) return fail("The game was busy. Try again.");
      return settle(room.id);
    }
    case "end": {
      if (!room.state) { await set({ phase: "over" }); return { ok: true }; }
      const state = { ...room.state, over: true, pause: null };
      await set({ phase: "over", state, progress: null }); return { ok: true };
    }
    case "close": await db().from("rooms").delete().eq("id", room.id); return { ok: true };
  }
  return fail("Unknown host action.");
}
/* The host moves one player. Never onto an AI-only court unless the host chose to take it over,
   which makes it human-played (its next vote waits for the new player). Rebalancing is never automatic. */
export async function hostMove(ctx: Ctx, input: { roomId: string; seatId: string; actor: string; takeover?: boolean | undefined }): Promise<Result> {
  const room = await requireHost(ctx, input.roomId);
  if ("ok" in room) return room;
  if (room.phase !== "lobby" && room.phase !== "play") return fail("This game has finished.");
  const design = await loadDesign(room.id); if (!design) return fail("This game has no world loaded.");
  const seats = await loadSeats(room.id);
  const seat = seats.find(s => s.id === input.seatId); if (!seat) return fail("That player has left.");
  const a = design.actors.find(x => x.id === input.actor);
  if (!a || !a.playable) return fail("That court can't be played.");
  if (room.phase === "play") {
    if (!room.state || !room.state.order.includes(a.id)) return fail("That court isn't in this game.");
    const humans = seats.filter(s => s.actor === a.id && s.id !== seat.id).length;
    if (!humans && room.fill_ai && !input.takeover) return fail("That court is played by AI. Choose \"Take over this AI court\" to give it to this player.");
  }
  await db().from("seats").update({ actor: a.id }).eq("id", seat.id);
  return settle(room.id);
}

/* Phase 4: the TA's record. Tags on individual reasons and one note per round, stored in history, host only. */
/* Redesign Phase 1: a seated student audits an AI move: what it rewards, and what the sources say about it.
   Saved as that student's work (one audit per student per move; a new one replaces theirs). Host and record only. */
export async function submitAudit(ctx: Ctx, input: { roomId: string; seq: number; text: string }): Promise<Result> {
  if (await tooMany("audit", ctx, 30, 2000, 5, false)) return fail("Too many audits too quickly. Wait a moment.");
  await record("audit", ctx, true);
  const room = await loadRoom(input.roomId);
  if (!room || !isOpen(room)) return fail("This game has ended or expired.");
  const seat = await mySeat(ctx, room.id); if (!seat) return fail("Join the game first.");
  const text = cleanAudit(input.text);
  if (!auditOk(text)) return fail("An audit needs at least a sentence: what the move rewards, and what the sources say.");
  const { data } = await db().from("history").select("tags,npc").eq("room_id", room.id).eq("seq", input.seq).eq("kind", "action").maybeSingle();
  if (!data) return fail("That move isn't in the record.");
  if (!data.npc) return fail("Only AI moves can be audited here.");
  const design = await loadDesign(room.id);
  let name = seat.nickname;
  if (design) { const { display } = computeTeams(design, room, await loadSeats(room.id)); name = display.get(seat.id) || name; }
  const tags: Record<string, string> = { ...(data.tags || {}) };
  tags[AUDIT_KEY + seat.id] = JSON.stringify({ name, text, at: nowIso() });
  const { error } = await db().from("history").update({ tags }).eq("room_id", room.id).eq("seq", input.seq).eq("kind", "action");
  if (error) { console.error(error); return fail("Could not save your audit."); }
  return { ok: true };
}
export async function hostTag(ctx: Ctx, input: { roomId: string; seq: number; ballot: number; tag: TaTag | null }): Promise<Result> {
  const room = await requireHost(ctx, input.roomId);
  if ("ok" in room) return room;
  const { data } = await db().from("history").select("tags,ballots").eq("room_id", room.id).eq("seq", input.seq).eq("kind", "action").maybeSingle();
  if (!data) return fail("That move isn't in the record.");
  if (!Array.isArray(data.ballots) || input.ballot < 0 || input.ballot >= data.ballots.length) return fail("That reason isn't in the record.");
  const tags: Record<string, TaTag> = { ...(data.tags || {}) };
  if (input.tag) tags["b" + input.ballot] = input.tag; else delete tags["b" + input.ballot];
  const { error } = await db().from("history").update({ tags }).eq("room_id", room.id).eq("seq", input.seq).eq("kind", "action");
  if (error) { console.error(error); return fail("Could not save the tag."); }
  return { ok: true };
}
export async function hostNote(ctx: Ctx, input: { roomId: string; round: number; note: string }): Promise<Result> {
  const room = await requireHost(ctx, input.roomId);
  if ("ok" in room) return room;
  if (!room.state || input.round < 1 || input.round > room.state.round) return fail("That round hasn't been played.");
  const note = String(input.note || "").slice(0, NOTE_MAX);
  /* One note row per round, stored at seq = -round so it never collides with a move. */
  const row = { room_id: room.id, seq: -input.round, kind: "note", round: input.round, turn: 0, year: null, actor: "", target: "", action: "",
    failed: false, npc: false, resolved_by: "local", ballots: [], readings: {}, event: null, tags: {}, note, created_at: nowIso() };
  const { error } = await db().from("history").upsert(row, { onConflict: "room_id,seq,kind" });
  if (error) { console.error(error); return fail("Could not save the note."); }
  return { ok: true };
}

/* ---------- reading the room (host and players) ---------- */
export async function getRoom(ctx: Ctx, input: { roomId: string }) {
  const room = await loadRoom(input.roomId);
  if (!room || !isOpen(room)) return fail("This game has ended or expired.");
  const seat = await mySeat(ctx, room.id);
  const isHost = room.host_user_id === ctx.userId;
  if (!isHost && !seat) return fail("You are not in this game. Join with the code first.");
  const design = await loadDesign(room.id);
  let votedSeq = 0;
  if (seat && room.state) {
    const { data } = await db().from("votes").select("seq").eq("seat_id", seat.id).eq("seq", room.state.seq).maybeSingle();
    if (data) votedSeq = data.seq;
  }
  let players: { id: string; nickname: string; actor: string | null }[] | undefined;
  let shownAs = seat ? seat.nickname : "";
  if (design && (isHost || seat)) {
    const seats = await loadSeats(room.id), { display } = computeTeams(design, room, seats);
    if (isHost) players = seats.map(s => ({ id: s.id, nickname: display.get(s.id) || s.nickname, actor: s.actor }));
    if (seat) shownAs = display.get(seat.id) || seat.nickname;
  }
  const started = room.state?.startedAt;
  /* The host's screen offers generative AI suggestions only when a key is set up (never the key itself). */
  const aiReady = isHost ? !!process.env["ANTHROPIC_API_KEY"] : undefined;
  return { ok: true as const, isHost, design, votedSeq, players, aiReady,
    room: { id: room.id, code: room.code, phase: room.phase, state: room.state, teams: room.teams, progress: room.progress, locked: room.locked, test: room.test, title: room.title, gameKey: room.game_key, expiresAt: room.expires_at, rev: room.rev, fillAi: room.fill_ai !== false, pauseMode: room.pause_mode === "move" ? "move" : "round" },
    seat: seat ? { id: seat.id, nickname: seat.nickname, shownAs, actor: seat.actor, late: !!(started && seat.joined_at > started) } : null };
}

/* History for the host and seated players: filter by round, acting court and/or target court. */
async function readHistory(ctx: Ctx, roomId: string, q: HistoryQuery): Promise<Fail | { room: RoomRow; rows: HistoryRow[] }> {
  const room = await loadRoom(roomId);
  if (!room || !isOpen(room)) return fail("This game has ended or expired.");
  if (room.host_user_id !== ctx.userId && !(await mySeat(ctx, room.id))) return fail("You are not in this game. Join with the code first.");
  let query = db().from("history").select("*").eq("room_id", room.id);
  if (q.round != null) query = query.eq("round", q.round);
  if (q.actor) query = query.eq("actor", q.actor);
  if (q.target) query = query.eq("target", q.target);
  const { data, error } = await query.order("seq").limit(2000);
  if (error) { console.error(error); return fail("Could not load the game record."); }
  const order = (r: HistoryRow) => r.seq * 2 + (r.kind === "event" ? 1 : 0);
  let rows = ((data || []) as unknown[]).map(fromDbHistory).sort((a, b) => order(a) - order(b));
  /* Phase 4: TA tags and round notes are for the host only. */
  if (room.host_user_id !== ctx.userId) rows = rows.filter(r => r.kind !== "note").map(({ tags: _t, note: _n, audits: _a, ...r }) => r);
  return { room, rows };
}
export async function getHistory(ctx: Ctx, input: { roomId: string; round?: number | undefined; actor?: string | undefined; target?: string | undefined }): Promise<Result<{ rows: HistoryRow[] }>> {
  const q: HistoryQuery = {};
  if (input.round != null) q.round = input.round;
  if (input.actor) q.actor = input.actor;
  if (input.target) q.target = input.target;
  const r = await readHistory(ctx, input.roomId, q);
  return "ok" in r ? r : { ok: true, rows: r.rows };
}
export async function getRound(ctx: Ctx, input: { roomId: string; round: number }): Promise<Result<{ summary: RoundSummary }>> {
  const r = await readHistory(ctx, input.roomId, { round: input.round });
  if ("ok" in r) return r;
  const design = await loadDesign(r.room.id); if (!design) return fail("This game has no world loaded.");
  return { ok: true, summary: roundSummary(design, r.rows, input.round) };
}

/* ---------- players ---------- */
export async function joinRoom(ctx: Ctx, input: { code: string; nickname: string }): Promise<Result<{ roomId: string }>> {
  if (await tooMany("join", ctx, 8, 80, 10)) return fail("Too many wrong codes. Wait 10 minutes and try again.");
  const code = String(input.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const nickname = cleanNickname(input.nickname);
  if (!nickname) return fail("Enter a nickname of at least two characters.");
  const { data: room } = /^[A-Z0-9]{6}$/.test(code)
    ? await db().from("rooms").select("id,phase,locked,expires_at").eq("code", code).neq("phase", "closed").gt("expires_at", nowIso()).maybeSingle()
    : { data: null };
  if (!room) { await record("join", ctx, false); return fail("No open game uses that code. Check the code on the main screen."); }
  await record("join", ctx, true);
  const existing = await mySeat(ctx, room.id);
  if (existing) { await db().from("seats").update({ nickname }).eq("id", existing.id); return { ok: true, roomId: room.id }; }
  if (room.locked) return fail("The host has locked this game. Ask the TA to unlock it.");
  if (room.phase === "over") return fail("This game has finished.");
  const { count } = await db().from("seats").select("id", { count: "exact", head: true }).eq("room_id", room.id);
  if ((count || 0) >= MAX_PLAYERS) return fail("This game is full.");
  /* After the start, a new player is placed on the human court with the fewest humans (never an AI-only
     court). If nobody is playing any court, they choose one themselves. */
  let actor: string | null = null;
  if (room.phase === "play") {
    const full = await loadRoom(room.id);
    if (full?.state) {
      const humans: Record<string, number> = {};
      for (const s of await loadSeats(room.id)) if (s.actor && full.state.order.includes(s.actor)) humans[s.actor] = (humans[s.actor] || 0) + 1;
      actor = lateJoinCourt(full.state.order, humans);
    }
  }
  const { error } = await db().from("seats").insert({ room_id: room.id, user_id: ctx.userId, nickname, actor });
  if (error) { console.error(error); return fail("Could not join. Try again."); }
  if (actor) await settle(room.id);
  return { ok: true, roomId: room.id };
}
export async function claimCourt(ctx: Ctx, input: { roomId: string; actor: string }): Promise<Result> {
  const room = await loadRoom(input.roomId);
  if (!room || !isOpen(room)) return fail("This game has ended or expired.");
  const seat = await mySeat(ctx, room.id); if (!seat) return fail("Join with the code first.");
  const design = await loadDesign(room.id); if (!design) return fail("This game has no world loaded.");
  const a = design.actors.find(x => x.id === input.actor);
  if (!a || !a.playable) return fail("That court can't be played.");
  if (room.phase === "over") return fail("This game has finished.");
  if (room.phase === "play") {
    if (room.locked && !seat.actor) return fail("The host has locked this game.");
    if (!room.state || !room.state.order.includes(a.id)) return fail("That court isn't in this game. Pick one that is playing.");
    const anyHuman = (await loadSeats(room.id)).some(s => s.actor && room.state!.order.includes(s.actor));
    if (seat.actor || anyHuman) return fail("The game has started, so courts are assigned. Ask the TA if you need to move.");
  }
  await db().from("seats").update({ actor: a.id }).eq("id", seat.id);
  return settle(room.id);
}
export async function leaveRoom(ctx: Ctx, input: { roomId: string }): Promise<Result> {
  await db().from("seats").delete().eq("room_id", input.roomId).eq("user_id", ctx.userId);
  const room = await loadRoom(input.roomId);
  return room && isOpen(room) ? settle(room.id) : { ok: true };
}
export async function submitVote(ctx: Ctx, input: { roomId: string; seq: number; action?: string | undefined; target?: string | undefined; why?: string | undefined; src?: string | undefined; loc?: string | undefined; quote?: string | undefined; pass?: boolean | undefined }): Promise<Result> {
  if (await tooMany("vote", ctx, 30, 2000, 1, false)) return fail("Too many votes too quickly. Wait a moment.");
  await record("vote", ctx, true);
  const room = await loadRoom(input.roomId);
  if (!room || !isOpen(room) || room.phase !== "play" || !room.state) return fail("Voting is not open.");
  const st = room.state;
  if (st.pause) return fail(PAUSED);
  if (input.seq !== st.seq) return fail("That vote was for an earlier turn.");
  const seat = await mySeat(ctx, room.id);
  const who = st.order[st.turn];
  if (!seat || seat.actor !== who) return fail("It is not your court's turn.");
  const design = await loadDesign(room.id); if (!design) return fail("This game has no world loaded.");
  let row: Record<string, unknown>;
  if (input.pass) {
    const why = String(input.why || "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (!passWhyOk(why)) return fail("A vote to pass needs one sentence on why your court waits.");
    row = { pass: true, why };
  }
  else {
    const a = design.actions.find(x => x.id === input.action);
    if (!a || !(a.who.includes("any") || a.who.includes(who))) return fail("That action isn't available to your court.");
    const why = String(input.why || "").trim();
    const target = String(input.target || "");
    const src = String(input.src || "");
    if (src && !design.sources.some(s => s.id === src)) return fail("That source isn't in this world.");
    const loc = String(input.loc || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const quote = String(input.quote || "").replace(/\s+/g, " ").trim().slice(0, QUOTE_MAX);
    /* Every reasoned vote rests on evidence: a source, where in it, and reasoning. The quote stays optional. */
    const missing = evidenceMissing(design, a, { why, src, loc, target }, who);
    if (missing.length) return fail("Your vote still needs " + missing.join("; ") + ". Every vote rests on evidence from the readings, which your TA checks in the debrief.");
    row = { action: a.id, target: a.target === "choose" ? target : "", why: why.slice(0, 400), src, loc, quote };
  }
  const { error } = await db().from("votes").insert({ room_id: room.id, seat_id: seat.id, seq: st.seq, actor: who, ...row });
  if (error) return error.code === "23505" ? fail("You already voted this turn.") : fail("Could not save your vote. Try again.");
  return settle(room.id);
}

/* ---------- calling Claude (server only; the key never reaches a browser) ---------- */
async function callClaude(key: string, prompt: string, maxTokens: number): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env["ANTHROPIC_MODEL"] || "claude-haiku-5-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!res.ok) { console.error("Anthropic error", res.status, await res.text()); return { ok: false, error: "unavailable" }; }
    const body = await res.json() as { content?: { type: string; text?: string }[] };
    return { ok: true, text: (body.content || []).filter(c => c.type === "text").map(c => c.text || "").join("").trim() };
  } catch (err) { console.error(err); return { ok: false, error: "timeout" }; }
}
async function useAiCall(roomId: string): Promise<boolean> {
  const { data } = await db().from("room_private").select("ai_calls").eq("room_id", roomId).single();
  if ((data?.ai_calls || 0) >= AI_CALLS_PER_GAME) return false;
  await db().from("room_private").update({ ai_calls: (data?.ai_calls || 0) + 1 }).eq("room_id", roomId);
  return true;
}
async function loadHistory(roomId: string): Promise<HistoryRow[]> {
  const { data } = await db().from("history").select("*").eq("room_id", roomId).neq("kind", "note").order("seq").limit(2000);
  const order = (r: HistoryRow) => r.seq * 2 + (r.kind === "event" ? 1 : 0);
  /* TA tags and notes are a teaching record, never given to the AI. */
  return ((data || []) as unknown[]).map(fromDbHistory).map(({ tags: _t, note: _n, audits: _a, ...r }) => r).sort((a, b) => order(a) - order(b));
}

/* ---------- AI-played courts (Phase 1.5) ---------- */
/* The host's screen calls this, after its pacing pause, when the court whose turn it is has no humans.
   Double-firing is impossible: the turn number must still match, and a per-room claim (seq + time) lets only
   one request work on a turn; a claim older than a minute is treated as abandoned. The AI gets one retry for
   an unusable reply; any failure falls back to a simple rule-based move so the game never stalls. */
const NPC_NOTES: Record<string, string> = {
  nokey: "No ANTHROPIC_API_KEY secret is set, so AI courts are using simplified rule-based moves.",
  cap: "This game has used its AI allowance, so AI courts are now using simplified rule-based moves.",
  unavailable: "The AI is unavailable right now, so AI courts are using simplified rule-based moves.",
  timeout: "The AI took too long to answer, so AI courts are using simplified rule-based moves.",
  invalid: "The AI's reply couldn't be used, so this move is a simplified rule-based one.",
};
export async function npcTurn(ctx: Ctx, input: { roomId: string; seq: number }): Promise<Result<{ applied: boolean; mode?: NpcMode; note?: string }>> {
  const room = await requireHost(ctx, input.roomId);
  if ("ok" in room) return room;
  const st = room.state;
  if (room.phase !== "play" || !st || st.over || st.pause || st.seq !== input.seq) return { ok: true, applied: false };
  const design = await loadDesign(room.id); if (!design) return fail("This game has no world loaded.");
  const who = st.order[st.turn]!;
  const { members } = computeTeams(design, room, await loadSeats(room.id));
  if (!room.fill_ai || (members[who] || []).length) { await settle(room.id); return { ok: true, applied: false }; }
  const { data: priv } = await db().from("room_private").select("npc_seq,npc_claim").eq("room_id", room.id).single();
  const prevSeq = Number(priv?.npc_seq || 0), prevClaim = Number(priv?.npc_claim || 0), now = Date.now();
  if (prevSeq >= input.seq && now - prevClaim < 60_000) return { ok: true, applied: false };
  const { data: got } = await db().from("room_private").update({ npc_seq: input.seq, npc_claim: now })
    .eq("room_id", room.id).eq("npc_seq", prevSeq).eq("npc_claim", prevClaim).select("room_id");
  if (!got || !got.length) return { ok: true, applied: false };
  const rows = await loadHistory(room.id);
  let move: Move | null = null, note = "";
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) note = "nokey";
  else {
    const prompt = npcPrompt(design, st, who, rows);
    for (let attempt = 0; attempt < 2 && !move; attempt++) {
      if (!(await useAiCall(room.id))) { note = "cap"; break; }
      const r = await callClaude(key, prompt, 400);
      if (!r.ok) { note = r.error; break; }
      move = parseNpcReply(design, st, who, r.text);
      if (!move && attempt === 1) note = "invalid";
    }
  }
  if (!move) move = ruleMove(design, st, who, rows);
  const res = await settle(room.id, undefined, { seq: input.seq, who, move });
  if (!res.ok) return res;
  return note ? { ok: true, applied: true, mode: move.npc || "rule", note: NPC_NOTES[note] || NPC_NOTES["unavailable"]! } : { ok: true, applied: true, mode: move.npc || "rule" };
}

/* ---------- AI reading helper (host only, capped per game, key stays on the server) ---------- */
export async function aiReading(ctx: Ctx, input: { roomId: string; logId: string; lensId: string }): Promise<Result<{ text: string }>> {
  const room = await requireHost(ctx, input.roomId);
  if ("ok" in room) return room;
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) return fail("The AI helper isn't set up (no ANTHROPIC_API_KEY secret).");
  const { data: priv } = await db().from("room_private").select("design,ai_calls").eq("room_id", room.id).single();
  if ((priv?.ai_calls || 0) >= AI_CALLS_PER_GAME) return fail("This game has used its AI allowance.");
  const d = upgradeDesign(priv.design as Design), st = room.state;
  const e = st?.log.find(x => x.id === input.logId);
  if (!e || e.kind !== "action") return fail("That move isn't in this game.");
  const A = d.actors.find(x => x.id === e.who), T = e.target ? d.actors.find(x => x.id === e.target) : undefined;
  const lens = d.actors.find(x => x.id === input.lensId) || T || A;
  const act = d.actions.find(x => x.id === e.action);
  if (!A || !lens || !act) return fail("That move isn't in this game.");
  if (!(await useAiCall(room.id))) return fail("This game has used its AI allowance.");
  const prompt = `In a classroom strategy game about East Asian diplomacy set in ${d.era.label} (${d.era.start}–${d.era.end}), ${A.name} just took the action "${act.name}"${T ? ` toward ${T.name}` : ""}${e.year ? ` around ${e.year}` : ""}. The game designer describes ${lens.name} this way: ${lens.worldview}

In under 130 words, describe how an informed official or member of ${lens.name} at that time would plausibly have interpreted this move, using that actor's own categories (ritual, rank, legitimacy, trade, face, religion, or whatever applies) rather than modern diplomatic language. Name one concept in its own terms and explain it briefly. Write in plain modern English, not pastiche, and do not invent quotations from real documents or page numbers. If the game's framing seems historically doubtful for that date, say so in one sentence. End with a line starting "Check:" naming what kind of source would confirm or complicate this view. Only name a specific course reading if it is one of these, which fit this era: ${allowedReadings(d).map(c => c.short).join("; ")}.`;
  const r = await callClaude(key, prompt, 400);
  if (!r.ok) return fail(r.error === "timeout" ? "The AI helper timed out." : "The AI helper is unavailable right now.");
  return r.text ? { ok: true, text: r.text } : fail("The AI helper returned nothing.");
}

/* ---------- class library: nickname submissions with edit keys, instructor passcode ---------- */
async function passcodeOk(ctx: Ctx, passcode: string): Promise<Fail | null> {
  const expected = process.env["INSTRUCTOR_PASSCODE"];
  if (!expected) return fail("The instructor passcode isn't set up (no INSTRUCTOR_PASSCODE secret).");
  if (await tooMany("passcode", ctx, 6, 20, 15)) return fail("Too many wrong passcodes. Wait 15 minutes.");
  const ok = (await sha256(String(passcode || ""))) === (await sha256(expected));
  await record("passcode", ctx, ok);
  return ok ? null : fail("That passcode is not right.");
}
export async function listLibrary() {
  const { data } = await db().from("designs").select("id,title,author_nick,design,version,submitted_at").eq("status", "approved").order("submitted_at", { ascending: false }).limit(200);
  return { ok: true as const, games: (data || []).map((g: { id: string; title: string; author_nick: string; design: Design }) => ({ id: g.id, title: g.title, author: g.author_nick, design: g.design })) };
}
export async function submitDesign(ctx: Ctx, input: { design?: unknown; nickname: string; id?: string | undefined; editKey?: string | undefined }): Promise<Result<{ id: string; editKey: string }>> {
  if (await tooMany("submit", ctx, 20, 200, 60, false)) return fail("Too many submissions from this device. Wait an hour.");
  await record("submit", ctx, true);
  const problem = validateDesign(input.design); if (problem) return fail(problem);
  const nickname = cleanNickname(input.nickname); if (!nickname) return fail("Enter a nickname of at least two characters.");
  const design = input.design as Design;
  if (design.sandbox) return fail("The sandbox example can't be submitted.");
  const { checks } = await import("@/game/logic");
  if (checks(design).some(c => !c.ok)) return fail("Finish every required checklist item first.");
  const clean = { ...design, submission: undefined, published: true };
  if (input.id) {
    const { data } = await db().from("designs").select("id,edit_key_hash").eq("id", input.id).maybeSingle();
    if (!data || data.edit_key_hash !== await sha256(String(input.editKey || ""))) return fail("That edit key doesn't match this submission.");
    await db().from("designs").update({ design: clean, title: design.title.slice(0, 200), author_nick: nickname, version: Date.now(), status: "pending", review_note: "", submitted_at: nowIso(), reviewed_at: null }).eq("id", input.id);
    return { ok: true, id: input.id, editKey: String(input.editKey) };
  }
  const editKey = randomString(6) + "-" + randomString(6);
  const { data, error } = await db().from("designs").insert({ design: clean, title: design.title.slice(0, 200), author_nick: nickname, edit_key_hash: await sha256(editKey), version: Date.now() }).select("id").single();
  if (error) { console.error(error); return fail("Could not submit. Try again."); }
  return { ok: true, id: data.id, editKey };
}
export async function mySubmissions(input: { items: { id: string; editKey: string }[] }) {
  const out: { id: string; status: string; note: string; feedback: { nickname: string; trap: string; body: string }[] }[] = [];
  for (const it of (input.items || []).slice(0, 30)) {
    const { data } = await db().from("designs").select("id,edit_key_hash,status,review_note").eq("id", it.id).maybeSingle();
    if (!data || data.edit_key_hash !== await sha256(String(it.editKey || ""))) continue;
    const { data: fb } = await db().from("feedback").select("nickname,trap,body").eq("design_id", it.id).order("created_at", { ascending: false }).limit(50);
    out.push({ id: data.id, status: data.status, note: data.review_note, feedback: fb || [] });
  }
  return { ok: true as const, items: out };
}
export async function withdrawDesign(input: { id: string; editKey: string }): Promise<Result> {
  const { data } = await db().from("designs").select("id,edit_key_hash").eq("id", input.id).maybeSingle();
  if (!data || data.edit_key_hash !== await sha256(String(input.editKey || ""))) return fail("That edit key doesn't match this submission.");
  await db().from("designs").delete().eq("id", input.id);
  return { ok: true };
}
export async function instructorList(ctx: Ctx, input: { passcode: string }) {
  const bad = await passcodeOk(ctx, input.passcode); if (bad) return bad;
  const { data } = await db().from("designs").select("id,title,author_nick,design,version,status,review_note,submitted_at").order("submitted_at", { ascending: false }).limit(300);
  return { ok: true as const, items: data || [] };
}
export async function instructorReview(ctx: Ctx, input: { passcode: string; id: string; approve: boolean; note: string; version: number }): Promise<Result> {
  const bad = await passcodeOk(ctx, input.passcode); if (bad) return bad;
  const note = String(input.note || "").trim().slice(0, 2000);
  if (!input.approve && note.length < 5) return fail("Write a note so the designer knows what to change.");
  const { data } = await db().from("designs").update({ status: input.approve ? "approved" : "changes", review_note: note, reviewed_at: nowIso() }).eq("id", input.id).eq("version", input.version).select("id");
  if (!data || !data.length) return fail("The designer changed this game since you opened it. Reload the queue.");
  return { ok: true };
}
export async function sendFeedback(ctx: Ctx, input: { designId: string; nickname: string; trap: string; text: string }): Promise<Result> {
  if (await tooMany("feedback", ctx, 10, 300, 60, false)) return fail("Too many notes from this device. Try later.");
  await record("feedback", ctx, true);
  const trap = String(input.trap || "").trim().slice(0, 1500), body = String(input.text || "").trim().slice(0, 1500);
  if (!trap && !body) return fail("Write at least one note first.");
  const { data } = await db().from("designs").select("id").eq("id", input.designId).eq("status", "approved").maybeSingle();
  if (!data) return fail("Notes are only open for approved games.");
  await db().from("feedback").insert({ design_id: data.id, nickname: cleanNickname(input.nickname) || "", trap, body });
  return { ok: true };
}
