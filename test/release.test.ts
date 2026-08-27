// The three-field release rule: package.json, server.json and the VERSION
// constant move together. Also guards the manifests against tool-surface and
// description drift.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { SERVER_DESCRIPTION } from "../src/identity.js";
import { searchRatingsMeta } from "../src/tools/search.js";
import { getRatingMeta } from "../src/tools/get.js";
import { listRatingsMeta } from "../src/tools/list.js";
import { quantumReadinessMeta } from "../src/tools/quantum.js";
import { recentIncidentsMeta } from "../src/tools/incidents.js";
import { getMethodologyMeta } from "../src/tools/methodology.js";
import { getRatingBreakdownMeta } from "../src/tools/breakdown.js";
import { requestCoverageMeta } from "../src/tools/coverage.js";

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const pkg = JSON.parse(readFileSync(root("package.json"), "utf8"));
const server = JSON.parse(readFileSync(root("server.json"), "utf8"));
const indexSrc = readFileSync(root("src/index.ts"), "utf8");
const publisher = server._meta["io.modelcontextprotocol.registry/publisher-provided"];

const TOOL_NAMES = [
  searchRatingsMeta,
  getRatingMeta,
  listRatingsMeta,
  quantumReadinessMeta,
  recentIncidentsMeta,
  getMethodologyMeta,
  getRatingBreakdownMeta,
  requestCoverageMeta,
].map((m) => m.name);

describe("release fields", () => {
  it("carries the same version in all three places", () => {
    const inSource = indexSrc.match(/const VERSION = "([^"]+)"/)?.[1];
    expect(inSource).toBe(pkg.version);
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].version).toBe(pkg.version);
  });

  it("publishes the identity description npm-side", () => {
    expect(pkg.description).toBe(SERVER_DESCRIPTION);
  });

  it("keeps the due-diligence keywords", () => {
    for (const k of ["due-diligence", "audit", "marketplace"]) {
      expect(pkg.keywords).toContain(k);
    }
  });
});

describe("registry manifest", () => {
  it("lists exactly the tools this server registers", () => {
    expect(publisher.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      [...TOOL_NAMES].sort(),
    );
  });

  it("carries the house identity in its description", () => {
    expect(server.description).toContain("due-diligence house for DeFi");
    expect(server.title).toContain("Verdict");
  });

  it("keeps title and description inside the registry's 100-character cap", () => {
    // ServerDetail in the 2025-12-11 registry schema: both maxLength 100.
    // Publishing over it is rejected, so it is cheaper to fail here.
    expect(server.title.length).toBeLessThanOrEqual(100);
    expect(server.description.length).toBeLessThanOrEqual(100);
  });
});
