import { describe, expect, it } from "vitest";
import { POLICY } from "./data";
import { DESIGN_STEPS, GOALS, NPC_NOTE, PLAY_STEPS, RULES, WHYS, manualHtml } from "./manual";

describe("instruction manual", () => {
  it("has the four learning goals, each tied to a different course aim", () => {
    expect(GOALS.length).toBe(4);
    expect(GOALS.map(g => g.aim)).toEqual(["History", "Interpretation", "Reading", "Expression"]);
  });
  it("covers every rule the plan lists", () => {
    const terms = RULES.map(r => r.term).join(" | ");
    for (const t of ["Rounds", "Courts are teams", "A vote", "How a turn resolves", "Resources", "Risk", "Events", "Victory", "AI courts"]) expect(terms).toContain(t);
    const vote = RULES.find(r => r.term === "A vote")!.text;
    expect(vote).toContain("reading it comes from");
    expect(RULES.find(r => r.term === "AI courts")!.text).toContain("single student");
  });
  it("gives both paths: library play (no sign-in, code, nickname, late join) and designing a game", () => {
    const play = PLAY_STEPS.join(" ");
    expect(play).toContain("no sign-in");
    expect(play).toContain("six-character code");
    expect(play).toContain("nickname");
    expect(play).toContain("fewest players");
    expect(play).toContain("never on an AI court");
    const design = DESIGN_STEPS.join(" ");
    for (const t of ["design wizard", "source checks", "Submit"]) expect(design).toContain(t);
  });
  it("explains the interface: evidence, per-court readings, pauses", () => {
    const w = WHYS.map(x => x.title).join(" | ");
    expect(w).toContain("evidence");
    expect(w).toContain("reading");
    expect(w).toContain("pauses");
  });
  it("keeps the course AI policy verbatim and labels AI moves as AI content", () => {
    const html = manualHtml();
    const escPolicy = POLICY.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    expect(html).toContain(escPolicy);
    expect(NPC_NOTE).toContain("AI-generated game content");
    expect(NPC_NOTE).toContain("labeled as AI");
  });
  it("renders folded sections, opening only the ones asked for", () => {
    const shut = manualHtml(), open = manualHtml(["rules"]);
    expect((shut.match(/<details/g) || []).length).toBe(4);
    expect((shut.match(/ open>/g) || []).length).toBe(0);
    expect(open).toContain('data-sec="rules" open');
    expect(/<script/i.test(open)).toBe(false);
  });
});
