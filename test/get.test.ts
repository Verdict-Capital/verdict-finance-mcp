import { describe, it, expect } from "vitest";
import { getRating } from "../src/tools/get.js";
import { FakeClient, entity } from "./helpers.js";

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("get_rating", () => {
  it("returns the full rating for a known entity (happy path)", async () => {
    const c = new FakeClient();
    c.entities.protocol = [entity({ id: "p1", name: "Aave V3", slug: "aave-v3", chains: [{ name: "ethereum" }], categories: ["Lending"] })];
    c.ratings.p1 = { letter_grade: "A", composite_score: 87 };

    const r = await getRating(c, { entity_type: "protocol", identifier: "aave-v3" });
    const t = text(r);
    expect(t).toContain("Aave V3 — A (87/100) · protocol");
    expect(t).toContain("chains: ethereum");
    expect(t).toContain("categories: Lending");
    expect(t).toContain("ratings?search=protocol-aave-v3");
    expect(t).toContain("Rating by Verdict —");
    expect(r.isError).toBeFalsy();
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
    const r = await getRating(c, { entity_type: "protocol", identifier: "aave-v3" });
    expect(text(r)).toBe("Verdict rate limit reached (120/min per IP) — try again shortly.");
    expect(r.isError).toBe(true);
  });

  it("maps a network error to a graceful message", async () => {
    const c = new FakeClient();
    c.throwOn.get = "network";
    const r = await getRating(c, { entity_type: "protocol", identifier: "aave-v3" });
    expect(text(r)).toBe("Couldn't reach Verdict right now; try again.");
    expect(r.isError).toBe(true);
  });
});
