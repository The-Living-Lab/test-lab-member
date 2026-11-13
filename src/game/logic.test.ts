import { describe, expect, it } from "vitest";
import { srcFromCourse, COURSE_SOURCES, sampleDesign } from "./data";
import { openingOf, startState, CLAIMS, claimLabel, evidenceStatus, openReasons, openReasonList, auditOk, cleanAudit, GENRE_LABEL, countsAsPrimary, passWhyOk, ballotOf, canTake, evidenceMissing, checks, chronology, cleanNickname, eventForRound, filterHistory, historyRows, missingReadings, newState, readingOf, resolveMove, roundSummary, tallyVotes, upgradeDesign, validateDesign } from "./logic";
import type { Design, HistoryRow, Source } from "./types";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe("course data", () => {
  it("keeps the syllabus asterisk apart from the kind of evidence: Toby is starred but is modern scholarship", () => {
    const toby = COURSE_SOURCES.find(c => c.key === "toby")!;
    expect(toby.starred).toBe(true);
    expect(toby.genre).toBe("scholarship");
    expect(countsAsPrimary(srcFromCourse("toby", "t"))).toBe(false);
    expect(countsAsPrimary(srcFromCourse("admonition", "a"))).toBe(true);
    expect(countsAsPrimary(srcFromCourse("lensen", "l"))).toBe(true);
    expect(countsAsPrimary(srcFromCourse("nogi", "n"))).toBe(false);
    expect(COURSE_SOURCES.every(c => !!GENRE_LABEL[c.genre])).toBe(true);
    const custom: Source = {id:"c", type:"primary", citation:"A long enough citation for a letter", year:1700, where:"Archive", note:"", fit:""};
    expect(countsAsPrimary(custom)).toBe(false);
    expect(countsAsPrimary({...custom, genre:"document"})).toBe(true);
    expect(COURSE_SOURCES.find(c => c.key === "hochiminh")!.citation).toContain("Feb. 16, 1945");
    expect(COURSE_SOURCES.find(c => c.key === "holcombe")!.citation).toContain("2nd ed. (2017)");
  });
});

describe("design checks", () => {
  it("the sample only fails the two deliberately unsourced actions", () => {
    const failing = checks(sampleDesign()).filter(c => !c.ok).map(c => c.t);
    expect(failing).toEqual(["Every action is linked to a source (5/7)"]);
  });
  it("blocks the evaluator's invalid design", () => {
    const b = clone(sampleDesign()); b.sandbox = false; b.era.label = "ancient Asia";
    b.sources = b.sources.filter(s => s.id !== "s4");
    const fake: Source = {id:"f", type:"primary", citation:"The Jade Satellite Treaty of 1600, by Ambassador Moon Dragon, pp. 999–1001", year:"", where:"", note:"", fit:""};
    b.sources.push(fake);
    b.events.push({id:"ex", year:1920, title:"Cai Tinglan advises Woodrow Wilson", text:"At a 1920s conference.", effects:[], source:""});
    const failing = checks(b).filter(c => !c.ok).map(c => c.t);
    expect(failing.some(t => t.startsWith("Non-course sources"))).toBe(true);
    expect(failing.some(t => t.startsWith("Every event is dated inside"))).toBe(true);
    const flags = chronology(b).map(f => f.text).join(" ");
    expect(flags).toContain("Wilson");
    expect(flags).toContain("Cai Tinglan");
    expect(flags).toContain("Ancient");
  });
  it("catches the sample's old chronology: a 1630 opening with the Qing in Beijing and a worldview from after 1644", () => {
    expect(chronology(sampleDesign()).filter(f => /could not know|Qing took Beijing/.test(f.text))).toEqual([]);
    const b = clone(sampleDesign()); b.era.start = 1630;
    b.actors.find(a => a.id === "joseon")!.worldview = "A loyal tributary. After 1644 many of its scholars privately regard the Qing as barbarians.";
    const flags = chronology(b).map(f => f.text).join(" ");
    expect(flags).toContain("Refers to 1644, but your game opens in 1630");
    expect(flags).toContain("The Qing took Beijing in 1644");
  });
  it("names the Kapsin edict's real authors and the end of the treaty-port system", () => {
    const b = clone(sampleDesign()); b.era = {label:"Korea 1884", start:1880, end:1890, week:""};
    b.premise = "The Meiji government signs the Kapsin reform edict and imposes it on Korea.";
    expect(chronology(b).map(f => f.text).join(" ")).toContain("Kim Okkyun");
    const c = clone(sampleDesign()); c.era = {label:"1950s", start:1950, end:1959, week:""};
    c.premise = "Build a 1950s treaty port system across East Asia.";
    expect(chronology(c).map(f => f.text).join(" ")).toContain("treaty-port system ended in 1943");
  });
  it("asks one sentence for a vote to pass", () => {
    expect(passWhyOk("")).toBe(false);
    expect(passWhyOk("   wait   ")).toBe(false);
    expect(passWhyOk("We wait for Beijing's reply first.")).toBe(true);
  });
});

