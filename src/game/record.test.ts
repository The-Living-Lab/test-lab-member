import { describe, expect, it } from "vitest";
import { sampleDesign } from "./data";
import { ballotOf, historyRows, newState, resolveMove } from "./logic";
import { CSV_HEADER, NOT_GRADED, recordFileName, recordRounds, transcriptCsv, transcriptMarkdown } from "./record";
import type { Ballot, HistoryRow, Move } from "./types";

/* A short game: round 1 has a student vote with a quote and a TA tag, a dissenting vote, an AI court move and a pass. */
function game() {
  const d = sampleDesign(), st = newState(d, ["qing", "joseon", "ryukyu"]), rows: HistoryRow[] = [];
  const play = (move: Move, ballots: Ballot[], by: HistoryRow["resolvedBy"]) => { const before = { seq: st.seq, turn: st.turn }; rows.push(...historyRows(d, before, resolveMove(d, st, move, () => 0.99), ballots, by)); };
  const mei = ballotOf({ action: "x2", target: "joseon", why: "=SUM(A1) the emperor grants the title, \"as the rites require\"", src: "s1", loc: "p. 12", quote: "a short line", pass: false, name: "Mei", at: 1 });
  const ana = ballotOf({ action: "x4", target: "", why: "Trade first, then titles.", src: "s2", loc: "ch. 3", quote: "", pass: false, name: "Ana", at: 2 });
  play({ action: "x2", target: "joseon", why: [] }, [mei, ana], "vote");
  play({ action: "x1", target: "", why: [], npc: "rule" }, [{ name: "", pass: false, action: "x1", target: "", why: "Tribute keeps trade licensed.", src: "", loc: "", quote: "", npc: "rule" }], "npc");
  play({ pass: true }, [], "skip");
  rows[0]!.tags = { b0: "strong", b1: "anachronism" };
  rows.push({ seq: -1, kind: "note", round: 1, turn: 0, year: "", actor: "", target: "", action: "", failed: false, npc: false, resolvedBy: "local", ballots: [], readings: {}, event: null, at: "", note: "Good debate on investiture." });
  return { d, rows };
}

describe("TA record", () => {
  it("groups the history by round, in play order, with the event and note", () => {
    const { rows } = game(), r = recordRounds(rows);
    expect(r.length).toBe(1);
    expect(r[0]!.turns.map(t => t.row.actor)).toEqual(["qing", "joseon", "ryukyu"]);
    expect(r[0]!.note).toBe("Good debate on investiture.");
    expect(r[0]!.event).not.toBeNull();
  });
  it("Markdown: says it is not auto-graded, and has every reason, source, location, quote, tag and note", () => {
    const { d, rows } = game(), md = transcriptMarkdown(d, rows, { code: "ABC123", date: "2026-11-09" });
    expect(md).toContain(NOT_GRADED);
    expect(md).toContain("## Round 1");
    expect(md).toContain("**TA note:** Good debate on investiture.");
    expect(md).toContain("**Mei** (student)");
    expect(md).toContain("**Ana** (student)");
    expect(md).toContain("p. 12");
    expect(md).toContain("Quote: “a short line”.");
    expect(md).toContain("TA tag: Strong evidence.");
    expect(md).toContain("TA tag: Anachronism spotted.");
    expect(md).toContain("**AI court** (rule-based AI)");
    expect(md).toContain("TA skipped the turn");
    expect(md).toContain("End of round 1 event");
    expect(md).toContain("## Sources cited");
  });
  it("CSV: one row per reason plus event and note rows, quoted safely, formulas neutralised", () => {
    const { d, rows } = game(), csv = transcriptCsv(d, rows), lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    expect(lines.length).toBe(1 + 1 + 2 + 1 + 1 + 1); // header, note, 2 reasons, AI reason, skipped turn, event
    const mei = lines.find(l => l.includes(",Mei,"))!;
    expect(mei).toContain("\"'=SUM(A1) the emperor grants the title, \"\"as the rites require\"\"\"");
    expect(mei).toContain("Strong evidence");
    expect(lines.some(l => l.includes(",AI court,rule-based AI,"))).toBe(true);
    expect(lines.some(l => l.startsWith("1,") && l.includes(",note,"))).toBe(true);
    expect(lines.some(l => l.includes(",event,"))).toBe(true);
  });
  it("uses nicknames only: no seat or user ids leak into the record", () => {
    const { d, rows } = game();
    const both = transcriptMarkdown(d, rows) + transcriptCsv(d, rows);
    expect(/seat|user_?id|@/i.test(both.replace(/@media/g, ""))).toBe(false);
  });
  it("an empty game still makes a record, and file names are safe", () => {
    const d = sampleDesign();
    expect(transcriptMarkdown(d, [])).toContain("No moves have been recorded yet");
    expect(transcriptCsv(d, []).trim()).toBe(CSV_HEADER.join(","));
    const name = recordFileName({ ...d, title: "Tribute, Silver & Go-betweens!" }, "csv", { code: "AB/12", date: "2026-11-09" });
    expect(name).toBe("tribute-record-tribute-silver-go-betweens-AB12-2026-11-09.csv");
  });
  it("Phase 1: every reason has an evidence status and a provenance, and the open reasons are listed", () => {
    const { d, rows } = game();
    rows[0]!.tags = { b0: "strong", b1: "check" };
    const extra = ballotOf({ action: "x1", target: "", why: "Our king's title needs Beijing's seal.", src: "s1", loc: "p. 3", quote: "", pass: false, name: "Jun", at: 3 });
    rows.push({ ...rows[0]!, seq: 9, turn: 2, ballots: [extra], tags: {} });
    rows[1]!.audits = [{ name: "Jun", text: "The AI only counts silver; Holcombe says the title mattered more." }];
    const csv = transcriptCsv(d, rows), lines = csv.trim().split("\r\n");
    const i = CSV_HEADER.indexOf("evidence_status"), j = CSV_HEADER.indexOf("voter_type");
    expect(i).toBeGreaterThan(-1);
    const reasons = lines.slice(1).filter(l => /,(student|rule-based AI|generative AI),/.test(l));
    expect(reasons.length).toBe(5); // Mei, Ana, AI, Jun, Jun's audit
    expect(csv).toContain("Checked by the TA");
    expect(csv).toContain("TA asked for a check");
    expect(csv).toContain("Not checked");
    expect(csv).toContain("AI reasoning, not evidence");
    expect(lines.some(l => l.includes(",audit,") && l.includes("Holcombe says the title mattered more"))).toBe(true);
    expect(j).toBeGreaterThan(-1);
    const md = transcriptMarkdown(d, rows);
    expect(md).toContain("## Reasons not yet checked (1) · TA asked for a check (1)");
    expect(md).toContain("**Jun**: “Our king's title needs Beijing's seal.” (Not checked)");
    expect(md).toContain("Evidence: TA asked for a check.");
    expect(md).toContain("Audit of this AI move by **Jun** (student)");
  });
});
