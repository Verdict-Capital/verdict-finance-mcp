// Optional live smoke test against the REAL Verdict API. Off by default (it
// makes network calls + depends on live data). Enable with:
//   VERDICT_LIVE_SMOKE=1 npx vitest run test/live.smoke.test.ts
// CI leaves it skipped.

import { describe, it, expect } from "vitest";
import { HttpVerdictClient } from "../src/client.js";
import { getRating } from "../src/tools/get.js";
import { listRatings } from "../src/tools/list.js";
import { searchRatings } from "../src/tools/search.js";
import { quantumReadiness } from "../src/tools/quantum.js";
import { getRecentIncidents } from "../src/tools/incidents.js";
import { getMethodology } from "../src/tools/methodology.js";
import { getRatingBreakdown, KEYLESS_ANSWER } from "../src/tools/breakdown.js";

const run = process.env.VERDICT_LIVE_SMOKE === "1" ? describe : describe.skip;
// get_rating_breakdown fronts a tier-gated route, so a live read of it needs a
// key. Without one the suite still runs the keyless branch (which never calls
// the API) and skips the keyed read rather than asserting on a 401.
const keyed = process.env.VERDICT_API_KEY ? it : it.skip;

run("live smoke (real api)", () => {
  const client = new HttpVerdictClient();

  it("lists protocols with grades", async () => {
    const r = await listRatings(client, { entity_type: "protocol", limit: 5 });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("Rating by Verdict —");
  }, 20_000);

  it("searches across all 7 types", async () => {
    const r = await searchRatings(client, { query: "a" });
    expect(r.isError).toBeFalsy();
  }, 30_000);

  const triples: Array<["chain" | "oracle" | "protocol", string]> = [
    ["chain", "ethereum"],
    ["oracle", "chainlink"],
    ["protocol", "aave-v4"],
  ];
  for (const [entity_type, identifier] of triples) {
    it(`get_rating(${entity_type}, ${identifier}) returns a rating`, async () => {
      const r = await getRating(client, { entity_type, identifier });
      const text = r.content.map((c) => c.text ?? "").join("\n");
      expect(r.isError).toBeFalsy();
      expect(text).toContain("Rating by Verdict —");
    }, 20_000);
  }

  it("get_recent_incidents returns the live confirmed feed", async () => {
    const r = await getRecentIncidents(client, { limit: 20 });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("confirmed hack incidents, newest first");
    expect(text).toContain("re-rating is always a human decision");
  }, 20_000);

  it("get_recent_incidents accepts a since offset without a 422", async () => {
    // The "+" trap: only encoding keeps this from reaching the API as a space.
    const r = await getRecentIncidents(client, { since: "2026-01-01T00:00:00+00:00" });
    expect(r.isError).toBeFalsy();
  }, 20_000);

  it("get_recent_incidents accepts min_status=corroborated", async () => {
    // Exercises the tiered request shape end to end against the live API. It
    // does NOT prove the tiered backend is deployed: an older build ignores an
    // unknown query param and would pass this too. The deploy prover is the
    // min_status=garbage 422 probe, which lives in the planner's verification
    // rather than in this suite.
    const r = await getRecentIncidents(client, {
      min_status: "corroborated", limit: 5,
    });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("hack incidents");
  }, 20_000);

  it("get_methodology returns the live published framework", async () => {
    const r = await getMethodology(client);
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("Verdict DeFi Ratings Framework");
    // The seven entity types and the grade scale are the contract this tool
    // exists to serve; a shape change upstream must fail here, not silently.
    for (const t of [
      "protocol", "chain", "token", "oracle", "vault", "organisation", "bridge",
    ]) {
      expect(text).toContain(`${t} - `);
    }
    expect(text).toContain("AAA");
    expect(text).toContain("Grade scale");
  }, 20_000);

  it("get_rating_breakdown answers keylessly instead of erroring", async () => {
    // Deliberately keyless regardless of the environment: this is the branch a
    // no-key user hits, and it must never reach the API or raise.
    const keyless = new HttpVerdictClient({ apiKey: undefined });
    if (keyless.hasApiKey()) return; // env has a key; the keyed case covers it
    const r = await getRatingBreakdown(keyless, {
      entity_type: "protocol", slug: "aave-v4",
    });
    expect(r.isError).toBeFalsy();
    expect(r.content.map((c) => c.text ?? "").join("\n")).toBe(KEYLESS_ANSWER);
  }, 20_000);

  keyed("get_rating_breakdown returns live domain scores with a key", async () => {
    const r = await getRatingBreakdown(client, {
      entity_type: "protocol", slug: "aave-v4",
    });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("Domain scores");
    expect(text).toContain("Rating by Verdict —");
  }, 20_000);

  it("quantum_readiness(ethereum) returns a QRI line (LayerQu)", async () => {
    const r = await quantumReadiness(client, { chain: "ethereum" });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("QRI");
    expect(text).toContain("Data: LayerQu - https://layerqu.com/dashboard/");
  }, 20_000);
});