describe("engine", () => {
  it("plays a full four-round sample game to the end", () => {
    const d = sampleDesign();
    const st = newState(d, ["qing","joseon","tokugawa","ryukyu","daiviet"]);
    let n = 0;
    while (!st.over && n < 100) {
      const who = st.order[st.turn]!;
      const a = d.actions.find(x => { const c = canTake(d, st, x, who); return c.ok && !c.blocked; });
      resolveMove(d, st, a ? {action:a.id, target:"voc", why:[{name:"t", text:"reason", src:""}]} : {pass:true}, () => 0.99);
      n++;
    }
    expect(st.over).toBe(true);
    expect(n).toBe(20);
    expect(st.log.filter(e => e.kind === "event").length).toBe(4);
  });
  it("picks one event per round inside that round's years", () => {
    const d = sampleDesign();
    expect([1,2,3,4].map(r => eventForRound(d, r)?.year)).toEqual([1684, 1715, 1757, 1793]);
  });
  it("tallies team votes by plurality, earliest vote breaking ties", () => {
    const m = tallyVotes([
      {action:"x1", target:"", why:"a", src:"", pass:false, name:"A", at:3},
      {action:"x2", target:"joseon", why:"b", src:"", pass:false, name:"B", at:1},
      {action:"x2", target:"ryukyu", why:"", src:"", pass:false, name:"C", at:2},
      {action:"x1", target:"", why:"", src:"", pass:false, name:"D", at:4}]);
    expect(m && !m.pass && m.action).toBe("x2");
    expect(m?.votes).toEqual({total:4, chosen:2});
  });
});

describe("untrusted input", () => {
  it("accepts the sample and rejects junk", () => {
    expect(validateDesign(sampleDesign())).toBeNull();
    expect(validateDesign({})).not.toBeNull();
    const big = clone(sampleDesign()) as Design; big.premise = "x".repeat(5000);
    expect(validateDesign(big)).not.toBeNull();
  });
  it("cleans nicknames", () => {
    expect(cleanNickname("  Mei  <b>  ")).toBe("Mei b");
    expect(cleanNickname("a")).toBeNull();
    expect(cleanNickname("x".repeat(40))!.length).toBe(24);
  });
});

describe("per-court readings", () => {
  it("the sample has a reading for every court on every action", () => {
    const d = sampleDesign();
    for (const a of d.actions) expect(missingReadings(d, a)).toEqual([]);
  });
  it("a blank reading falls back to the designer's own-move or other-side reading", () => {
    const d = clone(sampleDesign()); const a = d.actions[0]!; a.readings = {qing:"", joseon:""};
    expect(readingOf(a, "joseon", "joseon")).toBe(a.readingSelf);
    expect(readingOf(a, "qing", "joseon")).toBe(a.readingOther);
    expect(readingOf(d.actions[1]!, "ryukyu", "qing")).toContain("Satsuma");
  });
  it("a missing per-court reading shows in the checklist", () => {
    const d = clone(sampleDesign()); delete d.actions[2]!.readings!["voc"];
    expect(checks(d).find(c => c.t.startsWith("Every action has a reading written for every court"))!.ok).toBe(false);
  });
  it("old designs without readings or look-for prompts still load", () => {
    const old = clone(sampleDesign()) as Design;
    old.actions.forEach(a => { delete a.readings; }); old.sources.forEach(s => { delete s.lookFor; });
    const up = upgradeDesign(old);
    expect(up.actions.every(a => a.readings && typeof a.readings === "object")).toBe(true);
    expect(up.sources.every(s => s.lookFor === "")).toBe(true);
    expect(validateDesign(up)).toBeNull();
    const st = newState(up, ["qing","joseon"]);
    resolveMove(up, st, {action:"x2", target:"joseon", why:[]});
    expect(st.log[0]!.kind).toBe("action");
  });
});

