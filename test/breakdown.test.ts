import { describe, it, expect } from "vitest";
import { FakeClient } from "./helpers.js";
import {
  getRatingBreakdown,
  getRatingBreakdownMeta,
  KEYLESS_ANSWER,
} from "../src/tools/breakdown.js";

// Shape of GET /api/v1/{type}s/{slug}/domains (v0.2 tier_gated_serializer
// domains_payload). Domain scores are 0-1 fractions; composite is 0-100.
const PAYLOAD = {
  entity: { slug: "aave-v4", name: "Aave V4" },
  composite_score: 78.4,
  grade: "BBB",
  letter_grade: "BBB",
  intrinsic_composite_score: 81.2,
  intrinsic_letter_grade: "A",
  largest_drag_hint: "largest drag: oracle",
  has_unrated_dependencies: true,
  domain_scores: { security: 0.8125, technology: 0.6667 },
  last_rated_at: "2026-08-01T00:00:00+00:00",
};

function text(r: { content: Array<{ text?: string }> }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("get_rating_breakdown without a key", () => {
  it("answers, never errors, and points at VERDICT_API_KEY and pricing", async () => {
    const c = new FakeClient();
    c.apiKey = false;
    const r = await getRatingBreakdown(c, { entity_type: "protocol", slug: "aave-v4" });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toBe(KEYLESS_ANSWER);
    expect(KEYLESS_ANSWER).toContain("VERDICT_API_KEY");
    expect(KEYLESS_ANSWER).toContain("https://www.verdict.finance/pricing");
  });

  it("does not call the tier-gated route at all", async () => {
    const c = new FakeClient();
    c.apiKey = false;
    await getRatingBreakdown(c, { entity_type: "chain", slug: "ethereum" });
    expect(c.calls.domains).toBe(0);
  });
});

describe("get_rating_breakdown with a key", () => {
  it("renders the headline pair, every domain score and the provenance lines", async () => {
    const c = new FakeClient();
    c.apiKey = true;
    c.domains = PAYLOAD;
    const r = await getRatingBreakdown(c, { entity_type: "protocol", slug: "aave-v4" });
    const t = text(r);
    expect(r.isError).toBeFalsy();
    expect(t).toContain("Aave V4");
    expect(t).toContain("BBB (78/100)");
    expect(t).toContain("security - 0.8125");
    expect(t).toContain("technology - 0.6667");
    expect(t).toContain("largest drag: oracle");
    expect(t).toContain("not yet rated");
    expect(t).toContain("2026-08-01");
    expect(t).toContain("Rating by Verdict");
  });

  it("passes the entity type and slug straight through to the route", async () => {
    const c = new FakeClient();
    c.apiKey = true;
    c.domains = PAYLOAD;
    await getRatingBreakdown(c, { entity_type: "bridge", slug: "ccip" });
    expect(c.lastDomainsArgs).toEqual({ type: "bridge", slug: "ccip" });
  });

  it("says so plainly when the entity has no published scorecard", async () => {
    const c = new FakeClient();
    c.apiKey = true;
    c.domains = {
      entity: { slug: "new-thing", name: "New Thing" },
      composite_score: null,
      grade: null,
      domain_scores: {},
    };
    const r = await getRatingBreakdown(c, { entity_type: "vault", slug: "new-thing" });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain("no published rating");
  });

  it("renders a 404 as a plain not-found answer", async () => {
    const c = new FakeClient();
    c.apiKey = true;
    c.throwOn.domains = "not_found";
    const r = await getRatingBreakdown(c, { entity_type: "token", slug: "ghost" });
    expect(text(r)).toContain("No Verdict rating found");
    expect(text(r)).toContain("ghost");
  });

  it("explains a rejected key without echoing it", async () => {
    const c = new FakeClient();
    c.apiKey = true;
    c.throwOn.domains = "unauthorized";
    const r = await getRatingBreakdown(c, { entity_type: "protocol", slug: "aave-v4" });
    const t = text(r);
    expect(r.isError).toBe(true);
    expect(t).toContain("VERDICT_API_KEY");
    expect(t).toContain("https://www.verdict.finance/pricing");
  });
});

describe("get_rating_breakdown description", () => {
  it("names the key requirement and stays tier-neutral about the rest", () => {
    expect(getRatingBreakdownMeta.description).toContain("VERDICT_API_KEY");
    expect(getRatingBreakdownMeta.description).not.toContain("due-diligence house");
  });
});
