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
  it("carries the due-diligence house framing", () => {
    expect(SERVER_DESCRIPTION).toContain("due-diligence house for DeFi");
    expect(SERVER_INSTRUCTIONS).toContain("due-diligence house for DeFi");
    expect(SERVER_TITLE).toContain("Verdict");
  });

  it("orients an agent to every tool this server registers", () => {
    for (const meta of ALL_METAS) {
      expect(SERVER_INSTRUCTIONS).toContain(meta.name);
    }
  });

  it("says ratings are free to read and treats x402 as direction, not a paywall", () => {
    expect(SERVER_INSTRUCTIONS).toContain("free to read");
    expect(SERVER_INSTRUCTIONS).toContain("VERDICT_API_KEY");
    expect(SERVER_INSTRUCTIONS).toMatch(/x402.*direction/);
  });

  it("keeps the standing cautions in front of the agent", () => {
    expect(SERVER_INSTRUCTIONS).toContain("not investment advice");
    expect(SERVER_INSTRUCTIONS).toContain("re-rating is always a human decision");
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