describe("history", () => {
  it("records every move, pass and event of a whole game, with each court's reading and every ballot", () => {
    const d = sampleDesign();
    const st = newState(d, ["qing","joseon","tokugawa"]);
    const rows: HistoryRow[] = [];
    let n = 0;
    while (!st.over && n < 50) {
      const who = st.order[st.turn]!, before = {seq:st.seq, turn:st.turn};
      const a = d.actions.find(x => { const c = canTake(d, st, x, who); return c.ok && !c.blocked && x.target !== "none"; });
      const ballots = a ? [ballotOf({action:a.id, target:"ryukyu", why:"A reason in the court's own terms.", src:"s1", loc:"p. 140", quote:"", pass:false, name:"Mei", at:1})] : [];
      const made = resolveMove(d, st, a ? {action:a.id, target:"ryukyu", why:[]} : {pass:true}, () => 0.99);
      rows.push(...historyRows(d, before, made, ballots, a ? "vote" : "empty"));
      n++;
    }
    expect(rows.filter(r => r.kind !== "event").length).toBe(12);
    expect(rows.filter(r => r.kind === "event").map(r => r.year)).toEqual([1684, 1715, 1757, 1793]);
    const first = rows[0]!;
    expect(first.kind).toBe("action");
    expect(Object.keys(first.readings).sort()).toEqual(d.actors.map(a => a.id).sort());
    expect(first.ballots[0]).toMatchObject({name:"Mei", src:"s1", loc:"p. 140"});
    expect(first.npc).toBe(false);
    expect(filterHistory(rows, {round:2}).every(r => r.round === 2)).toBe(true);
    expect(filterHistory(rows, {actor:"qing"}).every(r => r.actor === "qing")).toBe(true);
    const toQing = filterHistory(rows, {target:"qing"});
    expect(toQing.length).toBe(4);
    expect(toQing.every(r => r.target === "qing" && r.actor === "joseon")).toBe(true);
    const r3 = roundSummary(d, rows, 3);
    expect(r3.turns.length).toBe(3);
    expect(r3.event!.event!.year).toBe(1757);
    expect(r3.traps.length).toBe(4);
  });
  it("the tally keeps each winning voter's evidence location and quote", () => {
    const m = tallyVotes([{action:"x1", target:"", why:"Tribute renews the king's title.", src:"s1", loc:"ch. 6", quote:"short quote", pass:false, name:"A", at:1}]);
    expect(m && !m.pass && m.why[0]).toMatchObject({loc:"ch. 6", quote:"short quote"});
  });
});

describe("required evidence (Decision B)", () => {
  const d = sampleDesign(), x2 = d.actions.find(a => a.id === "x2")!;
  it("a vote needs a source, a location in it, reasoning and (for chosen targets) a target; a quote is optional", () => {
    expect(evidenceMissing(d, x2, { why: "Investiture ranks Joseon within our order.", src: "s1", loc: "p. 150", target: "joseon" }, "qing")).toEqual([]);
    const none = evidenceMissing(d, x2, {}, "qing");
    expect(none.length).toBe(4);
    expect(none.join(" ")).toContain("source");
    expect(none.join(" ")).toContain("where in that source");
    expect(evidenceMissing(d, x2, { why: "Investiture ranks Joseon within our order.", src: "s1", loc: "", target: "joseon" }, "qing")).toEqual(["where in that source your evidence is (page, chapter or section)"]);
    expect(evidenceMissing(d, x2, { why: "Investiture ranks Joseon within our order.", src: "s99", loc: "p. 2", target: "joseon" }, "qing")).toEqual(["a source from this world's readings"]);
  });
  it("a rough draft with no sources only needs reasoning", () => {
    const bare = clone(sampleDesign()); bare.sources = [];
    expect(evidenceMissing(bare, bare.actions[0]!, { why: "Tribute renews our king's title." }, "joseon")).toEqual([]);
  });
});

