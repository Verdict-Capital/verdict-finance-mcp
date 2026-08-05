import { describe, it, expect } from "vitest";
import { getRating } from "../src/tools/get.js";
import { FakeClient, entity } from "./helpers.js";

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("get_rating", () => {
  it("returns the full rating for a known entity (happy path)", async () => {
    const c = new FakeClient();
    c.entities.protocol = [entity({ id: "p1", name: "Aave V4", slug: "aave", chains: [{ name: "ethereum" }], categories: ["Lending"] })];
    c.ratings.p1 = { letter_grade: "A", composite_score: 87 };

    const r = await getRating(c, { entity_type: "protocol", identifier: "aave" });
    const t = text(r);
    expect(t).toContain("Aave V4 — A (87/100) · protocol");
    expect(t).toContain("chains: ethereum");
    expect(t).toContain("categories: Lending");
    expect(t).toContain("products/ratings#protocol-aave");
    expect(t).toContain("Rating by Verdict —");
    expect(r.isError).toBeFalsy();
  });

  it("includes the drag line when the scorecard carries one", async () => {
    const c = new FakeClient();
    c.entities.protocol = [entity({ id: "p1", name: "Aave V4", slug: "aave", chains: [{ name: "Ethereum" }], categories: ["lending"] })];
    c.ratings.p1 = { letter_grade: "AA", composite_score: 88.2, largest_drag_hint: "chain: ethereum", has_unrated_dependencies: false };
    const r = await getRating(c, { entity_type: "protocol", identifier: "aave" });
    const t = text(r);
    expect(t).toContain("Dependency drag: chain: ethereum");
  });

  it("renders 'unrated' for an entity with no published scorecard", async () => {
    const c = new FakeClient();
    c.entities.token = [entity({ id: "t1", name: "New Token", slug: "new-token" })];
    c.ratings.t1 = null;
    const r = await getRating(c, { entity_type: "token", identifier: "new-token" });
    expect(text(r)).toContain("New Token — unrated · token");
    expect(r.isError).toBeFalsy();
  });

  it("returns a clean not-found message on 404 (not an error result)", async () => {
    const c = new FakeClient();
    c.entities.protocol = [];
    const r = await getRating(c, { entity_type: "protocol", identifier: "ghost" });
    expect(text(r)).toContain('No Verdict rating found for "ghost" (protocol).');
    expect(text(r)).toContain("Rating by Verdict —");
    expect(r.isError).toBeFalsy();
  });

  it("maps 429 to the rate-limit message (error result)", async () => {
    const c = new FakeClient();
    c.throwOn.get = "rate_limit";
    const r = await getRating(c, { entity_type: "protocol", identifier: "aave" });
    expect(text(r)).toBe("Verdict rate limit reached (120/min per IP) — try again shortly.");
    expect(r.isError).toBe(true);
  });

  it("maps a network error to a graceful message", async () => {
    const c = new FakeClient();
    c.throwOn.get = "network";
    const r = await getRating(c, { entity_type: "protocol", identifier: "aave" });
    expect(text(r)).toBe("Couldn't reach Verdict right now; try again.");
    expect(r.isError).toBe(true);
  });

  it("chain get_rating appends the QRI line when available", async () => {
    const c = new FakeClient();
    c.entities.chain = [entity({ id: "c1", name: "Ethereum", slug: "ethereum" })];
    c.ratings.c1 = { letter_grade: "A", composite_score: 80 };
    c.quantum = { available: true, chain_slug: "ethereum", qri: 25, band: 2,
      band_label: "Acknowledged", stage: 2, hybrid: "FAIL", danger: false, ci: 4 };
    const r = await getRating(c, { entity_type: "chain", identifier: "ethereum" });
    const t = text(r);
    expect(t).toContain("Quantum readiness (LayerQu): QRI 25/100 - Band 2 Acknowledged - Stage S2");
    expect(r.isError).toBeFalsy();
  });

  it("chain get_rating omits the QRI line when absent", async () => {
    const c = new FakeClient();
    c.entities.chain = [entity({ id: "c1", name: "Ethereum", slug: "ethereum" })];
    c.ratings.c1 = { letter_grade: "A", composite_score: 80 };
    c.quantum = { available: false, reason: "not assessed by source" };
    const r = await getRating(c, { entity_type: "chain", identifier: "ethereum" });
    const t = text(r);
    expect(t).not.toContain("Quantum readiness");
    expect(r.isError).toBeFalsy();
  });

  it("chain get_rating survives a quantum fetch failure (no line, no throw)", async () => {
    const c = new FakeClient();
    c.entities.chain = [entity({ id: "c1", name: "Ethereum", slug: "ethereum" })];
    c.ratings.c1 = { letter_grade: "A", composite_score: 80 };
    c.throwOn.quantum = "network";
    const r = await getRating(c, { entity_type: "chain", identifier: "ethereum" });
    const t = text(r);
    expect(t).toContain("Ethereum — A (80/100) · chain");
    expect(t).not.toContain("Quantum readiness");
    expect(r.isError).toBeFalsy();
  });

  it("non-chain get_rating does not fetch quantum", async () => {
    const c = new FakeClient();
    c.entities.protocol = [entity({ id: "p1", name: "Aave V4", slug: "aave" })];
    c.ratings.p1 = { letter_grade: "A", composite_score: 87 };
    const r = await getRating(c, { entity_type: "protocol", identifier: "aave" });
    expect(c.calls.quantum).toBe(0);
    expect(text(r)).not.toContain("Quantum readiness");
  });
});
