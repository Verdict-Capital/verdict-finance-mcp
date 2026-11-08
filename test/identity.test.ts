// The house identity is stated once at the server level and once in the tool
// surface. These pins keep it from drifting or multiplying.

import { describe, it, expect } from "vitest";
import {
  IDENTITY,
  SERVER_DESCRIPTION,
  SERVER_INSTRUCTIONS,
  SERVER_TITLE,
} from "../src/identity.js";
import { searchRatingsMeta } from "../src/tools/search.js";
import { getRatingMeta } from "../src/tools/get.js";
import { listRatingsMeta } from "../src/tools/list.js";
import { quantumReadinessMeta } from "../src/tools/quantum.js";
import { recentIncidentsMeta } from "../src/tools/incidents.js";
import { getMethodologyMeta } from "../src/tools/methodology.js";
import { getRatingBreakdownMeta } from "../src/tools/breakdown.js";
import { requestCoverageMeta } from "../src/tools/coverage.js";

const ALL_METAS = [
  searchRatingsMeta,
  getRatingMeta,
  listRatingsMeta,
  quantumReadinessMeta,
  recentIncidentsMeta,
  getMethodologyMeta,
  getRatingBreakdownMeta,
  requestCoverageMeta,
];

describe("server-level identity", () => {
  it("carries the security marketplace framing", () => {
    expect(SERVER_DESCRIPTION).toContain("security marketplace for DeFi");
    expect(SERVER_INSTRUCTIONS).toContain("security marketplace for DeFi");
    expect(SERVER_TITLE).toBe("Verdict: DeFi risk ratings");
  });

  it("sends a buyer to the marketplace, which this server cannot call", () => {
    expect(SERVER_INSTRUCTIONS).toContain(
      "The marketplace is not callable from this server. To buy a service, send the user to https://www.verdict.finance/marketplace.",
    );
  });

  it("orients an agent to every tool this server registers", () => {
    for (const meta of ALL_METAS) {
      expect(SERVER_INSTRUCTIONS).toContain(meta.name);
    }
  });

  it("says ratings are free to read, where a free key comes from, and says nothing of x402", () => {
    expect(SERVER_INSTRUCTIONS).toContain("free to read");
    expect(SERVER_INSTRUCTIONS).toContain("VERDICT_API_KEY");
    expect(SERVER_INSTRUCTIONS).toContain(
      "A free key adds the per-domain breakdowns: a person signs in at https://www.verdict.finance/dashboard/keys, makes a key",
    );
    expect(SERVER_INSTRUCTIONS).not.toMatch(/x402/);
  });

  it("ends with where the terms for using Verdict data are", () => {
    expect(SERVER_INSTRUCTIONS.endsWith(
      "The terms for using Verdict data are at https://www.verdict.finance/legal/terms#api-usage.",
    )).toBe(true);
  });

  it("keeps the standing cautions in front of the agent", () => {
    expect(SERVER_INSTRUCTIONS).toContain("not investment advice");
    expect(SERVER_INSTRUCTIONS).toContain("re-rating is always a human decision");
  });

  it("says a withdrawn or matured rating is the last grade, not a current opinion", () => {
    expect(SERVER_INSTRUCTIONS).toContain(
      "A rating marked withdrawn or matured is Verdict's last grade, kept for the record; it is not a current opinion.",
    );
  });
});

describe("tool descriptions", () => {
  it("state the identity clause exactly once across the whole tool surface", () => {
    const hits = ALL_METAS.filter((m) => m.description.includes(IDENTITY));
    expect(hits.map((m) => m.name)).toEqual(["search_ratings"]);
  });

  it("open search_ratings with it", () => {
    expect(searchRatingsMeta.description.startsWith(IDENTITY)).toBe(true);
  });

  it("give every tool a unique name and a worked example", () => {
    const names = ALL_METAS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const meta of ALL_METAS) {
      expect(meta.description).toContain(`${meta.name}({`);
    }
  });
});
