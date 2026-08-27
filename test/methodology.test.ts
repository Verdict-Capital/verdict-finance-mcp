import { describe, it, expect } from "vitest";
import { FakeClient } from "./helpers.js";
import { getMethodology, getMethodologyMeta } from "../src/tools/methodology.js";

// Trimmed copy of the live GET /api/v1/methodology payload (curled 2026-08-28).
const LIVE_SHAPE = {
  name: "Verdict DeFi Ratings Framework",
  version: "1.0",
  total_questions: 306,
  entity_types: [
    { type: "protocol", questions: 85, domains: ["security", "technology"], domain_count: 7 },
    { type: "organisation", questions: 15, domains: ["legal_regulatory"], domain_count: 3 },
  ],
  grade_scale: [
    { grade: "AAA", min_score: 95, description: "Exceptional" },
    { grade: "D", min_score: 0, description: "Failed / unsafe" },
  ],
  grade_rounding: "Composite scores are rounded half-up to one decimal place before band assignment.",
  attribution: "Verdict DeFi Ratings Framework, developed in-house by Verdict.",
  methodology_url: "https://www.verdict.finance/ratings",
};

function text(r: { content: Array<{ text?: string }> }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("get_methodology", () => {
  it("renders the framework, the per-type counts and the grade scale", async () => {
    const c = new FakeClient();
    c.methodology = LIVE_SHAPE;
    const r = await getMethodology(c);
    const t = text(r);
    expect(r.isError).toBeFalsy();
    expect(t).toContain("Verdict DeFi Ratings Framework v1.0");
    expect(t).toContain("306 questions");
    expect(t).toContain("protocol - 85 questions");
    expect(t).toContain("organisation - 15 questions");
    expect(t).toContain("AAA");
    expect(t).toContain("Exceptional");
    expect(t).toContain("https://www.verdict.finance/ratings");
  });

  it("needs no API key", async () => {
    const c = new FakeClient();
    c.apiKey = false;
    c.methodology = LIVE_SHAPE;
    const r = await getMethodology(c);
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain("306 questions");
  });

  it("survives a payload missing every optional field", async () => {
    const c = new FakeClient();
    c.methodology = {};
    const r = await getMethodology(c);
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain("Verdict");
  });

  it("returns friendly text, not a throw, when the API is down", async () => {
    const c = new FakeClient();
    c.throwOn.methodology = "server";
    const r = await getMethodology(c);
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("Couldn't reach Verdict right now");
  });

  it("does not carry the house identity clause (server-level, not per-tool)", () => {
    expect(getMethodologyMeta.description).not.toContain("due-diligence house");
  });
});
