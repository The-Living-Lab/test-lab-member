import { describe, expect, it } from "vitest";
import { sampleDesign } from "./data";
import { canTake, historyRows, newState, resolveMove } from "./logic";
import { AI_NO_LOC, balanceTeams, lateJoinCourt, legalActions, moveFromThinking, npcBallot, npcPrompt, parseNpcReply, ruleMove, ruleThinking } from "./npc";
import type { HistoryRow, Move } from "./types";

const COURTS = ["qing", "joseon", "tokugawa", "ryukyu", "daiviet"];

describe("AI courts: rule-based fallback", () => {
  it("one human, every other court AI: all five courts act every round, with stated reasoning", () => {
    const d = sampleDesign(), st = newState(d, COURTS), rows: HistoryRow[] = [];
    let n = 0;
    while (!st.over && n < 40) {
      const who = st.order[st.turn]!, before = { seq: st.seq, turn: st.turn };
      const move: Move = who === "joseon" ? { action: "x1", target: "", why: [{ name: "Mei", text: "Tribute renews our king's title.", src: "s1" }] } : ruleMove(d, st, who, rows);
      const made = resolveMove(d, st, move, () => 0.99);
      rows.push(...historyRows(d, before, made, who === "joseon" ? [] : [npcBallot(move)], who === "joseon" ? "vote" : "npc"));
      n++;
    }
    const moves = rows.filter(r => r.kind !== "event");
    expect(moves.length).toBe(20);
    for (const c of COURTS) expect(moves.filter(r => r.actor === c).length).toBe(4);
    const ai = moves.filter(r => r.npc);
    expect(ai.length).toBe(16);
    expect(ai.every(r => r.ballots[0]!.why.length > 20 && r.ballots[0]!.loc === AI_NO_LOC && r.ballots[0]!.npc === "rule")).toBe(true);
    expect(st.log.filter(e => e.kind !== "event").every(e => (e.who === "joseon") === !e.npc)).toBe(true);
  });
  it("answers the court that last acted toward it", () => {
    const d = sampleDesign(), st = newState(d, ["qing", "joseon", "ryukyu"]), rows: HistoryRow[] = [];
    const b = { seq: st.seq, turn: st.turn };
    rows.push(...historyRows(d, b, resolveMove(d, st, { action: "x2", target: "joseon", why: [] }), [], "vote"));
    const m = ruleMove(d, st, "joseon", rows);
    expect(!m.pass && m.npc).toBe("rule");
    expect(m.why![0]!.text).toContain("Qing Court");
    expect(!m.pass && canTake(d, st, d.actions.find(a => a.id === m.action)!, "joseon").ok).toBe(true);
  });
  it("passes, labeled, when the court can afford no move", () => {
    const d = sampleDesign(), st = newState(d, ["ryukyu"]);
    st.res["ryukyu"] = { leg: 0, silver: 0, info: 0, force: 0 };
    d.actions.forEach(a => { a.effects = [{ to: "self", res: "silver", d: -1 }]; });
    const m = ruleMove(d, st, "ryukyu");
    expect(m.pass && m.npc).toBe("rule");
  });
  it("shows its weighing: every legal move ranked with reasons, and the top one is the move it plays", () => {
    const d = sampleDesign(), st = newState(d, ["qing", "joseon", "ryukyu"]), rows: HistoryRow[] = [];
    const b = { seq: st.seq, turn: st.turn };
    rows.push(...historyRows(d, b, resolveMove(d, st, { action: "x2", target: "joseon", why: [] }), [], "vote"));
    const t = ruleThinking(d, st, "joseon", rows);
    expect(t.considered.map(c => c.id).sort()).toEqual(legalActions(d, st, "joseon").map(a => a.id).sort());
    for (let i = 1; i < t.considered.length; i++) expect(t.considered[i - 1]!.score).toBeGreaterThanOrEqual(t.considered[i]!.score);
    expect(t.considered.every(c => c.reasons.length > 0)).toBe(true);
    expect(t.choice).toBe(t.considered[0]!.id);
    expect(moveFromThinking(t)).toEqual(ruleMove(d, st, "joseon", rows));
    if (t.target) expect(t.targetWhy).toContain("Qing Court");
  });
});

