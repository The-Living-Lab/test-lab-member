/* Phase 6: the TA record. Turns a game's history into a transcript the TA can download, as Markdown (to read)
   or CSV (to sort and filter). Round by round: each court's move, every reason given for it, the cited source,
   location and quote, and the TA's tags and round notes. Nicknames only, as players typed them; no IDs.
   The game is not auto-graded, and the record says so. */
import type { Ballot, Design, HistoryRow, ResolvedBy, TaTag } from "./types";
import { EVIDENCE_LABEL, evidenceStatus, openReasonList } from "./logic";

export const NOT_GRADED = "This game is not auto-graded. The record is for discussion and the TA's own judgment: nothing in it is a score or a grade.";
export const TAG_TEXT: Record<TaTag, string> = { strong: "Strong evidence", check: "Needs source check", anachronism: "Anachronism spotted" };
const RESOLVED: Record<ResolvedBy, string> = {
  vote: "all votes in", reveal: "TA revealed early", skip: "TA skipped the turn", empty: "no players on this court",
  local: "pass and play", npc: "AI court",
};

export interface RecordMeta { code?: string; date?: string }
interface Turn { row: HistoryRow; order: number }
interface RoundBlock { round: number; year: string; turns: Turn[]; event: HistoryRow | null; note: string }

const nameOf = (d: Design, id: string) => (d.actors.find(a => a.id === id) || { name: id }).name;
const actionOf = (d: Design, id: string) => (d.actions.find(a => a.id === id) || { name: id }).name;
const citeOf = (d: Design, id: string) => { const s = d.sources.find(x => x.id === id); return s ? s.citation : ""; };
const yearOf = (v: unknown) => (v === "" || v == null ? "" : String(v));
const voter = (b: Ballot) => (b.npc ? "AI court" : (b.name || "").trim() || "A student");
/* Who wrote it: a student, the rule-based AI, or generative AI (Claude). Kept apart everywhere in the record. */
export const authorType = (b: Ballot) => (b.npc === "ai" ? "generative AI" : b.npc ? "rule-based AI" : "student");
const choiceOf = (d: Design, b: Ballot) => (b.pass ? "pass" : actionOf(d, b.action) + (b.target ? " → " + nameOf(d, b.target) : ""));

/* Group the history into rounds, in play order. Notes ride with their round. */
export function recordRounds(rows: HistoryRow[]): RoundBlock[] {
  const by = new Map<number, RoundBlock>();
  const get = (r: number) => { let b = by.get(r); if (!b) { b = { round: r, year: "", turns: [], event: null, note: "" }; by.set(r, b); } return b; };
  const sorted = [...rows].sort((a, b) => a.round - b.round || a.seq - b.seq || (a.kind === "event" ? 1 : 0) - (b.kind === "event" ? 1 : 0));
  for (const r of sorted) {
    const b = get(r.round);
    if (r.kind === "note") { b.note = (r.note || "").trim(); continue; }
    if (r.kind === "event") { b.event = r; continue; }
    if (!b.year && yearOf(r.year)) b.year = yearOf(r.year);
    b.turns.push({ row: r, order: b.turns.length + 1 });
  }
  return [...by.values()].sort((a, b) => a.round - b.round);
}

