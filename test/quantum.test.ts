import { describe, it, expect } from "vitest";
import { quantumReadiness } from "../src/tools/quantum.js";
import { FakeClient } from "./helpers.js";

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("quantum_readiness tool", () => {
  it("renders per-chain detail with attribution", async () => {
    const c = new FakeClient();
    c.quantum = {
      available: true, chain_slug: "ethereum", qri: 25, band: 2,
      band_label: "Acknowledged", stage: 2, hybrid: "FAIL", danger: false,
      ci: 4, source: "LayerQu", source_url: "https://layerqu.com/dashboard/",
    };
    const r = await quantumReadiness(c, { chain: "ethereum" });
    const t = text(r);
    expect(t).toContain("QRI 25/100");
    expect(t).toContain("Band 2 Acknowledged");
    expect(t).toContain("Stage S2");
    expect(t).toContain("Hybrid signatures: FAIL");
    expect(t).toContain("Data: LayerQu - https://layerqu.com/dashboard/");
    expect(r.isError).toBeFalsy();
  });

  it("renders the league table without a chain arg (all rows)", async () => {
    const c = new FakeClient();
    c.quantum = {
      available: true,
      rows: [
        { slug: "ethereum", name: "Ethereum", profile: "L1", qri: 25, band: 2,
          band_label: "Acknowledged", stage: 2, hybrid: "FAIL", danger: false,
          ci: 5, matched_chain_slug: "ethereum" },
        { slug: "abelian", name: "Abelian", profile: "privacy-focused-chain",
          qri: 55, band: 6, band_label: "Transitioning", stage: 3, hybrid: "FAIL",
          danger: false, ci: 5, matched_chain_slug: null },
      ],
      rows_skipped: 0, source: "LayerQu",
      source_url: "https://layerqu.com/dashboard/",
    };
    const r = await quantumReadiness(c, {});
    const t = text(r);
    expect(t).toContain("Ethereum - QRI 25 - Band 2 Acknowledged - S2");
    expect(t).toContain("Abelian - QRI 55 - Band 6 Transitioning - S3");
    expect(t).toContain("Data: LayerQu - https://layerqu.com/dashboard/");
    expect(r.isError).toBeFalsy();
  });

  it("passes through unavailable gracefully", async () => {
    const c = new FakeClient();
    c.quantum = { available: false, reason: "source unreachable" };
    const t = text(await quantumReadiness(c, {}));
    expect(t).toContain("unavailable");
  });

  it("never throws when the client errors (renders unavailable)", async () => {
    const c = new FakeClient();
    c.throwOn.quantum = "network";
    const r = await quantumReadiness(c, { chain: "ethereum" });
    expect(text(r)).toContain("unavailable");
    expect(r.isError).toBeFalsy();
  });
});
