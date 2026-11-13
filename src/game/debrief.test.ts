import { describe, expect, it } from "vitest";
import { sampleDesign } from "./data";
import { ballotOf, historyRows, newState, resolveMove, roundSummary } from "./logic";
import { TA_TAGS, facilitatorPrompts, pauseAfter, talkItThrough } from "./debrief";
import type { HistoryRow, Move } from "./types";

const COURTS = ["qing", "joseon", "ryukyu"];
const pass: Move = { pass: true };

describe("pause and debrief", () => {
  it("pauses only when a round ends by default, and never after the last round", () => {
    const d = sampleDesign(), st = newState(d, COURTS);
    const pauses: number[] = [];
    let n = 0;
    while (!st.over && n < 30) {
      const made = resolveMove(d, st, pass);
      if (pauseAfter(st, made, "round")) { pauses.push(st.pause!.round); expect(st.pause!.kind).toBe("round"); st.pause = null; }
      n++;
    }
    const rounds = Number(d.victory.rounds);
    expect(pauses).toEqual(Array.from({ length: rounds - 1 }, (_, i) => i + 1));
    expect(st.pause ?? null).toBeNull();
  });
  it("pauses after every move when the TA chooses that", () => {
    const d = sampleDesign(), st = newState(d, COURTS);
    const made = resolveMove(d, st, pass);
    expect(pauseAfter(st, made, "move")).toBe(true);
    expect(st.pause).toMatchObject({ round: 1, kind: "move", seq: st.seq, share: false });
  });
  it("talk-it-through questions name the round and rank nobody", () => {
    const q = talkItThrough(2);
    expect(q.length).toBe(3);
    expect(q[0]).toContain("round 2");
    expect(/win|rank|most /i.test(q.join(" "))).toBe(false);
  });
  it("facilitator prompts come from the record: evidence, quote, source, trap, narrative, and AI moves", () => {
    const d = sampleDesign(), st = newState(d, COURTS);
    const before = { seq: st.seq, turn: st.turn };
    const a = d.actions.find(x => x.id === "x2")!, target = "joseon";
    const b = ballotOf({ action: a.id, target, why: "The emperor grants the title.", src: "s1", loc: "p. 12", quote: "a short line", pass: false, name: "Mei", at: 1 });
    const made = resolveMove(d, st, { action: a.id, target, why: [{ name: "Mei", text: b.why, src: "s1", loc: "p. 12", quote: "a short line" }] }, () => 0.99);
    const row = historyRows(d, before, made, [b], "vote").find(r => r.kind === "action")!;
    const p = facilitatorPrompts(d, row);
    const kinds = new Set(p.map(x => x.kind));
    expect(kinds.has("evidence")).toBe(true);
    expect(kinds.has("quote")).toBe(true);
    expect(kinds.has("source")).toBe(true);
    expect(p.find(x => x.kind === "evidence")!.text).toContain("p. 12");
    expect(kinds.has("trap")).toBe(!!a.trap);
    expect(kinds.has("narrative")).toBe(true);
    const ai: HistoryRow = { ...row, npc: true, ballots: [{ ...b, npc: "rule", src: "", loc: "", quote: "" }] };
    expect(facilitatorPrompts(d, ai).some(x => x.kind === "ai")).toBe(true);
    expect(facilitatorPrompts(d, { ...row, kind: "pass" })).toEqual([]);
    expect(TA_TAGS.map(t => t.key)).toEqual(["strong", "check", "anachronism"]);
  });
  it("round notes ride along with the round summary but are not moves", () => {
    const d = sampleDesign(), st = newState(d, COURTS), rows: HistoryRow[] = [];
    for (let i = 0; i < 3; i++) { const before = { seq: st.seq, turn: st.turn }; rows.push(...historyRows(d, before, resolveMove(d, st, pass), [], "local")); }
    rows.push({ seq: -1, kind: "note", round: 1, turn: 0, year: "", actor: "", target: "", action: "", failed: false, npc: false, resolvedBy: "local", ballots: [], readings: {}, event: null, at: "", note: "Good talk on investiture." });
    const s = roundSummary(d, rows, 1);
    expect(s.note).toBe("Good talk on investiture.");
    expect(s.turns.every(r => r.kind !== "note")).toBe(true);
    expect(s.turns.length).toBe(3);
  });
});