const mdEsc = (s: string) => s.replace(/\r?\n+/g, " ").replace(/([\\`*_[\]<>|#])/g, "\\$1").trim();

export function transcriptMarkdown(d: Design, rows: HistoryRow[], meta: RecordMeta = {}): string {
  const out: string[] = [];
  out.push(`# Game record: ${mdEsc(d.title || "Untitled world")}`, "");
  const sub = [d.era && d.era.label ? mdEsc(d.era.label) : "", meta.code ? `Game ${mdEsc(meta.code)}` : "Pass and play", meta.date ? mdEsc(meta.date) : ""].filter(Boolean).join(" · ");
  if (sub) out.push(sub, "");
  out.push(`> ${NOT_GRADED} Names are the nicknames players chose. Moves and reasons marked "AI court" were made by AI, either rule-based or generative (Claude), and are not student work.`, "");
  const blocks = recordRounds(rows);
  if (!blocks.length) out.push("_No moves have been recorded yet._", "");
  const open = openReasonList(rows);
  if (open.length) {
    const asked = open.filter(x => x.status === "asked").length;
    out.push(`## Reasons not yet checked (${open.length - asked})${asked ? ` · TA asked for a check (${asked})` : ""}`, "", "Play did not wait for these. Each is marked below with its evidence status.", "");
    open.forEach(x => out.push(`- Round ${x.round}, **${mdEsc(x.name)}**: “${mdEsc(x.why)}” (${EVIDENCE_LABEL[x.status]})`));
    out.push("");
  }
  const cited = new Set<string>();
  for (const b of blocks) {
    out.push(`## Round ${b.round}${b.year ? ` (${mdEsc(b.year)})` : ""}`, "");
    if (b.note) out.push(`**TA note:** ${mdEsc(b.note)}`, "");
    for (const { row: r, order } of b.turns) {
      const head = r.kind === "pass" ? `${mdEsc(nameOf(d, r.actor))} passed`
        : `${mdEsc(nameOf(d, r.actor))}: ${mdEsc(actionOf(d, r.action))}${r.target ? " → " + mdEsc(nameOf(d, r.target)) : ""}`;
      const flags = [r.npc ? "AI court" : "", r.failed ? "backfired" : "", RESOLVED[r.resolvedBy] && r.resolvedBy !== "npc" ? RESOLVED[r.resolvedBy] : ""].filter(Boolean);
      out.push(`### ${order}. ${head}${flags.length ? ` _(${flags.join("; ")})_` : ""}`, "");
      if (!r.ballots.length) { out.push("_No reasons recorded for this turn._", ""); continue; }
      r.ballots.forEach((bal, i) => {
        if (bal.src) cited.add(bal.src);
        const tag = r.tags && r.tags["b" + i] ? TAG_TEXT[r.tags["b" + i] as TaTag] : "";
        const who = `**${mdEsc(voter(bal))}** (${authorType(bal)})`;
        if (bal.pass && !bal.why) { out.push(`- ${who} voted to pass.${tag ? ` TA tag: ${tag}.` : ""}`); return; }
        const parts = [`- ${who} chose ${mdEsc(choiceOf(d, bal))}.`];
        if (bal.why) parts.push(`Reason: “${mdEsc(bal.why)}”`);
        const src = bal.src ? citeOf(d, bal.src) : "";
        parts.push(src ? `Source: ${mdEsc(src)}${bal.loc ? ", " + mdEsc(bal.loc) : ""}.` : (bal.loc ? `Location: ${mdEsc(bal.loc)}.` : "No source cited."));
        if (bal.quote) parts.push(`Quote: “${mdEsc(bal.quote)}”.`);
        if (tag) parts.push(`TA tag: ${tag}.`);
        if (!bal.npc) parts.push(`Evidence: ${EVIDENCE_LABEL[evidenceStatus(r, i)]}.`);
        out.push(parts.join(" "));
      });
      for (const au of r.audits || []) out.push(`- Audit of this AI move by **${mdEsc((au.name || "").trim() || "A student")}** (student): “${mdEsc(au.text)}”`);
      out.push("");
    }
    if (b.event && b.event.event) {
      const ev = b.event.event;
      out.push(`**End of round ${b.round} event${yearOf(ev.year) ? ` (${mdEsc(yearOf(ev.year))})` : ""}:** ${mdEsc(ev.title || "")}${ev.text ? ". " + mdEsc(ev.text) : ""}`, "");
    }
  }
  if (cited.size) {
    out.push("## Sources cited", "");
    for (const id of cited) { const c = citeOf(d, id); if (c) out.push(`- ${mdEsc(c)}`); }
    out.push("");
  }
  return out.join("\n");
}

/* One CSV row per reason given (a turn with no reasons still gets a row), plus a row for each event and note.
   Cells that a spreadsheet would read as a formula are prefixed with ' so student text can't run as one. */
export const CSV_HEADER = ["round", "year", "row_type", "turn", "acting_court", "move", "target_court", "outcome", "resolved_by",
  "voter", "voter_type", "voter_choice", "reason", "source", "location", "quote", "ta_tag", "ta_round_note", "evidence_status"];
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function transcriptCsv(d: Design, rows: HistoryRow[]): string {
  const lines: string[] = [CSV_HEADER.join(",")];
  const push = (vals: unknown[]) => lines.push(vals.map(cell).join(","));
  for (const b of recordRounds(rows)) {
    if (b.note) push([b.round, b.year, "note", "", "", "", "", "", "", "", "", "", "", "", "", "", "", b.note, ""]);
    for (const { row: r, order } of b.turns) {
      const move = r.kind === "pass" ? "pass" : actionOf(d, r.action);
      const outcome = r.kind === "pass" ? "passed" : r.failed ? "backfired" : "played";
      const base = [b.round, yearOf(r.year), "move", order, nameOf(d, r.actor), move, r.target ? nameOf(d, r.target) : "", outcome, RESOLVED[r.resolvedBy] || r.resolvedBy];
      if (!r.ballots.length) { push([...base, "", "", "", "", "", "", "", "", "", ""]); continue; }
      r.ballots.forEach((bal, i) => {
        const tag = r.tags && r.tags["b" + i] ? TAG_TEXT[r.tags["b" + i] as TaTag] : "";
        push([...base, voter(bal), authorType(bal), choiceOf(d, bal), bal.why || "", bal.src ? citeOf(d, bal.src) : "", bal.loc || "", bal.quote || "", tag, "", EVIDENCE_LABEL[evidenceStatus(r, i)]]);
      });
      for (const au of r.audits || []) push([b.round, yearOf(r.year), "audit", order, nameOf(d, r.actor), actionOf(d, r.action), r.target ? nameOf(d, r.target) : "", "", "", (au.name || "").trim() || "A student", "student", "", au.text, "", "", "", "", "", "Audit of an AI move, not a TA check"]);
    }
    if (b.event && b.event.event) {
      const ev = b.event.event;
      push([b.round, yearOf(ev.year), "event", "", "", ev.title || "", "", "", "", "", "", "", ev.text || "", "", "", "", "", "", ""]);
    }
  }
  return lines.join("\r\n") + "\r\n";
}

/* A safe file name: the world's title and the date, letters and digits only. */
export function recordFileName(d: Design, ext: "md" | "csv", meta: RecordMeta = {}): string {
  const slug = (d.title || "game").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "game";
  const date = (meta.date || "").replace(/[^0-9-]/g, "");
  return `tribute-record-${slug}${meta.code ? "-" + meta.code.replace(/[^A-Za-z0-9]/g, "") : ""}${date ? "-" + date : ""}.${ext}`;
}
