import { describe, it, expect } from "vitest";
import { searchRatings } from "../src/tools/search.js";
import { FakeClient, entity } from "./helpers.js";

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("search_ratings", () => {
  it("searches a single type when entity_type is given", async () => {
    const c = new FakeClient();
    c.entities.protocol = [entity({ id: "p1", name: "Aave V3", slug: "aave-v3" })];
    c.ratings.p1 = { letter_grade: "A", composite_score: 87 };

    const r = await searchRatings(c, { query: "aave", entity_type: "protocol" });
    expect(text(r)).toContain("Aave V3 — A (87/100) · protocol");
    expect(c.calls.list).toBe(1); // only the one type queried
  });

  it("queries all 7 types and merges, best-rated first, when entity_type is omitted", async () => {
    const c = new FakeClient();
    c.entities.protocol = [entity({ id: "p1", name: "Aave Protocol", slug: "aave-v3" })];
    c.entities.token = [entity({ id: "t1", name: "Aave Token", slug: "aave" })];
    c.ratings.p1 = { letter_grade: "B", composite_score: 70 };
    c.ratings.t1 = { letter_grade: "A", composite_score: 95 };

    const r = await searchRatings(c, { query: "aave" });
    const t = text(r);
    expect(c.calls.list).toBe(7); // all 7 types queried
    expect(t).toContain("Aave Protocol");
    expect(t).toContain("Aave Token");
    // higher composite (token, 95) ranks above protocol (70)
    expect(t.indexOf("Aave Token")).toBeLessThan(t.indexOf("Aave Protocol"));
  });

  it("returns a friendly empty message when nothing matches", async () => {
    const c = new FakeClient();
    const r = await searchRatings(c, { query: "zzz-nonexistent" });
    expect(text(r)).toContain('No Verdict ratings found for "zzz-nonexistent".');
    expect(r.isError).toBeFalsy();
  });

  it("maps 429 to the rate-limit message for a single-type search", async () => {
    const c = new FakeClient();
    c.throwOn.list = "rate_limit";
    const r = await searchRatings(c, { query: "aave", entity_type: "protocol" });
    expect(text(r)).toContain("Verdict rate limit reached");
    expect(r.isError).toBe(true);
  });

  it("errors when every type fails in an all-7 search", async () => {
    const c = new FakeClient();
    c.throwOn.list = "network";
    const r = await searchRatings(c, { query: "aave" });
    expect(text(r)).toBe("Couldn't reach Verdict right now; try again.");
    expect(r.isError).toBe(true);
  });

  it("survives one flaky scorecard by rendering that item unrated", async () => {
    const c = new FakeClient();
    c.entities.protocol = [
      entity({ id: "p1", name: "Aave V3", slug: "aave-v3" }),
      entity({ id: "p2", name: "Aave V2", slug: "aave-v2" }),
    ];
    c.ratings.p1 = { letter_grade: "A", composite_score: 90 };
    // p2 has no rating entry -> getLatestRating returns null -> unrated
    const r = await searchRatings(c, { query: "aave", entity_type: "protocol" });
    const t = text(r);
    expect(t).toContain("Aave V3 — A (90/100)");
    expect(t).toContain("Aave V2 — unrated");
  });
});