describe("Phase 1: claims, evidence status and audits", () => {
  it("labels claims and refuses unknown kinds", () => {
    expect(CLAIMS).toEqual(["documented", "inference", "assumption"]);
    expect(claimLabel("inference")).toBe("Historical inference");
    expect(claimLabel("toString")).toBe("");
    expect(claimLabel(undefined)).toBe("");
  });
  it("the sample marks every action, and a draft must mark its claims", () => {
    expect(sampleDesign().actions.every(a => a.claimRationale && a.claimReadings)).toBe(true);
    const d = clone(sampleDesign()); delete d.actions[0]!.claimReadings;
    expect(checks(d).find(c => c.t.startsWith("Every action says what kind of claim"))!.ok).toBe(false);
  });
  it("gives each reason a status, and lists only open student reasons on played moves", () => {
    const b = (name: string, npc?: "rule") => ({ name, pass: false, action: "x1", target: "", why: "A reason of some length.", src: "s1", loc: "p. 1", quote: "", ...(npc ? { npc } : {}) });
    const row = (seq: number, kind: HistoryRow["kind"], ballots: any[], tags?: Record<string, string>) => ({ seq, kind, round: 1, turn: 0, year: "", actor: "qing", target: "", action: "x1", failed: false, npc: false, resolvedBy: "vote", ballots, readings: {}, event: null, at: "", tags }) as HistoryRow;
    const rows = [row(1, "action", [b("Mei"), b("Ana"), b("", "rule")], { b1: "check" }), row(2, "action", [b("Jun")], { b0: "strong" }), row(3, "pass", [b("Li")])];
    expect(evidenceStatus(rows[0]!, 0)).toBe("unchecked");
    expect(evidenceStatus(rows[0]!, 1)).toBe("asked");
    expect(evidenceStatus(rows[0]!, 2)).toBe("ai");
    expect(evidenceStatus(rows[1]!, 0)).toBe("checked");
    expect(openReasons(rows)).toEqual({ unchecked: 1, asked: 1 });
    expect(openReasonList(rows).map(x => x.name)).toEqual(["Mei", "Ana"]);
  });
  it("an audit needs a real sentence and is cleaned", () => {
    expect(auditOk("too short")).toBe(false);
    expect(auditOk("It rewards silver; Toby says prestige mattered.")).toBe(true);
    expect(cleanAudit("  a \n b  ")).toBe("a b");
    expect(cleanAudit("x".repeat(900)).length).toBe(600);
  });
});

describe("Opening scene", () => {
  it("the sample opens in 1650 with a sourced scene, and the game starts paused on it", () => {
    const d = sampleDesign(), o = openingOf(d)!;
    expect(o.year).toBe(1650);
    expect(o.title).toBe("A new dynasty in Beijing");
    expect(checks(d).find(c => c.t.startsWith("Opening scene"))!.ok).toBe(true);
    expect(chronology(d).filter(f => f.where === "Opening scene")).toEqual([]);
    const st = startState(d, ["qing", "joseon"]);
    expect(st.pause).toEqual({ round: 0, kind: "opening", seq: 1, share: true });
    expect(st.round).toBe(1);
    expect(newState(d, ["qing"]).pause).toBeUndefined();
  });
  it("a draft needs an opening, dated no later than the game's first year", () => {
    const d = clone(sampleDesign()); d.opening = { year: "", title: "", text: "", ask: "", source: "" };
    expect(checks(d).find(c => c.t.startsWith("Opening scene"))!.ok).toBe(false);
    expect(openingOf(d)).toBeNull();
    expect(startState(d, ["qing"]).pause).toBeUndefined();
    d.opening = { year: 1700, title: "Later news", text: "Something happens. Everyone reacts to it.", source: "s1" };
    expect(checks(d).find(c => c.t.startsWith("Opening scene"))!.ok).toBe(false);
    expect(chronology(d).some(f => f.where === "Opening scene" && /after your game opens in 1650/.test(f.text))).toBe(true);
  });
});