describe("AI courts: strict reply checking", () => {
  const d = sampleDesign(), st = newState(d, COURTS);
  it("accepts a valid reply, even wrapped in text, and labels it", () => {
    const m = parseNpcReply(d, st, "qing", 'Here: {"action":"x2","target":"joseon","why":"Conferring the patent places Joseon\'s king within the ritual order.","src":"s1"}');
    expect(m && !m.pass && m.npc).toBe("ai");
    expect(m && !m.pass && m.why[0]).toMatchObject({ name: "AI court", src: "s1", loc: AI_NO_LOC, quote: "" });
  });
  it("rejects invalid JSON, a move the court can't make, a bad target, an invented source and empty reasoning", () => {
    const why = "A reason long enough to count as reasoning.";
    expect(parseNpcReply(d, st, "qing", "not json at all")).toBeNull();
    expect(parseNpcReply(d, st, "qing", '{"action":"x1","target":"","why":"' + why + '","src":"s1"}')).toBeNull();
    expect(parseNpcReply(d, st, "qing", '{"action":"x2","target":"qing","why":"' + why + '","src":"s1"}')).toBeNull();
    expect(parseNpcReply(d, st, "qing", '{"action":"x2","target":"atlantis","why":"' + why + '","src":"s1"}')).toBeNull();
    expect(parseNpcReply(d, st, "qing", '{"action":"x2","target":"joseon","why":"' + why + '","src":"s99"}')).toBeNull();
    expect(parseNpcReply(d, st, "qing", '{"action":"x2","target":"joseon","why":"","src":"s1"}')).toBeNull();
  });
  it("the prompt carries worldview, legal moves, source ids and what was done to the court, but no nicknames or source notes", () => {
    const s2 = newState(d, COURTS), rows: HistoryRow[] = [];
    const b = { seq: s2.seq, turn: s2.turn };
    rows.push(...historyRows(d, b, resolveMove(d, s2, { action: "x2", target: "joseon", why: [] }), [{ name: "Mei", pass: false, action: "x2", target: "joseon", why: "Investiture ranks Joseon below us.", src: "s1", loc: "p. 150", quote: "" }], "vote"));
    const p = npcPrompt(d, s2, "joseon", rows);
    expect(p).toContain(d.actors[1]!.worldview);
    expect(p).toContain('id "s1"');
    expect(p).toContain("Investiture ranks Joseon below us.");
    expect(p).toContain("As Joseon Court read it");
    expect(p.includes("Mei")).toBe(false);
    expect(p.includes(d.sources[0]!.note)).toBe(false);
    for (const a of legalActions(d, s2, "joseon")) expect(p).toContain(`id "${a.id}"`);
  });
});

describe("team assignment", () => {
  it("a late joiner goes to the human court with the fewest humans, never an AI court", () => {
    expect(lateJoinCourt(COURTS, { qing: 3, joseon: 1, tokugawa: 2 })).toBe("joseon");
    expect(lateJoinCourt(COURTS, { qing: 2, joseon: 2 }, () => 0)).toBe("qing");
    expect(lateJoinCourt(COURTS, { qing: 2, joseon: 2 }, () => 0.99)).toBe("joseon");
    expect(lateJoinCourt(COURTS, {})).toBeNull();
  });
  it("auto-balance gives each player a court and keeps teams within one of each other", () => {
    const few = balanceTeams(COURTS, [{ id: "a", actor: "qing" }, { id: "b", actor: "qing" }, { id: "c", actor: null }]);
    expect(new Set(Object.values(few)).size).toBe(3);
    expect(few["a"]).toBe("qing");
    const seats = Array.from({ length: 11 }, (_, i) => ({ id: "s" + i, actor: i < 8 ? "qing" : null }));
    const plan = balanceTeams(["qing", "joseon", "tokugawa"], seats);
    const sizes = ["qing", "joseon", "tokugawa"].map(c => Object.values(plan).filter(x => x === c).length);
    expect(Object.keys(plan).length).toBe(11);
    expect(Math.max(...sizes) - Math.min(...sizes) <= 1).toBe(true);
  });
});
