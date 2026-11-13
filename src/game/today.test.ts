import { describe, expect, it } from "vitest";
import { sampleDesign } from "./data";
import { ballotOf, checks, openingOf, startState, eventForRound, historyRows, newState, resolveMove, validateDesign, yearFor } from "./logic";
import { npcPrompt } from "./npc";
import { citableSources, holderOf, personaForPrompt, realVsChosen, roundSourceIds, seatChanges, seatLabel } from "./rounds";
import { todayDesign } from "./today";
import type { HistoryRow } from "./types";

const d = todayDesign();
const yearOfSrc = (id: string) => Number(d.sources.find(s => s.id === id)!.year);

describe("contemporary demo design", () => {
  it("is a valid sandbox design with four rounds in order", () => {
    expect(validateDesign(d)).toBeNull();
    expect(d.sandbox).toBe(true);
    expect(d.rounds!.map(r => r.year)).toEqual([2000, 2006, 2018, 2026]);
    expect([1, 2, 3, 4].map(r => yearFor(d, r))).toEqual([2000, 2006, 2018, 2026]);
  });
  it("has the six seats, each held by a named person every round", () => {
    expect(d.actors.map(a => a.id)).toEqual(["cn", "jp", "kr", "kp", "tw", "us"]);
    for (const r of d.rounds!) for (const a of d.actors) {
      const h = r.holders[a.id]; expect(h && h.name && h.persona && h.did && h.sources.length).toBeTruthy();
    }
    expect(seatLabel(d, 1, "cn")).toBe("China's leader · Jiang Zemin");
    expect(holderOf(d, 4, "jp")!.name).toMatch(/Takaichi/);
  });
  it("every reference resolves and every source has a link", () => {
    const ids = new Set(d.sources.map(s => s.id));
    for (const r of d.rounds!) {
      for (const id of r.sceneSources) expect(ids.has(id)).toBe(true);
      for (const h of Object.values(r.holders)) for (const id of h!.sources) expect(ids.has(id)).toBe(true);
    }
    for (const e of d.events) for (const id of e.sources || []) expect(ids.has(id)).toBe(true);
    for (const s of d.sources) expect(s.url).toMatch(/^https:\/\//);
  });
  it("has no hindsight: personas and scenes cite nothing after their round's year", () => {
    d.rounds!.forEach(r => {
      for (const id of r.sceneSources) expect(yearOfSrc(id)).toBeLessThanOrEqual(r.year);
      for (const h of Object.values(r.holders)) for (const id of h!.sources) expect(yearOfSrc(id)).toBeLessThanOrEqual(r.year);
    });
    [1, 2, 3, 4].forEach(r => expect(citableSources(d, r).every(s => Number(s.year) <= d.rounds![r - 1]!.year)).toBe(true));
  });
  it("labels state media and blog posts, and pairs every state-media source with independent reporting", () => {
    expect(d.sources.some(s => s.state)).toBe(true);
    expect(d.sources.filter(s => s.blog).every(s => s.year === 2026)).toBe(true);
    [1, 2, 3, 4].forEach(r => {
      const ev = eventForRound(d, r), ids = roundSourceIds(d, r, ev ? ev.sources || [] : []);
      const groups = [ids.scene, ids.event, ...Object.values(ids.seats)];
      for (const g of groups) if (g.some(id => d.sources.find(s => s.id === id)!.state)) expect(g.some(id => !d.sources.find(s => s.id === id)!.state)).toBe(true);
    });
  });
  it("explains seat changes and is labeled a simulation", () => {
    expect(seatChanges(d, 2).map(c => c.actor)).toContain("cn");
    expect(d.notice).toMatch(/simulation/i);
    expect(d.howto!.length).toBeGreaterThan(2);
    expect(d.outro).toBeTruthy();
  });
});

describe("rounds helpers", () => {
  it("give historical games nothing new", () => {
    const s = sampleDesign();
    expect(seatLabel(s, 1, s.actors[0]!.id)).toBe(s.actors[0]!.name);
    expect(citableSources(s, 1)).toEqual(s.sources);
    expect(personaForPrompt(s, 1, s.actors[0]!.id)).toBe("");
    expect(realVsChosen(s, 1, [])).toEqual([]);
  });
  it("compare the game's moves with what really happened", () => {
    const st = newState(d, ["cn", "jp", "kr", "kp", "tw", "us"]), rows: HistoryRow[] = [];
    const before = { seq: st.seq, turn: st.turn };
    rows.push(...historyRows(d, before, resolveMove(d, st, { pass: true } as never, () => 0.99), [ballotOf({ action: "", target: "", why: "", src: "", loc: "", quote: "", pass: true, name: "Ana", at: 1 })], "local"));
    const list = realVsChosen(d, 1, rows);
    expect(list.length).toBe(6);
    expect(list[0]!.chose).toBe("passed");
    expect(list[0]!.did).toBe(holderOf(d, 1, "cn")!.did);
  });
  it("tell the AI who holds the seat and forbid later knowledge", () => {
    const p = personaForPrompt(d, 3, "kp");
    expect(p).toMatch(/Kim Jong Un/);
    expect(p).toMatch(/only what Kim Jong Un could have known by 2018/);
    const st = newState(d, ["cn", "jp", "kr", "kp", "tw", "us"]);
    expect(npcPrompt(d, st, st.order[0]!, [])).toMatch(/Jiang Zemin/);
  });
});

describe("The demo's opening", () => {
  it("uses round 1's scene, passes the opening check, and starts paused", () => {
    const d = todayDesign(), o = openingOf(d)!;
    expect(o.text).toBe(d.rounds![0]!.scene);
    expect(checks(d).find(c => c.t.startsWith("Opening scene"))!.ok).toBe(true);
    expect(startState(d, ["cn", "jp"]).pause!.kind).toBe("opening");
  });
});
