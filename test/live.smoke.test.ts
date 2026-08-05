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

const run = process.env.VERDICT_LIVE_SMOKE === "1" ? describe : describe.skip;

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

  it("quantum_readiness(ethereum) returns a QRI line (LayerQu)", async () => {
    const r = await quantumReadiness(client, { chain: "ethereum" });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    expect(r.isError).toBeFalsy();
    expect(text).toContain("QRI");
    expect(text).toContain("Data: LayerQu - https://layerqu.com/dashboard/");
  }, 20_000);
});
